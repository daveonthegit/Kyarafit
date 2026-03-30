import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  deriveWorkflowAggregateProgress,
  isDoneStatus,
  isTerminalStatus,
  type WorkflowAttachmentRole,
  type WorkflowCategory,
  type WorkflowEntityType,
  type WorkflowItemKind,
  type WorkflowScopeKind,
  type WorkflowSourceKind,
  type WorkflowStatus,
} from "./workflowProgress";

type Ctx = QueryCtx | MutationCtx;

export type WorkflowItemDoc = Doc<"workflowItems">;
export type WorkflowAttachmentDoc = Doc<"workflowAttachments">;
export type WorkflowDependencyDoc = Doc<"workflowDependencies">;

export function entityKey(entityType: WorkflowEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parentAncestorIds(
  parent: Pick<WorkflowItemDoc, "_id" | "ancestorIds"> | null
): Id<"workflowItems">[] {
  if (!parent) return [];
  return [...parent.ancestorIds, parent._id];
}

export async function getWorkflowItemById(
  ctx: Ctx,
  id: Id<"workflowItems">
): Promise<WorkflowItemDoc | null> {
  return await ctx.db.get(id);
}

export async function getWorkflowItemsForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowItems")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowAttachmentsForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowAttachments")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowDependenciesForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowDependencies")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowItemsByAttachmentKey(
  ctx: Ctx,
  userId: string,
  keys: string[],
  buildContextId?: Id<"builds">
) {
  const attachments = await getWorkflowAttachmentsForUser(ctx, userId);
  const keySet = new Set(keys);
  const seedIds = new Set<string>();

  for (const attachment of attachments) {
    if (!keySet.has(attachment.entityKey)) continue;
    if (
      buildContextId &&
      attachment.buildContextId &&
      attachment.buildContextId !== buildContextId
    ) {
      continue;
    }
    if (!buildContextId && attachment.buildContextId) {
      continue;
    }
    seedIds.add(attachment.workflowItemId);
  }

  if (seedIds.size === 0) {
    return {
      items: [] as WorkflowItemDoc[],
      attachments: [] as WorkflowAttachmentDoc[],
    };
  }

  const items = await getWorkflowItemsForUser(ctx, userId);
  const seedItemMap = new Map(
    items.filter((item) => seedIds.has(item._id)).map((item) => [item._id, item])
  );
  const includedIds = new Set<string>();
  for (const item of Array.from(seedItemMap.values())) {
    includedIds.add(item._id);
    for (const ancestorId of item.ancestorIds) includedIds.add(ancestorId);
  }

  const scopedItems = items.filter(
    (item) =>
      includedIds.has(item._id) ||
      item.ancestorIds.some((ancestorId) => includedIds.has(ancestorId))
  );
  const itemIds = new Set(scopedItems.map((item) => item._id));
  const scopedAttachments = attachments.filter((attachment) =>
    itemIds.has(attachment.workflowItemId)
  );

  return { items: scopedItems, attachments: scopedAttachments };
}

export function sortWorkflowItems(items: WorkflowItemDoc[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.parentId !== b.parentId) return (a.parentId ?? "").localeCompare(b.parentId ?? "");
    return a.title.localeCompare(b.title);
  });
}

type WorkflowTreeNode = WorkflowItemDoc & {
  attachments: WorkflowAttachmentDoc[];
  dependencies: WorkflowDependencyDoc[];
  blockedByCount: number;
  isBlocked: boolean;
  progressPercent: number;
  childCount: number;
  children: WorkflowTreeNode[];
};

export function buildWorkflowTree(input: {
  items: WorkflowItemDoc[];
  attachments: WorkflowAttachmentDoc[];
  dependencies: WorkflowDependencyDoc[];
  externalProgress?: Map<
    string,
    Array<{ progressPercent?: number | null; weight?: number | null; excluded?: boolean }>
  >;
}) {
  const sortedItems = sortWorkflowItems(input.items);
  const attachmentsByItem = new Map<string, WorkflowAttachmentDoc[]>();
  for (const attachment of input.attachments) {
    const list = attachmentsByItem.get(attachment.workflowItemId) ?? [];
    list.push(attachment);
    attachmentsByItem.set(attachment.workflowItemId, list);
  }

  const prereqsBySuccessor = new Map<string, WorkflowDependencyDoc[]>();
  for (const dependency of input.dependencies) {
    const list = prereqsBySuccessor.get(dependency.successorWorkflowItemId) ?? [];
    list.push(dependency);
    prereqsBySuccessor.set(dependency.successorWorkflowItemId, list);
  }

  const itemMap = new Map<string, WorkflowItemDoc>(sortedItems.map((item) => [item._id, item]));
  const childrenByParent = new Map<string, WorkflowItemDoc[]>();
  const rootItems: WorkflowItemDoc[] = [];
  for (const item of sortedItems) {
    if (item.parentId) {
      const list = childrenByParent.get(item.parentId) ?? [];
      list.push(item);
      childrenByParent.set(item.parentId, list);
    } else {
      rootItems.push(item);
    }
  }

  const memo = new Map<string, WorkflowTreeNode>();
  const visit = (item: WorkflowItemDoc): WorkflowTreeNode => {
    const existing = memo.get(item._id);
    if (existing) return existing;
    const childItems = (childrenByParent.get(item._id) ?? []).map(visit);
    const dependencies = prereqsBySuccessor.get(item._id) ?? [];
    const blockedByCount = dependencies.filter((dependency) => {
      const predecessor = itemMap.get(dependency.predecessorWorkflowItemId);
      return predecessor ? !isDoneStatus(predecessor.status as WorkflowStatus) : false;
    }).length;
    const progressPercent = deriveWorkflowAggregateProgress({
      kind: item.kind as WorkflowItemKind,
      status: item.status as WorkflowStatus,
      manualProgressPercent: item.manualProgressPercent,
      childProgress: childItems.map((child) => ({
        progressPercent: child.progressPercent,
        weight: child.weight,
        excluded: child.status === "cancelled",
      })),
      attachedProgress: input.externalProgress?.get(item._id) ?? [],
    });

    const node: WorkflowTreeNode = {
      ...item,
      attachments: attachmentsByItem.get(item._id) ?? [],
      dependencies,
      blockedByCount,
      isBlocked: blockedByCount > 0 && !isTerminalStatus(item.status as WorkflowStatus),
      progressPercent,
      childCount: childItems.length,
      children: childItems,
    };
    memo.set(item._id, node);
    return node;
  };

  return rootItems.map(visit);
}

export function flattenWorkflowTree(nodes: WorkflowTreeNode[]): WorkflowTreeNode[] {
  const flattened: WorkflowTreeNode[] = [];
  const visit = (node: WorkflowTreeNode) => {
    flattened.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flattened;
}

export function deriveDoneCounts(items: Array<Pick<WorkflowItemDoc, "kind" | "status">>) {
  const actionable = items.filter((item) => item.kind === "task");
  return {
    total: actionable.length,
    done: actionable.filter((item) => item.status === "done").length,
  };
}

export type WorkflowCreateInput = {
  title: string;
  notes?: string;
  kind?: WorkflowItemKind;
  category?: WorkflowCategory;
  status?: WorkflowStatus;
  parentId?: Id<"workflowItems">;
  scopeKind?: WorkflowScopeKind;
  sourceKind?: WorkflowSourceKind;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  reminders?: Array<{ kind: string; date: string }>;
  weight?: number;
  manualProgressPercent?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  estimatedCostCents?: number;
  actualCostCents?: number;
  creatorUserId?: string;
  ownerUserId?: string;
  assigneeUserId?: string;
  templateId?: Id<"workflowTemplates">;
  recurrenceRule?: string;
  legacyBuildTaskId?: Id<"buildTasks">;
  dedupeKey?: string;
};

export type WorkflowAttachmentInput = {
  entityType: WorkflowEntityType;
  entityId: string;
  role?: WorkflowAttachmentRole;
  buildContextId?: Id<"builds">;
  progressWeight?: number;
};
