import { describe, it, expect } from "vitest";
import {
  reorderGallery,
  removeFromGallery,
  appendToGallery,
  setGalleryCaption,
  sortProgressUpdates,
  type GalleryItem,
  type ProgressUpdate,
} from "@kyarafit/design-system/domain/mediaGallery";

// Spec: PRODUCT_SPEC.md §4.3 (REQ-047/048). Pure gallery ordering/caption behavior that the
// reference- and process-photo sections delegate to. Replaces the prior non-tests that asserted
// component function arity / source text.
function gallery(): GalleryItem[] {
  return [
    { id: "a", sortOrder: 0, caption: "first" },
    { id: "b", sortOrder: 1 },
    { id: "c", sortOrder: 2, caption: "third" },
  ];
}

describe("reorderGallery (REQ-047/048)", () => {
  it("should_reorder_items_to_match_the_given_id_order", () => {
    const res = reorderGallery(gallery(), ["c", "a", "b"]);
    expect(res.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("should_not_mutate_the_input", () => {
    const items = gallery();
    reorderGallery(items, ["c", "b", "a"]);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("removeFromGallery (REQ-047/048)", () => {
  it("should_remove_the_item_and_resequence_sort_order_contiguously", () => {
    const res = removeFromGallery(gallery(), "b");
    expect(res.map((i) => i.id)).toEqual(["a", "c"]);
    expect(res.map((i) => i.sortOrder)).toEqual([0, 1]);
  });
});

describe("appendToGallery (REQ-047/048)", () => {
  it("should_append_with_the_next_sort_order", () => {
    const res = appendToGallery(gallery(), { id: "d", sortOrder: -1 });
    expect(res[res.length - 1].id).toBe("d");
    expect(res[res.length - 1].sortOrder).toBe(3);
  });
});

describe("setGalleryCaption (REQ-047/048)", () => {
  it("should_set_a_trimmed_caption", () => {
    const res = setGalleryCaption(gallery(), "b", "  hello  ");
    expect(res.find((i) => i.id === "b")?.caption).toBe("hello");
  });

  it("should_clear_caption_to_null_when_empty", () => {
    const res = setGalleryCaption(gallery(), "a", "   ");
    expect(res.find((i) => i.id === "a")?.caption ?? null).toBeNull();
  });
});

describe("sortProgressUpdates (REQ-049)", () => {
  const updates: ProgressUpdate[] = [
    { id: "1", createdAt: 100 },
    { id: "2", createdAt: 300 },
    { id: "3", createdAt: 200 },
  ];

  it("should_order_progress_updates_newest_first", () => {
    expect(sortProgressUpdates(updates).map((u) => u.id)).toEqual(["2", "3", "1"]);
  });

  it("should_not_mutate_the_input", () => {
    const copy = [...updates];
    sortProgressUpdates(updates);
    expect(updates).toEqual(copy);
  });
});
