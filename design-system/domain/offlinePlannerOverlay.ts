/**
 * Shared, platform-agnostic overlay for the **projected planner list** (`workflow:listPlanner`), so
 * offline task create/edit/delete/reorder shows before sync. Pure functions only — reuses the same
 * `deriveStatusProgress` / `isOverdueStatus` the server projection uses, so an offline-created or
 * edited task projects to the same derived fields the server would compute (minus joins it cannot
 * resolve locally — build/convention names, dependency counts — which default to null / 0).
 *
 * The generic `entity_rows` overlay can't be used here because a planner row is a *projection* of a
 * `workflowItems` doc, not the doc itself. Overlay rows carry the queued workflow mutation's fields
 * (a full create — including its `attachments` — or just the changed fields of an edit/move).
 */

import type { EntityOverlayRow } from "./offlineEntityOverlay";
import { deriveStatusProgress, isOverdueStatus, type WorkflowStatus } from "./workflowProgress";

/** The subset of the server's planner projection the overlay produces/maintains. */
export type PlannerOverlayItem = {
  _id: string;
  title: string;
  kind: string;
  category: string;
  status: string;
  parentId?: string;
  ancestorIds: string[];
  sortOrder: number;
  priority: number;
  dueDate?: string;
  targetDate?: string;
  startDate?: string;
  progressPercent: number;
  overdue?: boolean;
  blockedByCount?: number;
  blockedByTitles?: string[];
  buildId?: string;
  buildName: string | null;
  conventionId?: string;
  conventionName?: string | null;
  cosplayNodeId?: string;
  packingListItemId?: string;
};

type OverlayDoc = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function attachmentEntityId(doc: OverlayDoc, entityType: string): string | undefined {
  const attachments = doc.attachments;
  if (!Array.isArray(attachments)) return undefined;
  for (const raw of attachments) {
    if (raw !== null && typeof raw === "object") {
      const attachment = raw as Record<string, unknown>;
      if (attachment.entityType === entityType) return str(attachment.entityId);
    }
  }
  return undefined;
}

/** Project an offline-created workflow item (its create args) into a planner row. */
function projectCreate(id: string, doc: OverlayDoc, today: string): PlannerOverlayItem {
  const status = str(doc.status) ?? "not_started";
  const dueDate = str(doc.dueDate);
  return {
    _id: id,
    title: str(doc.title) ?? "",
    kind: str(doc.kind) ?? "task",
    category: str(doc.category) ?? "craft",
    status,
    parentId: str(doc.parentId),
    ancestorIds: [],
    sortOrder: num(doc.sortOrder) ?? 0,
    priority: num(doc.priority) ?? 0,
    dueDate,
    targetDate: str(doc.targetDate),
    startDate: str(doc.startDate),
    progressPercent: deriveStatusProgress({
      status: status as WorkflowStatus,
      manualProgressPercent: num(doc.manualProgressPercent),
    }),
    overdue: isOverdueStatus({ dueDate, status: status as WorkflowStatus, today }),
    blockedByCount: 0,
    blockedByTitles: [],
    buildId: attachmentEntityId(doc, "build"),
    buildName: null,
    conventionId: attachmentEntityId(doc, "convention"),
    conventionName: null,
    cosplayNodeId: attachmentEntityId(doc, "cosplayNode"),
    packingListItemId: attachmentEntityId(doc, "packingItem"),
  };
}

/** Merge an edit/move overlay onto an existing planner row, recomputing derived fields. */
function mergeUpdate(
  existing: PlannerOverlayItem,
  doc: OverlayDoc,
  today: string
): PlannerOverlayItem {
  const merged: PlannerOverlayItem = { ...existing };
  if (doc.title !== undefined) merged.title = str(doc.title) ?? merged.title;
  if (doc.status !== undefined) merged.status = str(doc.status) ?? merged.status;
  if (doc.category !== undefined) merged.category = str(doc.category) ?? merged.category;
  if (doc.dueDate !== undefined) merged.dueDate = str(doc.dueDate);
  if (doc.targetDate !== undefined) merged.targetDate = str(doc.targetDate);
  if (doc.startDate !== undefined) merged.startDate = str(doc.startDate);
  if (doc.priority !== undefined) merged.priority = num(doc.priority) ?? merged.priority;
  if (doc.sortOrder !== undefined) merged.sortOrder = num(doc.sortOrder) ?? merged.sortOrder;
  if ("parentId" in doc) merged.parentId = str(doc.parentId);

  merged.progressPercent = deriveStatusProgress({
    status: merged.status as WorkflowStatus,
    manualProgressPercent: num(doc.manualProgressPercent),
  });
  merged.overdue = isOverdueStatus({
    dueDate: merged.dueDate,
    status: merged.status as WorkflowStatus,
    today,
  });
  return merged;
}

/**
 * Apply pending workflow-item overlays onto the projected planner list. Edits merge in place
 * (preserving order); offline-created tasks are appended; deletes are removed. Groups are skipped
 * to match the server projection (which excludes `kind === "group"`). Returns a new array.
 */
export function applyPlannerOverlay(
  base: readonly PlannerOverlayItem[],
  overlays: readonly EntityOverlayRow[],
  today: string
): PlannerOverlayItem[] {
  const byId = new Map<string, PlannerOverlayItem>();
  const order: string[] = [];
  for (const item of base) {
    byId.set(item._id, item);
    order.push(item._id);
  }
  for (const overlay of overlays) {
    if (overlay.deleted) {
      byId.delete(overlay.id);
      continue;
    }
    const doc = overlay.doc ?? {};
    const existing = byId.get(overlay.id);
    if (existing) {
      byId.set(overlay.id, mergeUpdate(existing, doc, today));
    } else {
      if (str(doc.kind) === "group") continue;
      byId.set(overlay.id, projectCreate(overlay.id, doc, today));
      order.push(overlay.id);
    }
  }
  const result: PlannerOverlayItem[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) result.push(item);
  }
  return result;
}
