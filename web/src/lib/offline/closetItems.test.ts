import { describe, it, expect } from "vitest";
import {
  filterAndSortClosetItems,
  closetCategories,
  type ClosetItemFields,
  type ClosetItemsView,
} from "@kyarafit/design-system/domain/closetItems";

const items: ClosetItemFields[] = [
  { _id: "1", name: "Blue Wig", category: "Wigs", tags: ["blue", "long"], _creationTime: 30 },
  { _id: "2", name: "Red Boots", category: "Footwear", tags: ["red"], _creationTime: 10 },
  { _id: "3", name: "Green Cloak", category: "Outerwear", _creationTime: 50 },
  { _id: "4", name: "Blue Gloves", category: "  Wigs  ", _creationTime: 40 },
];

function view(overrides: Partial<ClosetItemsView> = {}): ClosetItemsView {
  return {
    categoryFilter: "all",
    search: "",
    sortMode: "name",
    selectedIds: new Set(),
    ...overrides,
  };
}

describe("filterAndSortClosetItems", () => {
  it("should_return_all_items_sorted_by_name_by_default", () => {
    expect(filterAndSortClosetItems(items, view()).map((r) => r._id)).toEqual(["4", "1", "3", "2"]);
  });

  it("should_filter_by_trimmed_category", () => {
    expect(
      filterAndSortClosetItems(items, view({ categoryFilter: "Wigs" })).map((r) => r._id)
    ).toEqual(["4", "1"]);
  });

  it("should_match_search_on_name_category_and_tags_case_insensitively_and_trimmed", () => {
    expect(filterAndSortClosetItems(items, view({ search: "  BLUE " })).map((r) => r._id)).toEqual([
      "4",
      "1",
    ]);
    expect(filterAndSortClosetItems(items, view({ search: "red" })).map((r) => r._id)).toEqual([
      "2",
    ]);
  });

  it("should_sort_by_recency_descending", () => {
    expect(filterAndSortClosetItems(items, view({ sortMode: "recent" })).map((r) => r._id)).toEqual(
      ["3", "4", "1", "2"]
    );
  });

  it("should_put_selected_items_first_then_by_name", () => {
    const res = filterAndSortClosetItems(
      items,
      view({ sortMode: "selectedFirst", selectedIds: new Set(["2"]) })
    );
    expect(res.map((r) => r._id)).toEqual(["2", "4", "1", "3"]);
  });

  it("should_not_mutate_the_input_list", () => {
    const copy = [...items];
    filterAndSortClosetItems(items, view({ sortMode: "recent" }));
    expect(items).toEqual(copy);
  });
});

describe("closetCategories", () => {
  it("should_return_sorted_unique_trimmed_categories", () => {
    expect(closetCategories(items)).toEqual(["Footwear", "Outerwear", "Wigs"]);
  });

  it("should_ignore_blank_categories", () => {
    expect(closetCategories([{ _id: "x", name: "n", category: "   " }])).toEqual([]);
  });
});
