import type { DropZone, RectLike } from "./cosplayExplorer";

/** Scope key must match between rows for planner drag-and-drop (same visual group). */
export type PlannerTaskScopeKey = string;

export type PlannerTaskDragMeta = {
  taskId: string;
  scopeKey: PlannerTaskScopeKey;
  /** Workflow parent (`undefined` = root in this subtree). */
  parentId?: string;
  siblingIndex: number;
  ancestorIds: string[];
  /** Display name, used by the dragging ghost (optional for back-compat). */
  title?: string;
};

/** Group tasks the same way as planner `buildTaskTree` buckets. */
export function plannerTaskScopeKey(task: {
  conventionId?: unknown;
  buildId?: unknown;
  category?: string;
  packingListItemId?: unknown;
}): PlannerTaskScopeKey {
  const conventionId = task.conventionId as string | undefined;
  const buildId = task.buildId as string | undefined;
  if (conventionId) {
    const packingTask =
      task.category === "pack" || Boolean(task.packingListItemId) || !buildId;
    if (packingTask) return `c:${conventionId}:pack`;
    return `c:${conventionId}:b:${buildId ?? ""}`;
  }
  if (buildId) return `b:${buildId}`;
  return "unassigned";
}

/**
 * Drop zones for workflow tasks: same geometry as cosplay explorer (before / into / after).
 */
export function computePlannerTaskDropZone(
  clientY: number,
  rect: RectLike,
  dragged: PlannerTaskDragMeta | null,
  target: PlannerTaskDragMeta
): DropZone | null {
  if (!dragged || dragged.taskId === target.taskId) return null;
  if (dragged.scopeKey !== target.scopeKey) return null;

  const targetUnderDrag = target.ancestorIds.includes(dragged.taskId);
  const ratio = (clientY - rect.top) / Math.max(rect.height, 1);

  const sameParent = (dragged.parentId ?? "") === (target.parentId ?? "");
  const canNestInto = !targetUnderDrag;

  if (sameParent && canNestInto) {
    if (ratio < 0.22) return "before";
    if (ratio > 0.78) return "after";
    return "into";
  }
  if (sameParent) {
    return ratio < 0.5 ? "before" : "after";
  }
  if (canNestInto) {
    if (ratio < 0.22) return "before";
    if (ratio > 0.78) return "after";
    return "into";
  }
  return ratio < 0.5 ? "before" : "after";
}
