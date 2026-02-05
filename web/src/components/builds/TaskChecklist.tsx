"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDraggable } from "@dnd-kit/core";
import { createBuildTask, updateBuildTask, deleteBuildTask } from "@/lib/api/builds";

export interface BuildTask {
  id: string;
  buildId: string;
  label: string;
  closetItemId?: string | null;
  sortOrder: number;
  checked: boolean;
}

interface TaskChecklistProps {
  buildId: string;
  tasks: BuildTask[];
  onTaskAssign?: (taskId: string, closetItemId: string | null) => void;
  enableDragDrop?: boolean;
}

export function TaskChecklist({
  buildId,
  tasks,
  onTaskAssign,
  enableDragDrop = false,
}: TaskChecklistProps) {
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const queryClient = useQueryClient();

  // Calculate progress
  const completedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sort tasks by sortOrder
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: (label: string) => createBuildTask(buildId, { label, sortOrder: tasks.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-tasks", buildId] });
      setNewTaskLabel("");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, checked }: { taskId: string; checked: boolean }) =>
      updateBuildTask(buildId, taskId, { checked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-tasks", buildId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteBuildTask(buildId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-tasks", buildId] });
    },
  });

  const handleToggleTask = async (taskId: string, checked: boolean) => {
    updateTaskMutation.mutate({ taskId, checked });
  };

  const handleAddTask = async () => {
    if (!newTaskLabel.trim()) return;
    createTaskMutation.mutate(newTaskLabel.trim());
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    deleteTaskMutation.mutate(taskId);
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
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

      {/* Task List */}
      <div className="space-y-2">
        {sortedTasks.map((task) =>
          enableDragDrop ? (
            <DraggableTaskRow
              key={task.id}
              task={task}
              onToggle={(checked) => handleToggleTask(task.id, checked)}
              onDelete={() => handleDeleteTask(task.id)}
            />
          ) : (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(checked) => handleToggleTask(task.id, checked)}
              onDelete={() => handleDeleteTask(task.id)}
            />
          )
        )}

        {sortedTasks.length === 0 && (
          <p className="text-sm text-kyar-textTertiary text-center py-8">
            No tasks yet. Add your first task below.
          </p>
        )}
      </div>

      {/* Add Task Form */}
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
          disabled={!newTaskLabel.trim() || createTaskMutation.isPending}
          className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {createTaskMutation.isPending ? "Adding..." : "Add"}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => {
            sortedTasks.forEach((t) => !t.checked && handleToggleTask(t.id, true));
          }}
          className="flex-1 border border-kyar-border hover:border-black py-2 text-xs font-semibold uppercase tracking-wider"
        >
          Mark All Complete
        </button>
        <button
          onClick={() => {
            if (onTaskAssign) {
              // TODO: Open assignment UI
            }
          }}
          className="flex-1 border border-kyar-border hover:border-black py-2 text-xs font-semibold uppercase tracking-wider"
        >
          Assign to Items
        </button>
      </div>
    </div>
  );
}

// Regular task row (non-draggable)
interface TaskRowProps {
  task: BuildTask;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

function TaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 border border-kyar-border hover:border-black transition group">
      <input
        type="checkbox"
        checked={task.checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 accent-black"
      />
      <span
        className={`flex-1 text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}
      >
        {task.label}
      </span>
      {task.closetItemId && (
        <span className="text-xs text-kyar-textTertiary uppercase tracking-wider">Assigned</span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  );
}

// Draggable task row
function DraggableTaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
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
      <span
        className={`flex-1 text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}
      >
        {task.label}
      </span>
      {task.closetItemId && (
        <span className="text-xs text-kyar-textTertiary uppercase tracking-wider">Assigned</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs"
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  );
}
