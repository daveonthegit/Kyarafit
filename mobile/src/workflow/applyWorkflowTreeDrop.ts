import type { DropZone } from "@kyarafit/design-system/domain";
import type { PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import type { Id } from "convex/_generated/dataModel";

/** Minimal task fields for sibling reorder / reparent (matches planner logic). */
export type WorkflowDropTask = {
  _id: Id<"workflowItems">;
  parentId?: Id<"workflowItems"> | null;
  sortOrder?: number;
};

export type WorkflowTreeMoveFns = {
  userId: string;
  moveTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    parentId?: Id<"workflowItems"> | null;
    sortOrder?: number;
  }) => Promise<unknown>;
  updateTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    sortOrder: number;
  }) => Promise<unknown>;
};

/**
 * Reorder or reparent workflow items (same rules as planner drag-and-drop).
 * `canDragBetween` defaults to always true; planner passes plannerTaskScopeKey equality.
 */
export async function applyWorkflowTreeDrop(
  dragged: PlannerTaskDragMeta,
  target: PlannerTaskDragMeta,
  zone: DropZone,
  tasks: WorkflowDropTask[],
  fns: WorkflowTreeMoveFns,
  canDragBetween?: (a: WorkflowDropTask, b: WorkflowDropTask) => boolean
): Promise<void> {
  const dragId = dragged.taskId as Id<"workflowItems">;
  const targetId = target.taskId as Id<"workflowItems">;

  const D = tasks.find((task) => task._id === dragId);
  const T = tasks.find((task) => task._id === targetId);
  if (!D || !T) return;
  if (canDragBetween && !canDragBetween(D, T)) return;

  const siblingIdsForParent = (parentId: Id<"workflowItems"> | null) =>
    tasks
      .filter((task) => (task.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id);

  if (zone === "into") {
    const existingIds = tasks
      .filter((task) => task.parentId === targetId && task._id !== dragId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id);

    const oldParent = D.parentId ?? null;

    await fns.moveTask({
      id: dragId,
      userId: fns.userId,
      parentId: targetId,
      sortOrder: existingIds.length,
    });

    await resequenceTasks(fns, [...existingIds, dragId]);

    if (oldParent !== targetId) {
      await resequenceTasks(fns, siblingIdsForParent(oldParent).filter((id) => id !== dragId));
    }
    return;
  }

  const newParent = T.parentId ?? null;
  let ordered = siblingIdsForParent(newParent).filter((id) => id !== dragId);
  const targetIndex = ordered.indexOf(targetId);
  if (targetIndex < 0) return;
  const insertAt = zone === "before" ? targetIndex : targetIndex + 1;
  ordered.splice(insertAt, 0, dragId);

  const oldParent = D.parentId ?? null;

  await fns.moveTask({
    id: dragId,
    userId: fns.userId,
    parentId: newParent,
    sortOrder: insertAt,
  });

  await resequenceTasks(fns, ordered);

  if ((oldParent ?? null) !== (newParent ?? null)) {
    await resequenceTasks(fns, siblingIdsForParent(oldParent).filter((id) => id !== dragId));
  }
}

export async function promoteWorkflowTaskToRoot(
  dragged: PlannerTaskDragMeta,
  tasks: WorkflowDropTask[],
  fns: WorkflowTreeMoveFns,
  canPromoteIntoRootGroup?: (task: WorkflowDropTask) => boolean
): Promise<void> {
  const dragId = dragged.taskId as Id<"workflowItems">;
  const draggedTask = tasks.find((task) => task._id === dragId);
  if (!draggedTask) return;

  const oldParent = draggedTask.parentId ?? null;
  if (oldParent == null) return;

  const rootIds = tasks
    .filter(
      (task) =>
        task._id !== dragId &&
        (task.parentId ?? null) === null &&
        (canPromoteIntoRootGroup ? canPromoteIntoRootGroup(task) : true)
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => task._id);

  await fns.moveTask({
    id: dragId,
    userId: fns.userId,
    parentId: null,
    sortOrder: rootIds.length,
  });

  await resequenceTasks(fns, [...rootIds, dragId]);

  const oldParentSiblingIds = tasks
    .filter((task) => (task.parentId ?? null) === oldParent && task._id !== dragId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => task._id);

  await resequenceTasks(fns, oldParentSiblingIds);
}

async function resequenceTasks(fns: WorkflowTreeMoveFns, ids: Id<"workflowItems">[]) {
  for (let index = 0; index < ids.length; index += 1) {
    await fns.updateTask({
      id: ids[index],
      userId: fns.userId,
      sortOrder: index,
    });
  }
}
