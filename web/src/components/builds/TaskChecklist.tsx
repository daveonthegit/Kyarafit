"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
}

export function TaskChecklist({ buildId, tasks, onTaskAssign }: TaskChecklistProps) {
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  // Calculate progress
  const completedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sort tasks by sortOrder
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleToggleTask = async (taskId: string, checked: boolean) => {
    // TODO: Implement API call to update task
    // For now, update optimistically
    queryClient.setQueryData(["build", buildId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.map((t: BuildTask) => (t.id === taskId ? { ...t, checked } : t)),
      };
    });
  };

  const handleAddTask = async () => {
    if (!newTaskLabel.trim()) return;

    setIsAdding(true);
    try {
      // TODO: Implement API call to create task
      // For now, just reset the form
      setNewTaskLabel("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;

    // TODO: Implement API call to delete task
    queryClient.setQueryData(["build", buildId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.filter((t: BuildTask) => t.id !== taskId),
      };
    });
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
        {sortedTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 py-2 px-3 border border-kyar-border hover:border-black transition group"
          >
            <input
              type="checkbox"
              checked={task.checked}
              onChange={(e) => handleToggleTask(task.id, e.target.checked)}
              className="w-4 h-4 accent-black"
            />
            <span
              className={`flex-1 text-sm ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}
            >
              {task.label}
            </span>
            {task.closetItemId && (
              <span className="text-xs text-kyar-textTertiary uppercase tracking-wider">
                Assigned
              </span>
            )}
            <button
              onClick={() => handleDeleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 text-xs"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        ))}

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
          disabled={!newTaskLabel.trim() || isAdding}
          className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {isAdding ? "Adding..." : "Add"}
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
