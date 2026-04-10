"use client";

import { useCallback, useState } from "react";
import { EditorialProgressDonut } from "@/components/builds/EditorialBuildProgress";
import type { LandingTaskPreview } from "@/data/landingMock";

const completed = (tasks: LandingTaskPreview[]) => tasks.filter((t) => t.checked).length;

/**
 * Preview matching {@link ../../components/builds/TaskChecklist} construction block + task rows.
 * Data is static demo content from `@/data/mockAccount` — not loaded from Convex.
 */
export function LandingBuildTrackingMock({
  tasks,
  interactive = false,
}: {
  tasks: LandingTaskPreview[];
  interactive?: boolean;
}) {
  const [localTasks, setLocalTasks] = useState(() => tasks.map((t) => ({ ...t })));
  const displayTasks = interactive ? localTasks : tasks;

  const total = displayTasks.length;
  const done = completed(displayTasks);
  const barPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggleAt = useCallback(
    (index: number) => {
      if (!interactive) return;
      setLocalTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, checked: !t.checked } : t))
      );
    },
    [interactive]
  );

  return (
    <div className="space-y-6 rounded-3xl border border-kyar-borderSubtle bg-kyar-surface p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <EditorialProgressDonut progress={barPercent} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          <div className="font-sans-wide text-[10px] font-semibold uppercase tracking-[0.2em] text-kyar-textTertiary">
            Status
          </div>
          <div className="font-serif text-3xl text-kyar-text">In progress</div>
          <p className="text-sm text-kyar-textSecondary">Task-driven progress for every build.</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-kyar-borderSubtle pt-6">
        <div className="flex items-end justify-between text-[9px] font-medium uppercase tracking-[0.2em] text-kyar-text">
          <span>Construction progress</span>
          <span>{barPercent}%</span>
        </div>
        <div className="h-px w-full bg-kyar-borderSubtle">
          <div
            className="h-full bg-kyar-text transition-all duration-300"
            style={{ width: `${barPercent}%` }}
          />
        </div>
        <p className="text-xs text-kyar-textTertiary">
          {done} of {total} tasks complete
        </p>
      </div>

      <ul className="space-y-2" role="list" aria-label="Sample tasks">
        {displayTasks.map((task, i) => (
          <li
            key={`${task.label}-${i}`}
            className="flex flex-col gap-2 border border-kyar-border px-3 py-2 transition hover:border-kyar-text/50"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.checked}
                readOnly={!interactive}
                tabIndex={interactive ? 0 : -1}
                onChange={() => toggleAt(i)}
                className="h-4 w-4 accent-kyar-accent"
                aria-label={task.label}
              />
              <div className="min-w-0 flex-1">
                <span
                  className={`text-sm ${task.checked ? "text-kyar-textTertiary line-through" : "text-kyar-text"}`}
                >
                  {task.label}
                </span>
                {task.meta && (
                  <span className="mt-0.5 block text-xs text-kyar-textTertiary">{task.meta}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
