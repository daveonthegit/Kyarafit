/**
 * Pure helper to build api.builds.list arguments from UI state (parity with web [`web/src/lib/buildsListArgs.ts`](../../../web/src/lib/buildsListArgs.ts)).
 */
import type { BuildStatus } from "@kyarafit/design-system/types";

export type TabFilter = "all" | "current" | "planning" | "completed" | "archived";
export type SortBy = "name" | "progress" | "targetDate" | "budget";
export type SortOrder = "asc" | "desc";

const TAB_OPTIONS: { value: TabFilter; label: string }[] = [
  { value: "all", label: "All builds" },
  { value: "current", label: "Current (in progress)" },
  { value: "planning", label: "Planning / idea" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function statusForTab(tab: TabFilter): BuildStatus | undefined {
  switch (tab) {
    case "all":
      return undefined;
    case "current":
      return "wip";
    case "planning":
      return "idea";
    case "completed":
      return "ready";
    case "archived":
      return "archived";
  }
}

export function getTabFilterOptions(): { value: TabFilter; label: string }[] {
  return TAB_OPTIONS;
}

export interface BuildListArgsParams {
  userId: string | null;
  activeTab: TabFilter;
  search: string;
  sortBy: SortBy;
  order: SortOrder;
}

export type BuildListArgs =
  | { userId: string; status?: BuildStatus; search?: string; sortBy: SortBy; order: SortOrder }
  | "skip";

export function buildListArgs(params: BuildListArgsParams): BuildListArgs {
  const { userId, activeTab, search, sortBy, order } = params;
  if (!userId) return "skip";
  const status = statusForTab(activeTab);
  return {
    userId,
    status,
    search: search.trim() || undefined,
    sortBy,
    order,
  };
}
