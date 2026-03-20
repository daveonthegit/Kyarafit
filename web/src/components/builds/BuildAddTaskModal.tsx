"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";

type BuildAddTaskModalProps = {
  open: boolean;
  onClose: () => void;
  buildId: Id<"builds">;
  userId: string;
  /** Current task count for sort order */
  taskCount: number;
};

export function BuildAddTaskModal({
  open,
  onClose,
  buildId,
  userId,
  taskCount,
}: BuildAddTaskModalProps) {
  const createTask = useMutation(api.buildTasks.create);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sortOffset, setSortOffset] = useState(0);

  useEffect(() => {
    if (open) {
      setLabel("");
      setFeedback(null);
      setError(null);
      setSortOffset(0);
    }
  }, [open]);

  const add = async () => {
    if (!label.trim()) return;
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      await createTask({
        userId,
        buildId,
        label: label.trim(),
        sortOrder: taskCount + sortOffset,
      });
      setSortOffset((o) => o + 1);
      setLabel("");
      setFeedback("Task added — add another or tap Done.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add task");
    } finally {
      setPending(false);
    }
  };

  return (
    <BuildDetailModalShell
      open={open}
      onClose={onClose}
      title="Add tasks"
      titleId="build-add-task-modal-title"
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full px-6 py-2.5 bg-kyar-text text-white text-xs font-bold uppercase tracking-wider rounded-md"
        >
          Done
        </button>
      }
    >
      <p className="text-sm text-kyar-textSecondary mb-4">
        Add one task at a time. Each save keeps this window open for the next.
      </p>
      {feedback && (
        <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !pending && add()}
          placeholder="Task description…"
          className="flex-1 min-w-0 border border-kyar-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/30 focus:border-kyar-accent"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !label.trim()}
          className="shrink-0 px-5 py-2.5 bg-kyar-text text-white text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </BuildDetailModalShell>
  );
}
