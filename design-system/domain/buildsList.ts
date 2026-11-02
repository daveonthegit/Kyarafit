/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per PRODUCT_SPEC.md §4.3 + DATA_AND_SYNC.md
 * (builds are local-first; filtering/sorting happen LOCALLY over the local store, not via server
 * query args). Replaces the old `buildsListArgs` server-arg builder.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export type BuildTab = "all" | "current" | "planning" | "completed" | "archived";
export type BuildSortBy = "name" | "progress" | "targetDate" | "budget";
export type SortOrder = "asc" | "desc";

/** Canonical ordered set of build tabs for the builds list UI. Labels are presentation (platform-side). */
export const BUILD_TABS: readonly BuildTab[] = [
  "all",
  "current",
  "planning",
  "completed",
  "archived",
];

export interface BuildListItem {
  _id: string;
  name: string;
  status: string;
  progressPercent?: number | null;
  targetDate?: string | null;
  budgetCents?: number | null;
  character?: string | null;
}

export interface BuildListView {
  tab: BuildTab;
  search: string;
  sortBy: BuildSortBy;
  order: SortOrder;
}

const TAB_STATUS: Record<Exclude<BuildTab, "all">, string> = {
  current: "wip",
  planning: "idea",
  completed: "ready",
  archived: "archived",
};

function compareByName(a: BuildListItem, b: BuildListItem): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

function compareBuilds(a: BuildListItem, b: BuildListItem, sortBy: BuildSortBy): number {
  switch (sortBy) {
    case "name":
      return compareByName(a, b);
    case "progress":
      return (a.progressPercent ?? 0) - (b.progressPercent ?? 0);
    case "budget":
      return (a.budgetCents ?? 0) - (b.budgetCents ?? 0);
    case "targetDate": {
      const av = a.targetDate ?? "";
      const bv = b.targetDate ?? "";
      return av.localeCompare(bv);
    }
    default:
      return 0;
  }
}

/**
 * Filter + sort a build list locally. Tab maps to a status filter ("all" = no filter); search
 * matches name/character (case-insensitive, trimmed); sort by the chosen field + order, with a
 * stable tiebreak by name. Pure and deterministic.
 */
export function filterAndSortBuilds(builds: BuildListItem[], view: BuildListView): BuildListItem[] {
  const { tab, search, sortBy, order } = view;

  let result = builds.slice();

  if (tab !== "all") {
    const status = TAB_STATUS[tab];
    result = result.filter((b) => b.status === status);
  }

  const needle = search.trim().toLowerCase();
  if (needle.length > 0) {
    result = result.filter((b) => {
      const haystacks = [b.name];
      if (b.character) {
        haystacks.push(b.character);
      }
      return haystacks.some((value) => value.toLowerCase().includes(needle));
    });
  }

  const direction = order === "desc" ? -1 : 1;
  result.sort((a, b) => {
    const primary = compareBuilds(a, b, sortBy);
    if (primary !== 0) {
      return primary * direction;
    }
    return compareByName(a, b);
  });

  return result;
}
