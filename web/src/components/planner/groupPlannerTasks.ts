import { addDays, format, parseISO } from "date-fns";

/**
 * Pure presentation helpers for the Planner's Daily view (ref 3b).
 *
 * The planner groups the tasks it already loaded into three time buckets —
 * Today / This week / Later — and optionally narrows them to one build. No
 * data is fetched or written here; everything is client-side grouping.
 */

export type PlannerTimeGroup = "today" | "week" | "later";

export const PLANNER_TIME_GROUPS: readonly PlannerTimeGroup[] = ["today", "week", "later"];

/** Days after today (inclusive) that still count as "This week". */
export const PLANNER_WEEK_HORIZON_DAYS = 7;

export type GroupablePlannerTask = {
  title: string;
  status: string;
  dueDate?: string | null;
  sortOrder?: number;
  buildId?: string | null;
  buildName?: string | null;
};

export type PlannerBuildFilter = { buildId: string; buildName: string };

/** Local calendar date as `YYYY-MM-DD` (never UTC — evenings must not roll over). */
export function plannerLocalDate(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function addDaysToPlannerDate(day: string, days: number): string {
  return format(addDays(parseISO(day), days), "yyyy-MM-dd");
}

function dueDay(task: Pick<GroupablePlannerTask, "dueDate">): string | null {
  return task.dueDate ? task.dueDate.slice(0, 10) : null;
}

/** Done or cancelled tasks are closed: never overdue, never keep a build tab alive. */
export function isPlannerTaskClosed(status: string): boolean {
  return status === "done" || status === "cancelled";
}

/** An open task whose due date is before today. */
export function isPlannerTaskOverdue(
  task: Pick<GroupablePlannerTask, "dueDate" | "status">,
  today: string
): boolean {
  const due = dueDay(task);
  return due != null && due < today && !isPlannerTaskClosed(task.status);
}

/**
 * Which bucket a task belongs to.
 * - Today: due today, or open and overdue (flagged by the row).
 * - This week: due within the next {@link PLANNER_WEEK_HORIZON_DAYS} days.
 * - Later: due further out, no due date, or closed with a past due date
 *   (history should not pile up in Today).
 */
export function plannerTimeGroupFor(
  task: Pick<GroupablePlannerTask, "dueDate" | "status">,
  today: string
): PlannerTimeGroup {
  const due = dueDay(task);
  if (!due) return "later";
  if (due === today) return "today";
  if (due < today) return isPlannerTaskClosed(task.status) ? "later" : "today";
  if (due <= addDaysToPlannerDate(today, PLANNER_WEEK_HORIZON_DAYS)) return "week";
  return "later";
}

/** Soonest due first (no date last), then the user's manual order, then title. */
export function comparePlannerTasksByDue(a: GroupablePlannerTask, b: GroupablePlannerTask): number {
  const dateA = dueDay(a) ?? "9999-12-31";
  const dateB = dueDay(b) ?? "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  return a.title.localeCompare(b.title);
}

export function comparePlannerTasksByOrder(a: GroupablePlannerTask, b: GroupablePlannerTask): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || comparePlannerTasksByDue(a, b);
}

/** Narrow to one build; `null` keeps every task (the "All" tab). */
export function filterPlannerTasksByBuild<T extends GroupablePlannerTask>(
  tasks: readonly T[],
  buildId: string | null
): T[] {
  if (buildId == null) return [...tasks];
  return tasks.filter((task) => task.buildId === buildId);
}

/**
 * Group tasks into Today / This week / Later after applying the build filter.
 * Each bucket is sorted with {@link comparePlannerTasksByOrder}.
 */
export function groupPlannerTasks<T extends GroupablePlannerTask>(
  tasks: readonly T[],
  { today, buildId = null }: { today: string; buildId?: string | null }
): Record<PlannerTimeGroup, T[]> {
  const groups: Record<PlannerTimeGroup, T[]> = { today: [], week: [], later: [] };
  for (const task of filterPlannerTasksByBuild(tasks, buildId)) {
    groups[plannerTimeGroupFor(task, today)].push(task);
  }
  for (const key of PLANNER_TIME_GROUPS) groups[key].sort(comparePlannerTasksByOrder);
  return groups;
}

/**
 * Build filter tabs (after "All"): every build with at least one open task,
 * sorted by name. The currently selected build keeps its tab while it still
 * has any task, so checking off its last open task doesn't yank the view.
 */
export function listPlannerBuildFilters(
  tasks: readonly GroupablePlannerTask[],
  selectedBuildId: string | null = null
): PlannerBuildFilter[] {
  const builds = new Map<string, string>();
  for (const task of tasks) {
    if (!task.buildId) continue;
    const keep = !isPlannerTaskClosed(task.status) || task.buildId === selectedBuildId;
    if (keep && !builds.has(task.buildId)) builds.set(task.buildId, task.buildName ?? "");
  }
  return Array.from(builds, ([buildId, buildName]) => ({ buildId, buildName })).sort((a, b) =>
    a.buildName.localeCompare(b.buildName)
  );
}
