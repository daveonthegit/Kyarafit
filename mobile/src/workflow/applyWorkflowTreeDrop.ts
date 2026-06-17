import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import type { Id } from "convex/_generated/dataModel";

/** Minimal task fields for sibling reorder / reparent (matches planner logic). */
export type WorkflowDropTask = {
  _id: Id<"workflowItems">;
  parentId?: Id<"workflowItems"> | null;
  sortOrder?: number;
  /** Optional visual/planner bucket; when present, resequencing stays inside it. */
  scopeKey?: string;
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
  moveAndResequence?: (args: {
    userId: string;
    move: {
      id: Id<"workflowItems">;
      parentId?: Id<"workflowItems"> | null;
      sortOrder?: number;
    };
    resequence: { id: Id<"workflowItems">; sortOrder: number }[];
  }) => Promise<unknown>;
};

async function commitMoveAndResequence(
  fns: WorkflowTreeMoveFns,
  move: {
    id: Id<"workflowItems">;
    parentId?: Id<"workflowItems"> | null;
    sortOrder?: number;
  },
  orderedSiblingIds: Id<"workflowItems">[],
  extraOrderedSiblingIds: Id<"workflowItems">[] = []
) {
  if (fns.moveAndResequence) {
    await fns.moveAndResequence({
      userId: fns.userId,
      move,
      resequence: [
        ...orderedSiblingIds.map((id, sortOrder) => ({ id, sortOrder })),
        ...extraOrderedSiblingIds.map((id, sortOrder) => ({ id, sortOrder })),
      ],
    });
    return;
  }

  await fns.moveTask({
    ...move,
    userId: fns.userId,
  });
  await resequenceTasks(fns, orderedSiblingIds);
  if (extraOrderedSiblingIds.length > 0) {
    await resequenceTasks(fns, extraOrderedSiblingIds);
  }
}

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
  if (D.scopeKey != null && T.scopeKey != null && D.scopeKey !== T.scopeKey) return;

  const sameDragScope = (task: WorkflowDropTask) =>
    task.scopeKey == null || task.scopeKey === (D.scopeKey ?? dragged.scopeKey);

  const siblingIdsForParent = (parentId: Id<"workflowItems"> | null) =>
    tasks
      .filter((task) => sameDragScope(task) && (task.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id);

  if (zone === "into") {
    const existingIds = tasks
      .filter((task) => sameDragScope(task) && task.parentId === targetId && task._id !== dragId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id);

    const oldParent = D.parentId ?? null;
    const oldParentSiblingIds =
      oldParent !== targetId ? siblingIdsForParent(oldParent).filter((id) => id !== dragId) : [];

    await commitMoveAndResequence(
      fns,
      {
        id: dragId,
        parentId: targetId,
        sortOrder: existingIds.length,
      },
      [...existingIds, dragId],
      oldParentSiblingIds
    );
    return;
  }

  const newParent = T.parentId ?? null;
  let ordered = siblingIdsForParent(newParent).filter((id) => id !== dragId);
  const targetIndex = ordered.indexOf(targetId);
  if (targetIndex < 0) return;
  const insertAt = zone === "before" ? targetIndex : targetIndex + 1;
  ordered.splice(insertAt, 0, dragId);

  const oldParent = D.parentId ?? null;
  const oldParentSiblingIds =
    (oldParent ?? null) !== (newParent ?? null)
      ? siblingIdsForParent(oldParent).filter((id) => id !== dragId)
      : [];

  await commitMoveAndResequence(
    fns,
    {
      id: dragId,
      parentId: newParent,
      sortOrder: insertAt,
    },
    ordered,
    oldParentSiblingIds
  );
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
  const sameDragScope = (task: WorkflowDropTask) =>
    task.scopeKey == null || task.scopeKey === (draggedTask.scopeKey ?? dragged.scopeKey);
  if (oldParent == null) return;

  const rootIds = tasks
    .filter(
      (task) =>
        task._id !== dragId &&
        sameDragScope(task) &&
        (task.parentId ?? null) === null &&
        (canPromoteIntoRootGroup ? canPromoteIntoRootGroup(task) : true)
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => task._id);

  const oldParentSiblingIds = tasks
    .filter(
      (task) => sameDragScope(task) && (task.parentId ?? null) === oldParent && task._id !== dragId
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => task._id);

  await commitMoveAndResequence(
    fns,
    {
      id: dragId,
      parentId: null,
      sortOrder: rootIds.length,
    },
    [...rootIds, dragId],
    oldParentSiblingIds
  );
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
