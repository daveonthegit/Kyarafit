import { describe, it, expect } from "vitest";
import {
  filterAndSortBuilds,
  type BuildListItem,
  type BuildListView,
} from "@kyarafit/design-system/domain/buildsList";

// Spec: PRODUCT_SPEC.md §4.3 — builds are local-first; filtering/sorting happen LOCALLY over the
// local store (not via server query args). Replaces the old server-arg `buildsListArgs` test.
const builds: BuildListItem[] = [
  { _id: "1", name: "Zelda", status: "wip", progressPercent: 40, budgetCents: 5000 },
  { _id: "2", name: "Aerith", status: "idea", progressPercent: 0, budgetCents: 12000 },
  { _id: "3", name: "Cloud", status: "ready", progressPercent: 100, budgetCents: 8000 },
  { _id: "4", name: "Bayonetta", status: "archived", progressPercent: 100, budgetCents: 3000 },
];

function view(overrides: Partial<BuildListView> = {}): BuildListView {
  return { tab: "all", search: "", sortBy: "name", order: "asc", ...overrides };
}

describe("filterAndSortBuilds (PRODUCT_SPEC §4.3)", () => {
  it("should_return_all_builds_for_the_all_tab", () => {
    expect(filterAndSortBuilds(builds, view({ tab: "all" })).map((b) => b._id)).toEqual([
      "2", // Aerith
      "4", // Bayonetta
      "3", // Cloud
      "1", // Zelda
    ]);
  });

  it("should_filter_current_tab_to_wip", () => {
    const res = filterAndSortBuilds(builds, view({ tab: "current" }));
    expect(res.map((b) => b._id)).toEqual(["1"]);
  });

  it("should_filter_planning_tab_to_idea", () => {
    expect(filterAndSortBuilds(builds, view({ tab: "planning" })).map((b) => b._id)).toEqual(["2"]);
  });

  it("should_filter_completed_tab_to_ready", () => {
    expect(filterAndSortBuilds(builds, view({ tab: "completed" })).map((b) => b._id)).toEqual([
      "3",
    ]);
  });

  it("should_match_search_on_name_case_insensitively_and_trimmed", () => {
    const res = filterAndSortBuilds(builds, view({ search: "  cl " }));
    expect(res.map((b) => b._id)).toEqual(["3"]);
  });

  it("should_sort_by_progress_descending", () => {
    const res = filterAndSortBuilds(builds, view({ sortBy: "progress", order: "desc" }));
    expect(res[0].progressPercent).toBe(100);
    expect(res[res.length - 1].progressPercent).toBe(0);
  });

  it("should_not_mutate_the_input_list", () => {
    const copy = [...builds];
    filterAndSortBuilds(builds, view({ sortBy: "budget", order: "desc" }));
    expect(builds).toEqual(copy);
  });
});
