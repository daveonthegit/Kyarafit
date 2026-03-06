"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
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
      <header className="pt-16 pb-8">
        <div className="flex gap-6 mb-8">
          <button
            type="button"
            onClick={() => setView("daily")}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-1 ${view === "daily" ? "border-b-2 border-black" : "opacity-30"}`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setView("events")}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-1 ${view === "events" ? "border-b-2 border-black" : "opacity-30"}`}
          >
            Events
          </button>
        </div>
        {view === "daily" ? (
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h1 className="font-serif text-5xl font-bold italic tracking-tighter">{dateLabel}</h1>
            <span className="text-[11px] uppercase tracking-widest opacity-60">{weekdayLabel}</span>
          </div>
        ) : (
          <h1 className="font-serif text-5xl font-bold italic tracking-tighter">Circuit</h1>
        )}
      </header>

      <main className="flex-1">
        {view === "daily" ? (
          <>
            {isLoading ? (
              <p className="text-sm text-kyar-textTertiary">Loading tasks...</p>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-4">
                  <div className="flex gap-2">
                    {(["all", "today", "week"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        className={`text-[10px] uppercase tracking-wider px-2 py-1 border ${timeframe === tf ? "border-black bg-black text-white" : "border-kyar-borderSubtle"}`}
                      >
                        {tf === "all" ? "All" : tf === "today" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/builds"
                    className="text-[10px] uppercase tracking-widest border border-black/20 px-3 py-1"
                  >
                    Add task
                  </Link>
                </div>

                {totalCount === 0 ? (
                  <section className="mb-16">
                    <p className="text-sm text-kyar-textTertiary mb-2">No tasks yet.</p>
                    <Link href="/builds" className="text-sm underline">
                      Open a build to add tasks
                    </Link>
                  </section>
                ) : (
                  <>
                    <section className="mb-8">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-kyar-textTertiary mb-2">
                        Progress
                      </p>
                      <p className="text-lg font-medium">
                        {checkedCount} of {totalCount} tasks
                      </p>
                      <div className="mt-2 h-2 w-full max-w-xs bg-kyar-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-kyar-primary rounded transition-[width]"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </section>

                    {deadlineApproaching.length > 0 && (
                      <section className="mb-16">
                        <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-6 border-b border-black pb-2 inline-block">
                          Deadline approaching
                        </h2>
                        <div className="space-y-4">
                          {deadlineApproaching.map((task) => (
                            <PlannerTaskRow
                              key={task._id}
                              task={task}
                              userId={userId}
                              onToggle={handleToggle}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="mb-16">
                      <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-6 border-b border-black pb-2 inline-block">
                        {deadlineApproaching.length > 0 ? "Other tasks" : "Tasks"}
                      </h2>
                      <div className="space-y-4">
                        {(deadlineApproaching.length > 0 ? other : filteredTasks).map((task) => (
                          <PlannerTaskRow
                            key={task._id}
                            task={task}
                            userId={userId}
                            onToggle={handleToggle}
                          />
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <section className="space-y-10">
            {isLoadingConventions ? (
              <p className="text-sm text-kyar-textTertiary">Loading events…</p>
            ) : !conventions || conventions.length === 0 ? (
              <>
                <p className="text-sm text-kyar-textTertiary mb-2">No events yet.</p>
                <Link href="/conventions" className="text-sm underline">
                  Create an event
                </Link>
              </>
            ) : (
              conventions.map((con) => (
                <div key={con._id} className="border-b border-gray-100 pb-6 group">
                  <div className="flex justify-between items-end mb-2">
                    <Link
                      href={`/conventions/${con._id}`}
                      className="font-serif text-2xl italic font-bold hover:underline"
                    >
                      {con.name}
                    </Link>
                    <span className="text-[10px] opacity-40">
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
                  </div>
                  <div className="flex gap-4">
                    <Link
                      href={`/conventions/${con._id}`}
                      className="text-[9px] uppercase tracking-widest border border-black/10 px-3 py-1"
                    >
                      Plan
                    </Link>
                    <Link
                      href={`/conventions/${con._id}/packing`}
                      className="text-[9px] uppercase tracking-widest border border-black/10 px-3 py-1"
                    >
                      Packing List
                    </Link>
                  </div>
                </div>
              ))
            )}
          </section>
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
    <div className="flex items-start gap-3 border border-kyar-borderSubtle p-3 bg-white">
      <input
        type="checkbox"
        checked={task.checked}
        onChange={() => onToggle(task._id, !task.checked)}
        disabled={!userId}
        className="mt-1 rounded border-kyar-borderSubtle"
        aria-label={`Mark "${task.label}" as ${task.checked ? "incomplete" : "complete"}`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`font-light tracking-tight ${task.checked ? "line-through text-kyar-textTertiary" : ""}`}
        >
          {task.label}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Link
            href={contextHref}
            className="text-[11px] uppercase tracking-widest opacity-70 hover:underline"
          >
            {task.buildName}
          </Link>
          {task.dueDate && (
            <span className="text-[11px] text-kyar-textTertiary">
              • {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
