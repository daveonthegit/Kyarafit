"use client";

import { useState, useEffect } from "react";
import { useOfflineMutation } from "@/lib/offline";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Sheet } from "@/components/ui/sheet";
import { PhotoPill } from "@/components/ui/PhotoPill";

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
  const createTask = useOfflineMutation(api.buildTasks.create);
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Add tasks"
      titleId="build-add-task-modal-title"
      surface="glass"
      footer={
        <PhotoPill type="button" variant="outline" onClick={onClose} className="w-full">
          Done
        </PhotoPill>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-media-fg-70">
        Add one task at a time. Each save keeps this window open for the next.
      </p>
      {feedback && (
        <p className="mb-3 rounded-[10px] bg-on-glass-chip-done-bg px-3 py-2 text-[13px] text-on-glass-chip-done-fg">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-on-glass-danger" role="alert">
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
          className="glass-field min-h-[44px] min-w-0 flex-1 px-3 py-2.5 text-[13px]"
        />
        <PhotoPill
          type="button"
          variant="solid"
          icon="add"
          onClick={add}
          disabled={pending || !label.trim()}
        >
          {pending ? "Adding…" : "Add"}
        </PhotoPill>
      </div>
    </Sheet>
  );
}
