/**
 * Shared, platform-agnostic overlay for the **projected build-tree** (`workflow:listBuildTree`), so
 * offline task create/edit/delete/reorder shows inside a build before sync.
 *
 * Unlike the flat planner, the build tree is a nested projection with progress roll-ups. Rather than
 * patch the nested shape, we re-derive it: flatten the server tree back to its inputs (items +
 * attachments + dependencies — the tree nodes carry both), apply the queued workflow mutations to the
 * flat items, then re-run the same `buildWorkflowTree` / stats math the server uses. External
 * progress sources (packing/cosplay) cannot be resolved offline, so externally-driven items fall back
 * to status-derived progress until the next sync — an acceptable optimistic degradation.
 */

import type { EntityOverlayRow } from "./offlineEntityOverlay";
import { buildWorkflowTree, deriveDoneCounts } from "./workflowDomain";
import { deriveStatusProgress, type WorkflowStatus } from "./workflowProgress";

type FlatItem = {
  _id: string;
  parentId?: string | null;
  ancestorIds: string[];
  sortOrder: number;
  title: string;
  kind: string;
  status: string;
  manualProgressPercent?: number | null;
  weight?: number | null;
} & Record<string, unknown>;

type FlatAttachment = { workflowItemId: string } & Record<string, unknown>;
type FlatDependency = {
  predecessorWorkflowItemId: string;
  successorWorkflowItemId: string;
} & Record<string, unknown>;

type TreeNode = FlatItem & {
  children: TreeNode[];
  attachments?: FlatAttachment[];
  dependencies?: FlatDependency[];
};

export type BuildTreeResult = {
  buildId: string;
  items: TreeNode[];
  stats: { tasksTotal: number; tasksDone: number; workflowProgressPercent: number };
};

const DERIVED_KEYS = new Set([
  "children",
  "attachments",
  "dependencies",
  "blockedByCount",
  "isBlocked",
  "progressPercent",
  "childCount",
]);

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Recover the raw item from a tree node by dropping the derived/structural keys. */
function nodeToItem(node: TreeNode): FlatItem {
  const item: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!DERIVED_KEYS.has(key)) item[key] = value;
  }
  return item as FlatItem;
}

function collectInputs(nodes: readonly TreeNode[]): {
  items: FlatItem[];
  attachments: FlatAttachment[];
  dependencies: FlatDependency[];
} {
  const items: FlatItem[] = [];
  const attachments: FlatAttachment[] = [];
  const dependencies: FlatDependency[] = [];
  const seenDeps = new Set<string>();
  const visit = (node: TreeNode) => {
    items.push(nodeToItem(node));
    for (const attachment of node.attachments ?? []) attachments.push(attachment);
    for (const dependency of node.dependencies ?? []) {
      const key = `${dependency.predecessorWorkflowItemId}->${dependency.successorWorkflowItemId}`;
      if (!seenDeps.has(key)) {
        seenDeps.add(key);
        dependencies.push(dependency);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of nodes) visit(node);
  return { items, attachments, dependencies };
}

function overlayBuildId(doc: Record<string, unknown>): string | undefined {
  const attachments = doc.attachments;
  if (!Array.isArray(attachments)) return undefined;
  for (const raw of attachments) {
    if (raw !== null && typeof raw === "object") {
      const attachment = raw as Record<string, unknown>;
      if (attachment.entityType === "build") return str(attachment.entityId);
    }
  }
  return undefined;
}

function attachmentsFromCreate(id: string, doc: Record<string, unknown>): FlatAttachment[] {
  const attachments = doc.attachments;
  if (!Array.isArray(attachments)) return [];
  const result: FlatAttachment[] = [];
  for (const raw of attachments) {
    if (raw !== null && typeof raw === "object") {
      result.push({ ...(raw as Record<string, unknown>), workflowItemId: id });
    }
  }
  return result;
}

function createItem(id: string, doc: Record<string, unknown>): FlatItem {
  return {
    ...doc,
    _id: id,
    parentId: str(doc.parentId) ?? null,
    ancestorIds: Array.isArray(doc.ancestorIds) ? (doc.ancestorIds as string[]) : [],
    sortOrder: num(doc.sortOrder) ?? 0,
    title: str(doc.title) ?? "",
    kind: str(doc.kind) ?? "task",
    status: str(doc.status) ?? "not_started",
  };
}

function mergeItem(existing: FlatItem, doc: Record<string, unknown>): FlatItem {
  const merged: FlatItem = { ...existing };
  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id" || key === "idempotencyKey" || key === "userId") continue;
    if (key === "parentId") {
      merged.parentId = str(value) ?? null;
      continue;
    }
    (merged as Record<string, unknown>)[key] = value;
  }
  return merged;
}

function computeStats(items: FlatItem[]): BuildTreeResult["stats"] {
  const { total, done } = deriveDoneCounts(items);
  let workflowProgressPercent = 0;
  if (total > 0) {
    workflowProgressPercent = Math.round((done / total) * 100);
  } else if (items.length > 0) {
    const sum = items.reduce(
      (acc, item) =>
        acc +
        deriveStatusProgress({
          status: item.status as WorkflowStatus,
          manualProgressPercent: item.manualProgressPercent,
        }),
      0
    );
    workflowProgressPercent = Math.round(sum / items.length);
  }
  return { tasksTotal: total, tasksDone: done, workflowProgressPercent };
}

/**
 * Apply pending workflow-item overlays to a build-tree result. Edits/moves/deletes apply only to
 * items already in this build's tree; offline-created tasks are included when their attachments
 * target this build or their parent is already in the tree. Returns a freshly re-derived result.
 */
export function applyBuildTreeOverlay(
  base: BuildTreeResult,
  overlays: readonly EntityOverlayRow[],
  buildId: string
): BuildTreeResult {
  const { items, attachments, dependencies } = collectInputs(base.items);
  const itemsById = new Map<string, FlatItem>(items.map((item) => [item._id, item]));
  const extraAttachments: FlatAttachment[] = [];

  for (const overlay of overlays) {
    if (overlay.deleted) {
      itemsById.delete(overlay.id);
      continue;
    }
    const doc = overlay.doc ?? {};
    const existing = itemsById.get(overlay.id);
    if (existing) {
      itemsById.set(overlay.id, mergeItem(existing, doc));
      continue;
    }
    const parentId = str(doc.parentId);
    const belongsToBuild =
      overlayBuildId(doc) === buildId || (parentId != null && itemsById.has(parentId));
    if (!belongsToBuild) continue;
    itemsById.set(overlay.id, createItem(overlay.id, doc));
    for (const attachment of attachmentsFromCreate(overlay.id, doc)) {
      extraAttachments.push(attachment);
    }
  }

  const nextItems = Array.from(itemsById.values());
  const presentIds = new Set(nextItems.map((item) => item._id));
  const nextAttachments = [
    ...attachments.filter((attachment) => presentIds.has(attachment.workflowItemId)),
    ...extraAttachments,
  ];
  const nextDependencies = dependencies.filter(
    (dependency) =>
      presentIds.has(dependency.predecessorWorkflowItemId) &&
      presentIds.has(dependency.successorWorkflowItemId)
  );

  const tree = buildWorkflowTree({
    items: nextItems,
    attachments: nextAttachments,
    dependencies: nextDependencies,
  }) as TreeNode[];

  return { buildId: base.buildId, items: tree, stats: computeStats(nextItems) };
}
