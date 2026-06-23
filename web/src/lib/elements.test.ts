import { describe, it, expect } from "vitest";
import {
  normalizeElementCostCents,
  deriveElementProgressPercent,
  wouldCreateElementCycle,
  elementSearchText,
  duplicateElementForBuild,
} from "@kyarafit/design-system/domain/elements";

// Spec: PRODUCT_SPEC.md §4.2 (REQ-040/41/44). Retargets the surviving, valuable behaviors from the
// deleted cosplayNodes-graph tests (cosplayGraph.test.ts / cosplayUi.test.ts) onto the canonical
// Element model. The old `material` nodeType + link-rule semantics are intentionally dropped.

describe("normalizeElementCostCents (REQ-044)", () => {
  it("should_multiply_unit_cost_by_quantity_for_per_unit_pricing", () => {
    expect(
      normalizeElementCostCents({ pricingMode: "per_unit", unitCostCents: 275, quantity: 3 })
    ).toBe(825);
  });

  it("should_use_direct_cost_for_total_pricing", () => {
    expect(normalizeElementCostCents({ pricingMode: "total", directCostCents: 1499 })).toBe(1499);
  });
});

describe("deriveElementProgressPercent (REQ-046)", () => {
  it("should_compute_progress_from_child_and_task_completion_units", () => {
    expect(
      deriveElementProgressPercent({
        childBuckets: ["complete", "incomplete"],
        taskCount: 2,
        completedTaskCount: 1,
      })
    ).toBe(50);
  });

  it("should_fall_back_to_own_bucket_when_no_children_or_tasks", () => {
    expect(deriveElementProgressPercent({ ownBucket: "in_progress" })).toBe(50);
    expect(deriveElementProgressPercent({ ownBucket: "complete" })).toBe(100);
  });
});

describe("wouldCreateElementCycle (REQ-041)", () => {
  const tree: Record<string, string[]> = {
    wig: ["fiber", "guide"],
    fiber: ["adhesive"],
    guide: [],
    adhesive: [],
  };
  const getChildren = async (id: string) => tree[id] ?? [];

  it("should_detect_a_cycle_when_reparenting_under_a_descendant", async () => {
    await expect(wouldCreateElementCycle("adhesive", "wig", getChildren)).resolves.toBe(true);
  });

  it("should_allow_reparenting_that_does_not_create_a_cycle", async () => {
    await expect(wouldCreateElementCycle("wig", "adhesive", getChildren)).resolves.toBe(false);
  });
});

describe("duplicateElementForBuild (REQ-042)", () => {
  const source = {
    id: "e1",
    buildId: "b1",
    parentElementId: "p1",
    name: "Wig",
    category: "wig",
    unitCostCents: 500,
  };

  it("should_copy_into_the_target_build_at_root_as_an_independent_element", () => {
    const dup = duplicateElementForBuild(source, "b2");
    expect(dup.buildId).toBe("b2");
    expect(dup.parentElementId).toBeNull();
    expect(dup.name).toBe("Wig");
    expect(dup.category).toBe("wig");
    expect((dup as Record<string, unknown>).id).toBeUndefined();
  });

  it("should_not_mutate_the_source_element", () => {
    duplicateElementForBuild(source, "b2");
    expect(source.buildId).toBe("b1");
    expect(source.parentElementId).toBe("p1");
  });
});

describe("elementSearchText", () => {
  it("should_build_lowercased_searchable_text_from_metadata", () => {
    const text = elementSearchText({
      name: "EVA Foam",
      category: "material",
      tags: ["armor", "blue"],
      notes: "Main body sheets",
    });
    expect(text).toContain("eva foam");
    expect(text).toContain("armor");
    expect(text).toContain("material");
  });
});
