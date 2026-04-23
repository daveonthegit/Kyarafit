import type { Doc, Id } from "convex/_generated/dataModel";

export type ConventionPlanEntry = Doc<"conventionDayPlans">;
export type ConventionPackingItem = Doc<"packingListItems"> & { checked: boolean };
export type ConventionWithDetails = Doc<"conventions"> & {
  plans: ConventionPlanEntry[];
  packing: ConventionPackingItem[];
};

export type ConventionFilter = "all" | "upcoming" | "past" | "archived";
export type ConventionSortBy = "startDate" | "name" | "location";
export type SortOrder = "asc" | "desc";

export function enumerateConventionDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const finalDay = new Date(`${endDate}T12:00:00`);

  while (cursor <= finalDay) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export function formatDateLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDateLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

export function getConventionDayHeading(dateString: string, index: number) {
  return `D${index + 1} · ${formatLongDateLabel(dateString)}`;
}

export function getDaysUntil(startDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${startDate}T12:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getCountdownMeta(startDate: string) {
  const days = getDaysUntil(startDate);
  if (days < 0) {
    return { label: `${Math.abs(days)}d ago`, tone: "muted" as const };
  }
  if (days === 0) {
    return { label: "Today", tone: "accent" as const };
  }
  if (days === 1) {
    return { label: "Tomorrow", tone: "accent" as const };
  }
  return { label: `${days}d`, tone: days <= 14 ? ("accent" as const) : ("default" as const) };
}

export function countPlannedBuilds(plans: ConventionPlanEntry[]) {
  return new Set(plans.filter((plan) => plan.buildId).map((plan) => plan.buildId as string)).size;
}

export function countPackingProgress(packing: ConventionPackingItem[]) {
  const total = packing.length;
  const checked = packing.filter((item) => item.checked).length;
  return { total, checked };
}

export function groupPackingByDate(items: ConventionPackingItem[]) {
  const general = items.filter((item) => !item.date);
  const byDate = new Map<string, ConventionPackingItem[]>();

  for (const item of items.filter((entry) => entry.date)) {
    const key = item.date as string;
    const list = byDate.get(key) ?? [];
    list.push(item);
    byDate.set(key, list);
  }

  return {
    general,
    byDate: Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)),
  };
}

export function filterAndSortConventions(
  conventions: ConventionWithDetails[],
  search: string,
  filter: ConventionFilter,
  sortBy: ConventionSortBy,
  order: SortOrder
) {
  const today = new Date().toISOString().slice(0, 10);
  const query = search.trim().toLowerCase();

  const filtered = conventions.filter((convention) => {
    const archived = convention.archived === true;
    if (filter === "archived") {
      if (!archived) return false;
    } else {
      if (archived) return false;
      if (filter === "upcoming" && convention.endDate < today) return false;
      if (filter === "past" && convention.endDate >= today) return false;
    }

    if (!query) return true;

    return [convention.name, convention.location ?? ""].some((value) =>
      value.toLowerCase().includes(query)
    );
  });

  const direction = order === "asc" ? 1 : -1;
  return [...filtered].sort((left, right) => {
    let result = 0;
    if (sortBy === "name") result = left.name.localeCompare(right.name);
    else if (sortBy === "location")
      result = (left.location ?? "").localeCompare(right.location ?? "");
    else result = left.startDate.localeCompare(right.startDate);
    return result * direction;
  });
}

export function resolveBuildForDate(
  plans: ConventionPlanEntry[],
  builds: {
    _id: Id<"builds">;
    name: string;
    character?: string;
    imageStorageId?: Id<"_storage">;
    imageUrl?: string;
    status?: string;
  }[],
  date: string
) {
  const plan = plans.find((entry) => entry.date === date);
  if (!plan?.buildId) return null;
  return builds.find((build) => build._id === plan.buildId) ?? null;
}
