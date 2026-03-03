"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useDraggable } from "@dnd-kit/core";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export interface BuildTask {
  _id: Id<"buildTasks">;
  buildId: Id<"builds">;
  label: string;
  closetItemId?: Id<"closetItems"> | null;
  sortOrder: number;
  checked: boolean;
}

interface TaskChecklistProps {
  buildId: Id<"builds">;
  tasks: BuildTask[];
  linkedItems?: Array<{ _id: Id<"closetItems">; name: string; imageUrl?: string | null }>;
  onTaskAssign?: (taskId: string, closetItemId: string | null) => void;
  enableDragDrop?: boolean;
}

export function TaskChecklist({
  buildId,
  tasks,
  linkedItems = [],
  enableDragDrop = false,
}: TaskChecklistProps) {
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"buildTasks"> | null>(null);
  const { userId } = useCurrentUser();

  const createTask = useMutation(api.buildTasks.create);
  const updateTask = useMutation(api.buildTasks.update);
  const deleteTask = useMutation(api.buildTasks.remove);

  const completedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  const [isPendingCreate, setIsPendingCreate] = useState(false);

  const handleToggleTask = (taskId: Id<"buildTasks">, checked: boolean) => {
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

  const handleDeleteTask = (taskId: Id<"buildTasks">) => {
    if (!userId) return;
    deleteTask({ id: taskId, userId });
  };

  const handleOpenAssignModal = (taskId: Id<"buildTasks">) => {
    setSelectedTaskId(taskId);
    setAssignModalOpen(true);
  };

  const handleAssignTask = async (closetItemId: Id<"closetItems"> | undefined) => {
    if (!selectedTaskId || !userId) return;
    await updateTask({ id: selectedTaskId, userId, closetItemId });
    setAssignModalOpen(false);
    setSelectedTaskId(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium">
          <span>Construction Progress</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-px bg-gray-200 w-full">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-kyar-textTertiary">
          {completedCount} of {totalCount} tasks complete
        </p>
      </div>

      <div className="space-y-2">
        {sortedTasks.map((task) => {
          const linkedItem = linkedItems.find((item) => item._id === task.closetItemId);
          return enableDragDrop ? (
            <DraggableTaskRow
              key={task._id}
              task={task}
              linkedItem={linkedItem}
              onToggle={(checked) => handleToggleTask(task._id, checked)}
              onDelete={() => handleDeleteTask(task._id)}
              onAssign={() => handleOpenAssignModal(task._id)}
            />
          ) : (
            <TaskRow
              key={task._id}
              task={task}
              linkedItem={linkedItem}
              onToggle={(checked) => handleToggleTask(task._id, checked)}
              onDelete={() => handleDeleteTask(task._id)}
              onAssign={() => handleOpenAssignModal(task._id)}
            />
          );
        })}

        {sortedTasks.length === 0 && (
          <p className="text-sm text-kyar-textTertiary text-center py-8">
            No tasks yet. Add your first task below.
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-kyar-border">
        <input
          type="text"
          value={newTaskLabel}
          onChange={(e) => setNewTaskLabel(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleAddTask()}
          placeholder="Add a new task..."
          className="flex-1 border-0 border-b border-black bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
        />
        <button
          onClick={handleAddTask}
          disabled={!newTaskLabel.trim() || isPendingCreate}
          className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {isPendingCreate ? "Adding..." : "Add"}
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => {
            sortedTasks.forEach((t) => !t.checked && handleToggleTask(t._id, true));
          }}
          className="flex-1 border border-kyar-border hover:border-black py-2 text-xs font-semibold uppercase tracking-wider"
        >
          Mark All Complete
        </button>
      </div>

      {assignModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setAssignModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Assign Task to Item</h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-gray-500 hover:text-black"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleAssignTask(undefined)}
                className="w-full flex items-center gap-3 p-3 border border-kyar-border hover:border-black transition"
              >
                <span className="material-symbols-outlined text-gray-400">close</span>
                <span className="text-sm">Unassign from any item</span>
              </button>
              {linkedItems.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleAssignTask(item._id)}
                  className="w-full flex items-center gap-3 p-3 border border-kyar-border hover:border-black transition"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-400">image</span>
                    </div>
                  )}
                  <span className="text-sm flex-1 text-left">{item.name}</span>
                </button>
              ))}
              {linkedItems.length === 0 && (
                <p className="text-sm text-kyar-textTertiary text-center py-4">
                  No closet items linked to this build. Link items first to assign tasks.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: BuildTask;
  linkedItem?: { _id: string; name: string; imageUrl?: string | null };
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onAssign: () => void;
}

function TaskRow({ task, linkedItem, onToggle, onDelete, onAssign }: TaskRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 border border-kyar-border hover:border-black transition group">
      <input
        type="checkbox"
        checked={task.checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-black"
      />
      <div className="flex-1">
        <span className={`text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}>
          {task.label}
        </span>
        {linkedItem && (
          <span className="text-xs text-kyar-textTertiary block mt-0.5">
            &rarr; {linkedItem.name}
          </span>
        )}
      </div>
      <button
        onClick={onAssign}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-black text-xs"
        title="Assign to item"
      >
        <span className="material-symbols-outlined text-base">link</span>
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs"
        title="Delete task"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  );
}

function DraggableTaskRow({ task, linkedItem, onToggle, onDelete, onAssign }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
    data: { type: "task", task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-3 py-2 px-3 border border-kyar-border hover:border-black transition group ${
        isDragging ? "opacity-50 cursor-grabbing" : "cursor-grab"
      }`}
    >
      <span className="material-symbols-outlined text-gray-400 text-base">drag_indicator</span>
      <input
        type="checkbox"
        checked={task.checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-black"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1">
        <span className={`text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}>
          {task.label}
        </span>
        {linkedItem && (
          <span className="text-xs text-kyar-textTertiary block mt-0.5">
            &rarr; {linkedItem.name}
          </span>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAssign();
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-black text-xs"
        title="Assign to item"
      >
        <span className="material-symbols-outlined text-base">link</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs"
        title="Delete task"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  );
}
