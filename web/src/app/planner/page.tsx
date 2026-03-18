"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type TodoView = "daily" | "events";

type Timeframe = "all" | "today" | "week";

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDueApproaching(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  if (dueDate < TODAY) return false;
  const weekEnd = addDays(TODAY, 7);
  return dueDate <= weekEnd;
}

function isDueToday(dueDate: string | undefined): boolean {
  return dueDate === TODAY;
}

function filterByTimeframe<T extends { dueDate?: string }>(tasks: T[], timeframe: Timeframe): T[] {
  if (timeframe === "all") return tasks;
  if (timeframe === "today") return tasks.filter((t) => isDueToday(t.dueDate));
  const weekEnd = addDays(TODAY, 7);
  return tasks.filter((t) => t.dueDate && t.dueDate >= TODAY && t.dueDate <= weekEnd) as T[];
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (dateStr === TODAY) return "Today";
  const tomorrow = addDays(TODAY, 1);
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Planner() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<TodoView>("daily");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const { userId } = useCurrentUser();

  useEffect(() => {
    if (searchParams.get("tab") === "events") setView("events");
  }, [searchParams]);

  const plannerTasks = useQuery(api.buildTasks.listForPlanner, userId ? { userId } : "skip");
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip");

  const filteredTasks = useMemo(() => {
    const list = plannerTasks ?? [];
    return filterByTimeframe(list, timeframe);
  }, [plannerTasks, timeframe]);

  const { deadlineApproaching, other } = useMemo(() => {
    const approaching: typeof filteredTasks = [];
    const rest: typeof filteredTasks = [];
    for (const t of filteredTasks) {
      if (isDueApproaching(t.dueDate)) approaching.push(t);
      else rest.push(t);
    }
    return { deadlineApproaching: approaching, other: rest };
  }, [filteredTasks]);

  const checkedCount = useMemo(
    () => filteredTasks.filter((t) => t.checked).length,
    [filteredTasks]
  );
  const totalCount = filteredTasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const updateTask = useMutation(api.buildTasks.update);

  const handleToggle = async (taskId: Id<"buildTasks">, checked: boolean) => {
    if (!userId) return;
    try {
      await updateTask({ id: taskId, userId, checked });
    } catch {
      // Error surfaces via Convex; could add inline error state
    }
  };

  const isLoading = plannerTasks === undefined;
  const isLoadingConventions = conventions === undefined;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  return (
    <WebAppShell>
      <PageHeader
        title={view === "daily" ? dateLabel : "Circuit"}
        subtitle={view === "daily" ? weekdayLabel : undefined}
        sticky
      />
      <div className="flex gap-4 border-b border-kyar-cardBorder pb-4 mb-6">
        <button
          type="button"
          onClick={() => setView("daily")}
          className={`min-h-[44px] min-w-[44px] flex items-center text-[10px] uppercase tracking-[0.2em] font-bold px-3 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
            view === "daily"
              ? "border-b-2 border-black text-kyar-text"
              : "opacity-50 hover:opacity-100"
          }`}
          aria-pressed={view === "daily"}
          aria-label="Daily view"
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setView("events")}
          className={`min-h-[44px] min-w-[44px] flex items-center text-[10px] uppercase tracking-[0.2em] font-bold px-3 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
            view === "events"
              ? "border-b-2 border-black text-kyar-text"
              : "opacity-50 hover:opacity-100"
          }`}
          aria-pressed={view === "events"}
          aria-label="Events view"
        >
          Events
        </button>
      </div>

      <main className="flex-1 pb-24 lg:pb-8">
        {view === "daily" ? (
          <>
            {isLoading ? (
              <p className="text-sm text-kyar-textTertiary">Loading tasks...</p>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "today", "week"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        className={`min-h-[44px] px-4 py-2 text-[10px] uppercase tracking-wider rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
                          timeframe === tf
                            ? "border-black bg-black text-white"
                            : "border-kyar-cardBorder bg-kyar-surfaceWarm text-kyar-text hover:border-kyar-text"
                        }`}
                        aria-pressed={timeframe === tf}
                      >
                        {tf === "all" ? "All" : tf === "today" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/builds"
                    className="min-h-[44px] inline-flex items-center text-[10px] uppercase tracking-widest border border-kyar-border px-4 py-2.5 rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                  >
                    Add task
                  </Link>
                </div>

                {totalCount === 0 ? (
                  <SectionCard title="Tasks">
                    <p className="text-sm text-kyar-textTertiary mb-2">No tasks yet.</p>
                    <Link
                      href="/builds"
                      className="text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                    >
                      Open a build to add tasks
                    </Link>
                  </SectionCard>
                ) : (
                  <>
                    <SectionCard title="Progress" className="mb-8">
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <p className="text-lg font-medium text-kyar-text">
                          {checkedCount} of {totalCount} tasks
                        </p>
                        <div
                          className="flex-1 min-w-[120px] h-3 max-w-xs bg-kyar-mutedWarm rounded-sm overflow-hidden border border-kyar-cardBorder"
                          role="progressbar"
                          aria-valuenow={checkedCount}
                          aria-valuemin={0}
                          aria-valuemax={totalCount}
                        >
                          <div
                            className="h-full bg-black rounded-sm transition-[width] duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </SectionCard>

                    {deadlineApproaching.length > 0 && (
                      <SectionCard title="Deadline approaching" className="mb-8">
                        <ul className="space-y-2">
                          {deadlineApproaching.map((task) => (
                            <li key={task._id}>
                              <PlannerTaskRow task={task} userId={userId} onToggle={handleToggle} />
                            </li>
                          ))}
                        </ul>
                      </SectionCard>
                    )}

                    <SectionCard title={deadlineApproaching.length > 0 ? "Other tasks" : "Tasks"}>
                      <ul className="space-y-2">
                        {(deadlineApproaching.length > 0 ? other : filteredTasks).map((task) => (
                          <li key={task._id}>
                            <PlannerTaskRow task={task} userId={userId} onToggle={handleToggle} />
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {isLoadingConventions ? (
              <p className="text-sm text-kyar-textTertiary">Loading events…</p>
            ) : !conventions || conventions.length === 0 ? (
              <SectionCard title="Events">
                <p className="text-sm text-kyar-textTertiary mb-2">No events yet.</p>
                <Link
                  href="/conventions"
                  className="text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                >
                  Create an event
                </Link>
              </SectionCard>
            ) : (
              conventions.map((con) => (
                <SectionCard key={con._id} title={con.name}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs text-kyar-meta">
                      {new Date(con.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(con.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        href={`/conventions/${con._id}`}
                        className="min-h-[44px] inline-flex items-center text-[10px] uppercase tracking-widest border border-kyar-border px-4 py-2.5 rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                      >
                        Plan
                      </Link>
                      <Link
                        href={`/conventions/${con._id}/packing`}
                        className="min-h-[44px] inline-flex items-center text-[10px] uppercase tracking-widest border border-kyar-border px-4 py-2.5 rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                      >
                        Packing List
                      </Link>
                    </div>
                  </div>
                </SectionCard>
              ))
            )}
          </div>
        )}
      </main>
    </WebAppShell>
  );
}

function PlannerTaskRow({
  task,
  userId,
  onToggle,
}: {
  task: {
    _id: Id<"buildTasks">;
    label: string;
    checked: boolean;
    buildId?: Id<"builds">;
    buildName: string;
    conventionId?: Id<"conventions">;
    dueDate?: string;
  };
  userId: string | null;
  onToggle: (id: Id<"buildTasks">, checked: boolean) => void;
}) {
  const contextHref = task.conventionId
    ? `/conventions/${task.conventionId}/packing`
    : `/build-detail?id=${task.buildId}`;
  return (
    <div className="flex items-start gap-3 border border-kyar-cardBorder rounded-sm p-3 bg-kyar-surfaceWarm min-h-[44px]">
      <input
        type="checkbox"
        checked={task.checked}
        onChange={() => onToggle(task._id, !task.checked)}
        disabled={!userId}
        className="mt-1 rounded-sm border-kyar-border w-5 h-5 min-w-[20px] min-h-[20px] focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 focus:ring-offset-kyar-bgWarm"
        aria-label={`Mark "${task.label}" as ${task.checked ? "incomplete" : "complete"}`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`font-light tracking-tight ${task.checked ? "line-through text-kyar-textTertiary" : "text-kyar-text"}`}
        >
          {task.label}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Link
            href={contextHref}
            className="text-[11px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
          >
            {task.buildName}
          </Link>
          {task.dueDate && (
            <span className="text-[11px] text-kyar-textTertiary">
              · {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
