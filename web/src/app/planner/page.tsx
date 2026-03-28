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
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar";
import type { CalendarDayData, CalendarEvent } from "@/components/ui/fullscreen-calendar";

type TodoView = "daily" | "events" | "calendar";

type PlannerTask = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  category: string;
  progressPercent: number;
  buildId?: Id<"builds">;
  buildName: string | null;
  conventionId?: Id<"conventions">;
  conventionName?: string | null;
  cosplayNodeId?: Id<"cosplayNodes">;
  packingListItemId?: string;
  dueDate?: string;
  priority?: number;
  blockedByCount?: number;
  overdue?: boolean;
};

type BuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTask[] };
type ConventionGroup = {
  conventionId: Id<"conventions">;
  conventionName: string;
  builds: BuildGroup[];
  packingTasks: PlannerTask[];
};

function buildTaskTree(
  tasks: PlannerTask[],
  conventionsList: Array<{ _id: Id<"conventions">; name: string }> | undefined
): { conventionGroups: ConventionGroup[]; standaloneBuilds: BuildGroup[] } {
  const conventionMap = new Map<
    Id<"conventions">,
    { conventionName: string; builds: Map<Id<"builds">, BuildGroup>; packingTasks: PlannerTask[] }
  >();
  const standaloneMap = new Map<Id<"builds">, BuildGroup>();

  const getConventionName = (conventionId: Id<"conventions">) =>
    conventionsList?.find((c) => c._id === conventionId)?.name ?? "Event";

  for (const task of tasks) {
    if (task.conventionId) {
      let group = conventionMap.get(task.conventionId);
      if (!group) {
        group = {
          conventionName: getConventionName(task.conventionId),
          builds: new Map(),
          packingTasks: [],
        };
        conventionMap.set(task.conventionId, group);
      }
      const isPackingTask =
        task.category === "pack" || Boolean(task.packingListItemId) || !task.buildId;
      if (isPackingTask) {
        group.packingTasks.push(task);
      } else {
        let buildGroup = group.builds.get(task.buildId!);
        if (!buildGroup) {
          buildGroup = { buildId: task.buildId!, buildName: task.buildName ?? "Build", tasks: [] };
          group.builds.set(task.buildId!, buildGroup);
        }
        buildGroup.tasks.push(task);
      }
    } else if (task.buildId) {
      let buildGroup = standaloneMap.get(task.buildId);
      if (!buildGroup) {
        buildGroup = { buildId: task.buildId, buildName: task.buildName ?? "Build", tasks: [] };
        standaloneMap.set(task.buildId, buildGroup);
      }
      buildGroup.tasks.push(task);
    }
    // Edge case: task has neither conventionId nor buildId (shouldn't happen for planner; skip or put in "Other")
  }

  const conventionGroups: ConventionGroup[] = Array.from(conventionMap.entries()).map(
    ([conventionId, g]) => ({
      conventionId,
      conventionName: g.conventionName,
      builds: Array.from(g.builds.values()).sort((a, b) => a.buildName.localeCompare(b.buildName)),
      packingTasks: g.packingTasks,
    })
  );
  conventionGroups.sort((a, b) => a.conventionName.localeCompare(b.conventionName));

  const standaloneBuilds = Array.from(standaloneMap.values()).sort((a, b) =>
    a.buildName.localeCompare(b.buildName)
  );

  return { conventionGroups, standaloneBuilds };
}

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
    const tab = searchParams.get("tab");
    if (tab === "events") setView("events");
    else if (tab === "calendar") setView("calendar");
  }, [searchParams]);

  const plannerTasks = useQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip");

  const filteredTasks = useMemo(() => {
    const list = plannerTasks ?? [];
    return filterByTimeframe(list, timeframe);
  }, [plannerTasks, timeframe]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // 1. Incomplete first (what's left to do at the top)
      const aDone = a.status === "done";
      const bDone = b.status === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      // 2. Due date ascending (soonest first; no date last)
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      // 3. By build name for stable grouping
      const nameCmp = (a.buildName ?? "").localeCompare(b.buildName ?? "");
      if (nameCmp !== 0) return nameCmp;
      // 4. Higher priority first, then title.
      if ((a.priority ?? 0) !== (b.priority ?? 0)) {
        return (b.priority ?? 0) - (a.priority ?? 0);
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredTasks]);

  const { deadlineApproaching, other } = useMemo(() => {
    const approaching: typeof sortedTasks = [];
    const rest: typeof sortedTasks = [];
    for (const t of sortedTasks) {
      if (isDueApproaching(t.dueDate)) approaching.push(t);
      else rest.push(t);
    }
    return { deadlineApproaching: approaching, other: rest };
  }, [sortedTasks]);

  const treeApproaching = useMemo(
    () => buildTaskTree(deadlineApproaching, conventions ?? undefined),
    [deadlineApproaching, conventions]
  );
  const treeOther = useMemo(
    () => buildTaskTree(other, conventions ?? undefined),
    [other, conventions]
  );
  const treeAll = useMemo(
    () => buildTaskTree(sortedTasks, conventions ?? undefined),
    [sortedTasks, conventions]
  );

  const calendarData = useMemo((): CalendarDayData[] => {
    const byDay = new Map<string, CalendarEvent[]>();
    const add = (day: Date, event: CalendarEvent) => {
      const key = day.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    };
    (plannerTasks ?? []).forEach((task) => {
      if (!task.dueDate) return;
      const day = new Date(task.dueDate + "T12:00:00");
      add(day, {
        id: task._id,
        name: task.title,
        time: "Due",
        datetime: task.dueDate + "T00:00:00",
        href: task.conventionId
          ? `/conventions/${task.conventionId}/packing`
          : `/build-detail?id=${task.buildId}`,
      });
    });
    (conventions ?? []).forEach((con) => {
      const start = new Date(con.startDate + "T12:00:00");
      add(start, {
        id: con._id,
        name: con.name,
        time: "Event",
        datetime: con.startDate + "T00:00:00",
        href: `/conventions/${con._id}`,
      });
    });
    return Array.from(byDay.entries()).map(([dateStr, events]) => ({
      day: new Date(dateStr + "T12:00:00"),
      events,
    }));
  }, [plannerTasks, conventions]);

  const checkedCount = useMemo(
    () => filteredTasks.filter((t) => t.status === "done").length,
    [filteredTasks]
  );
  const totalCount = filteredTasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const updateTask = useMutation(api.workflow.update);

  const handleToggle = async (taskId: Id<"workflowItems">, checked: boolean) => {
    if (!userId) return;
    try {
      await updateTask({ id: taskId, userId, status: checked ? "done" : "not_started" });
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
        title={view === "daily" ? dateLabel : view === "calendar" ? "Calendar" : "Circuit"}
        subtitle={view === "daily" ? weekdayLabel : undefined}
        sticky
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-6">
        <button
          type="button"
          onClick={() => setView("daily")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "daily"
              ? "bg-black text-white shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "daily"}
          aria-label="Daily view"
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setView("events")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "events"
              ? "bg-black text-white shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "events"}
          aria-label="Events view"
        >
          Events
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "calendar"
              ? "bg-black text-white shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "calendar"}
          aria-label="Calendar view"
        >
          Calendar
        </button>
      </div>

      <main className="flex-1 pb-24 lg:pb-8">
        {view === "calendar" ? (
          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <p className="text-sm text-kyar-textTertiary">Loading calendar...</p>
            ) : (
              <FullScreenCalendar data={calendarData} addHref="/builds" addLabel="Add task" />
            )}
          </div>
        ) : view === "daily" ? (
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
                        className={`min-h-[44px] px-4 py-2 text-[10px] uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
                          timeframe === tf
                            ? "border-black bg-black text-white shadow-md"
                            : "border-kyar-borderSubtle bg-kyar-surface text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
                        }`}
                        aria-pressed={timeframe === tf}
                      >
                        {tf === "all" ? "All" : tf === "today" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/builds"
                    className="min-h-[44px] inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-widest border border-black px-6 py-2.5 rounded-full hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
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
                          className="flex-1 min-w-[120px] h-3 max-w-xs bg-kyar-muted rounded-full overflow-hidden border border-kyar-borderSubtle"
                          role="progressbar"
                          aria-valuenow={checkedCount}
                          aria-valuemin={0}
                          aria-valuemax={totalCount}
                        >
                          <div
                            className="h-full bg-black rounded-full transition-[width] duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </SectionCard>

                    {deadlineApproaching.length > 0 && (
                      <SectionCard title="Deadline approaching" className="mb-8">
                        <PlannerTaskTree
                          tree={treeApproaching}
                          userId={userId}
                          onToggle={handleToggle}
                        />
                      </SectionCard>
                    )}

                    <SectionCard title={deadlineApproaching.length > 0 ? "Other tasks" : "Tasks"}>
                      <PlannerTaskTree
                        tree={deadlineApproaching.length > 0 ? treeOther : treeAll}
                        userId={userId}
                        onToggle={handleToggle}
                      />
                    </SectionCard>
                  </>
                )}
              </>
            )}
          </>
        ) : view === "events" ? (
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
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/conventions/${con._id}`}
                        className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-kyar-borderSubtle px-6 py-2.5 rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                      >
                        Plan
                      </Link>
                      <Link
                        href={`/conventions/${con._id}/packing`}
                        className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-kyar-borderSubtle px-6 py-2.5 rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                      >
                        Packing List
                      </Link>
                    </div>
                  </div>
                </SectionCard>
              ))
            )}
          </div>
        ) : null}
      </main>
    </WebAppShell>
  );
}

function PlannerTaskTree({
  tree,
  userId,
  onToggle,
}: {
  tree: { conventionGroups: ConventionGroup[]; standaloneBuilds: BuildGroup[] };
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => void;
}) {
  const { conventionGroups, standaloneBuilds } = tree;
  const hasConventions = conventionGroups.length > 0;
  const hasStandalone = standaloneBuilds.length > 0;
  if (!hasConventions && !hasStandalone) return null;

  return (
    <div className="space-y-1">
      {conventionGroups.map((convention) => (
        <details
          key={convention.conventionId}
          className="group border border-kyar-borderSubtle rounded-2xl overflow-hidden bg-kyar-surface shadow-sm"
        >
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] px-3 py-2.5 text-sm font-medium text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{convention.conventionName}</span>
            <Link
              href={`/conventions/${convention.conventionId}/packing`}
              className="text-[10px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <div className="pl-4 pr-2 pb-2 pt-0 border-t border-kyar-cardBorder space-y-1">
            {convention.builds.map((build) => (
              <details
                key={build.buildId}
                className="group/build border border-kyar-borderSubtle rounded-xl overflow-hidden bg-kyar-muted"
              >
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] px-3 py-2 text-sm text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open/build:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">{build.buildName}</span>
                </summary>
                <ul className="pl-4 pr-2 pb-2 pt-1 space-y-2 border-t border-kyar-cardBorder">
                  {build.tasks.map((task) => (
                    <li key={task._id}>
                      <PlannerTaskRow task={task} userId={userId} onToggle={onToggle} />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            {convention.packingTasks.length > 0 && (
              <details
                key={`packing-${convention.conventionId}`}
                className="group/pack border border-kyar-borderSubtle rounded-xl overflow-hidden bg-kyar-muted"
              >
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] px-3 py-2 text-sm text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open/pack:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">Packing</span>
                </summary>
                <ul className="pl-4 pr-2 pb-2 pt-1 space-y-2 border-t border-kyar-cardBorder">
                  {convention.packingTasks.map((task) => (
                    <li key={task._id}>
                      <PlannerTaskRow task={task} userId={userId} onToggle={onToggle} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </details>
      ))}
      {standaloneBuilds.map((build) => (
        <details
          key={build.buildId}
          className="group border border-kyar-borderSubtle rounded-2xl overflow-hidden bg-kyar-surface shadow-sm"
        >
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] px-3 py-2.5 text-sm font-medium text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{build.buildName}</span>
            <Link
              href={`/build-detail?id=${build.buildId}`}
              className="text-[10px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <ul className="pl-4 pr-2 pb-2 pt-2 space-y-2 border-t border-kyar-cardBorder">
            {build.tasks.map((task) => (
              <li key={task._id}>
                <PlannerTaskRow task={task} userId={userId} onToggle={onToggle} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function PlannerTaskRow({
  task,
  userId,
  onToggle,
}: {
  task: PlannerTask;
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => void;
}) {
  const contextHref = task.conventionId
    ? `/conventions/${task.conventionId}/packing`
    : task.buildId
      ? `/build-detail?id=${task.buildId}`
      : task.cosplayNodeId
        ? `/elements/${task.cosplayNodeId}`
        : "/planner";
  return (
    <div className="flex items-start gap-3 border border-kyar-borderSubtle rounded-xl p-4 bg-kyar-surface shadow-sm min-h-[44px] hover:border-kyar-text transition-colors">
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggle(task._id, task.status !== "done")}
        disabled={!userId}
        className="mt-1 rounded-full border-2 border-black bg-white w-6 h-6 min-w-[24px] min-h-[24px] focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 transition-transform active:scale-90 cursor-pointer checked:bg-black checked:border-black"
        aria-label={`Mark "${task.title}" as ${task.status === "done" ? "incomplete" : "complete"}`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`font-light tracking-tight ${task.status === "done" ? "line-through text-kyar-textTertiary" : "text-kyar-text"}`}
        >
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Link
            href={contextHref}
            className="text-[11px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
          >
            {task.buildName ?? task.conventionName ?? "Workflow"}
          </Link>
          <span className="text-[11px] uppercase tracking-widest text-kyar-textTertiary">
            {task.status.split("_").join(" ")}
          </span>
          {task.dueDate && (
            <span className="text-[11px] text-kyar-textTertiary">
              · {formatDueDate(task.dueDate)}
            </span>
          )}
          <span className="text-[11px] text-kyar-textTertiary">· {task.progressPercent}%</span>
          {task.blockedByCount ? (
            <span className="text-[11px] text-kyar-danger">· blocked by {task.blockedByCount}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
