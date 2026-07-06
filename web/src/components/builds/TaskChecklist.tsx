"use client";

import { useState, useRef, useEffect } from "react";
import { useOfflineMutation } from "@/lib/offline";
import { useDraggable } from "@dnd-kit/core";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ScrollButton } from "@/components/ui/scroll-button";

type ClosetEntityId = Id<"cosplayNodes">;

export interface BuildTask {
  _id: Id<"workflowItems">;
  buildId?: Id<"builds">;
  label: string;
  cosplayNodeId?: ClosetEntityId | null;
  closetItemId?: ClosetEntityId | null;
  sortOrder: number;
  checked: boolean;
  dueDate?: string;
}

interface TaskChecklistProps {
  buildId: Id<"builds">;
  tasks: BuildTask[];
  linkedItems?: Array<{
    _id: ClosetEntityId;
    name: string;
    nodeType?: "element" | "material";
    imageUrl?: string | null;
    imageStorageId?: Id<"_storage"> | null;
  }>;
  onTaskAssign?: (taskId: string, cosplayNodeId: string | null) => void;
  enableDragDrop?: boolean;
  /** Hide bottom “add task” row (use FAB / modal instead) */
  hideInlineAdd?: boolean;
}

export function TaskChecklist({
  buildId,
  tasks,
  linkedItems = [],
  enableDragDrop = false,
  hideInlineAdd = false,
}: TaskChecklistProps) {
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"workflowItems"> | null>(null);
  const [dueDateEditTaskId, setDueDateEditTaskId] = useState<Id<"workflowItems"> | null>(null);
  const { userId } = useCurrentUser();

  const createTask = useOfflineMutation(api.buildTasks.create);
  const updateTask = useOfflineMutation(api.buildTasks.update);
  const deleteTask = useOfflineMutation(api.buildTasks.remove);

  const completedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  const [isPendingCreate, setIsPendingCreate] = useState(false);
  const taskListContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleTask = (taskId: Id<"workflowItems">, checked: boolean) => {
    if (!userId) return;
    updateTask({ id: taskId, userId, checked });
  };

  const handleAddTask = async () => {
    if (!newTaskLabel.trim() || !userId) return;
    setIsPendingCreate(true);
    try {
      await createTask({ userId, buildId, label: newTaskLabel.trim(), sortOrder: tasks.length });
      setNewTaskLabel("");
    } finally {
      setIsPendingCreate(false);
    }
  };

  const handleDeleteTask = (taskId: Id<"workflowItems">) => {
    if (!userId) return;
    deleteTask({ id: taskId, userId });
  };

  const handleOpenAssignModal = (taskId: Id<"workflowItems">) => {
    setSelectedTaskId(taskId);
    setAssignModalOpen(true);
  };

  const handleAssignTask = async (cosplayNodeId: ClosetEntityId | null) => {
    if (!selectedTaskId || !userId) return;
    await updateTask({
      id: selectedTaskId,
      userId,
      cosplayNodeId,
    });
    setAssignModalOpen(false);
    setSelectedTaskId(null);
  };

  const handleDueDateChange = (taskId: Id<"workflowItems">, dueDate: string | null) => {
    if (!userId) return;
    setDueDateEditTaskId(null);
    updateTask({ id: taskId, userId, dueDate });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium text-kyar-text">
          <span>Construction Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-px bg-kyar-borderSubtle w-full">
          <div
            className="h-full bg-kyar-text transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-kyar-textTertiary">
          {completedCount} of {totalCount} tasks complete
        </p>
      </div>

      <div className="relative">
        <div
          ref={taskListContainerRef}
          className="space-y-2 max-h-[min(400px,60vh)] overflow-y-auto overflow-x-hidden overscroll-contain pr-1 -mr-1 pb-11"
          role="list"
          aria-label={`Task list, ${totalCount} tasks`}
        >
          {sortedTasks.map((task) => {
            const linkedItem = linkedItems.find(
              (item) => item._id === (task.cosplayNodeId ?? task.closetItemId)
            );
            return enableDragDrop ? (
              <DraggableTaskRow
                key={task._id}
                task={task}
                linkedItem={linkedItem}
                onToggle={(checked) => handleToggleTask(task._id, checked)}
                onDelete={() => handleDeleteTask(task._id)}
                onAssign={() => handleOpenAssignModal(task._id)}
                isEditingDueDate={dueDateEditTaskId === task._id}
                onStartDueDateEdit={() => setDueDateEditTaskId(task._id)}
                onCancelDueDateEdit={() => setDueDateEditTaskId(null)}
                onDueDateChange={(dueDate) => handleDueDateChange(task._id, dueDate)}
              />
            ) : (
              <TaskRow
                key={task._id}
                task={task}
                linkedItem={linkedItem}
                onToggle={(checked) => handleToggleTask(task._id, checked)}
                onDelete={() => handleDeleteTask(task._id)}
                onAssign={() => handleOpenAssignModal(task._id)}
                isEditingDueDate={dueDateEditTaskId === task._id}
                onStartDueDateEdit={() => setDueDateEditTaskId(task._id)}
                onCancelDueDateEdit={() => setDueDateEditTaskId(null)}
                onDueDateChange={(dueDate) => handleDueDateChange(task._id, dueDate)}
              />
            );
          })}

          {sortedTasks.length === 0 && (
            <p className="text-sm text-kyar-textTertiary text-center py-8">
              {hideInlineAdd
                ? "No tasks yet. Use the + button to add tasks."
                : "No tasks yet. Add your first task below."}
            </p>
          )}
        </div>
        <div className="absolute right-2 bottom-3 pointer-events-none flex justify-end">
          <ScrollButton containerRef={taskListContainerRef} threshold={80} />
        </div>
      </div>

      {!hideInlineAdd && (
        <div className="flex gap-2 pt-4 border-t border-kyar-border">
          <input
            id="build-add-task-input"
            type="text"
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
            placeholder="Add a new task..."
            className="flex-1 border-0 border-b border-kyar-border bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
          />
          <button
            onClick={handleAddTask}
            disabled={!newTaskLabel.trim() || isPendingCreate}
            className="px-4 py-2 bg-kyar-text text-kyar-bg text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {isPendingCreate ? "Adding..." : "Add"}
          </button>
        </div>
      )}

      <div className={`flex gap-2 ${hideInlineAdd ? "pt-4 border-t border-kyar-border" : "pt-2"}`}>
        <button
          onClick={() => {
            sortedTasks.forEach((t) => !t.checked && handleToggleTask(t._id, true));
          }}
          className="flex-1 border border-kyar-border hover:border-kyar-text py-2 text-xs font-semibold uppercase tracking-wider text-kyar-text"
        >
          Mark All Complete
        </button>
      </div>

      <ResponsivePanel
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Task to Node"
      >
        <div className="space-y-2">
          <button
            onClick={() => handleAssignTask(null)}
            className="w-full flex items-center gap-3 p-3 border border-kyar-border hover:border-kyar-text transition"
          >
            <span className="material-symbols-outlined text-kyar-textMuted">close</span>
            <span className="text-sm">Unassign from any node</span>
          </button>
          {linkedItems.map((item) => (
            <button
              key={item._id}
              onClick={() => handleAssignTask(item._id)}
              className="w-full flex items-center gap-3 p-3 border border-kyar-border hover:border-kyar-text transition"
            >
              {item.imageStorageId || item.imageUrl ? (
                <ResolvedImage
                  imageStorageId={item.imageStorageId}
                  imageUrl={item.imageUrl}
                  alt={item.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-kyar-muted rounded flex items-center justify-center">
                  <span className="material-symbols-outlined text-kyar-textMuted">image</span>
                </div>
              )}
              <span className="text-sm flex-1 text-left">
                {item.name}
                {item.nodeType ? (
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-kyar-textTertiary">
                    {item.nodeType}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          {linkedItems.length === 0 && (
            <p className="text-sm text-kyar-textTertiary text-center py-4">
              No elements or materials linked to this build. Link nodes first to assign tasks.
            </p>
          )}
        </div>
      </ResponsivePanel>
    </div>
  );
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface TaskRowProps {
  task: BuildTask;
  linkedItem?: {
    _id: string;
    name: string;
    imageUrl?: string | null;
    imageStorageId?: Id<"_storage"> | null;
  };
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onAssign: () => void;
  isEditingDueDate?: boolean;
  onStartDueDateEdit?: () => void;
  onCancelDueDateEdit?: () => void;
  onDueDateChange?: (dueDate: string | null) => void;
}

function TaskRow({
  task,
  linkedItem,
  onToggle,
  onDelete,
  onAssign,
  isEditingDueDate,
  onStartDueDateEdit,
  onCancelDueDateEdit,
  onDueDateChange,
}: TaskRowProps) {
  const [editDateValue, setEditDateValue] = useState(
    task.dueDate ?? new Date().toISOString().slice(0, 10)
  );
  useEffect(() => {
    if (isEditingDueDate) setEditDateValue(task.dueDate ?? new Date().toISOString().slice(0, 10));
  }, [isEditingDueDate, task.dueDate]);

  return (
    <div
      role="listitem"
      className="flex flex-col gap-2 py-2 px-3 border border-kyar-border hover:border-kyar-text/50 transition group"
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={task.checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-kyar-accent"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}>
            {task.label}
          </span>
          {linkedItem && (
            <span className="text-xs text-kyar-textTertiary block mt-0.5">
              &rarr; {linkedItem.name}
            </span>
          )}
          {task.dueDate && !isEditingDueDate && (
            <span className="text-[10px] text-kyar-textTertiary block mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">calendar_today</span>
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
        {onDueDateChange && (
          <button
            type="button"
            onClick={onStartDueDateEdit}
            className="opacity-0 group-hover:opacity-100 text-kyar-textSecondary hover:text-kyar-text text-xs"
            title={task.dueDate ? "Change due date" : "Set due date"}
          >
            <span className="material-symbols-outlined text-base">calendar_today</span>
          </button>
        )}
        <button
          type="button"
          onClick={onAssign}
          className="opacity-0 group-hover:opacity-100 text-kyar-textSecondary hover:text-kyar-text text-xs"
          title="Assign to node"
        >
          <span className="material-symbols-outlined text-base">link</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-kyar-danger hover:opacity-90 text-xs"
          title="Delete task"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
      {isEditingDueDate && onDueDateChange && (
        <div className="flex items-center gap-2 pl-7">
          <input
            type="date"
            value={editDateValue}
            onChange={(e) => setEditDateValue(e.target.value)}
            className="text-xs border border-kyar-borderSubtle px-2 py-1 rounded"
            aria-label="Due date"
          />
          <button
            type="button"
            onClick={() => onDueDateChange(editDateValue)}
            className="text-xs font-medium underline"
          >
            Save
          </button>
          {task.dueDate && (
            <button
              type="button"
              onClick={() => onDueDateChange(null)}
              className="text-xs text-kyar-textTertiary underline"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onCancelDueDateEdit}
            className="text-xs text-kyar-textTertiary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function DraggableTaskRow({
  task,
  linkedItem,
  onToggle,
  onDelete,
  onAssign,
  isEditingDueDate,
  onStartDueDateEdit,
  onCancelDueDateEdit,
  onDueDateChange,
}: TaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
    data: { type: "task", task },
  });
  const [editDateValue, setEditDateValue] = useState(
    task.dueDate ?? new Date().toISOString().slice(0, 10)
  );
  useEffect(() => {
    if (isEditingDueDate) setEditDateValue(task.dueDate ?? new Date().toISOString().slice(0, 10));
  }, [isEditingDueDate, task.dueDate]);

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      className={`flex flex-col gap-2 py-2 px-3 border border-kyar-border hover:border-kyar-text/50 transition group ${
        isDragging ? "opacity-50 cursor-grabbing" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="material-symbols-outlined text-kyar-textMuted text-base cursor-grab touch-none"
          {...listeners}
          {...attributes}
        >
          drag_indicator
        </span>
        <input
          type="checkbox"
          checked={task.checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-kyar-accent"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}>
            {task.label}
          </span>
          {linkedItem && (
            <span className="text-xs text-kyar-textTertiary block mt-0.5">
              &rarr; {linkedItem.name}
            </span>
          )}
          {task.dueDate && !isEditingDueDate && (
            <span className="text-[10px] text-kyar-textTertiary block mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">calendar_today</span>
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
        {onDueDateChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartDueDateEdit?.();
            }}
            className="opacity-0 group-hover:opacity-100 text-kyar-textSecondary hover:text-kyar-text text-xs"
            title={task.dueDate ? "Change due date" : "Set due date"}
          >
            <span className="material-symbols-outlined text-base">calendar_today</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAssign();
          }}
          className="opacity-0 group-hover:opacity-100 text-kyar-textSecondary hover:text-kyar-text text-xs"
          title="Assign to node"
        >
          <span className="material-symbols-outlined text-base">link</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-kyar-danger hover:opacity-90 text-xs"
          title="Delete task"
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
      {isEditingDueDate && onDueDateChange && (
        <div className="flex items-center gap-2 pl-12">
          <input
            type="date"
            value={editDateValue}
            onChange={(e) => setEditDateValue(e.target.value)}
            className="text-xs border border-kyar-borderSubtle px-2 py-1 rounded"
            aria-label="Due date"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDueDateChange(editDateValue);
            }}
            className="text-xs font-medium underline"
          >
            Save
          </button>
          {task.dueDate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDueDateChange(null);
              }}
              className="text-xs text-kyar-textTertiary underline"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelDueDateEdit?.();
            }}
            className="text-xs text-kyar-textTertiary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
