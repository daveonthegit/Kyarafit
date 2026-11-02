import { describe, it, expect } from "vitest";
import {
  regeneratePackingList,
  type PackingItem,
} from "@kyarafit/design-system/domain/packingList";

// Spec: PRODUCT_SPEC.md §4.4 (REQ-053). Regenerating a packing list preserves manual items and the
// checked state of generated items that still apply.
function existing(): PackingItem[] {
  return [
    { id: "g1", key: "wig", label: "Wig", source: "generated", checked: true },
    { id: "g2", key: "boots", label: "Boots", source: "generated", checked: false },
    { id: "m1", key: "tape", label: "Cosplay tape", source: "manual", checked: true },
  ];
}

// Newly generated set: wig persists, boots removed, sword added.
function generated(): PackingItem[] {
  return [
    { id: "n1", key: "wig", label: "Wig", source: "generated", checked: false },
    { id: "n2", key: "sword", label: "Sword", source: "generated", checked: false },
  ];
}

describe("regeneratePackingList (REQ-053)", () => {
  it("should_preserve_manual_items_and_their_checked_state", () => {
    const result = regeneratePackingList(existing(), generated());
    const manual = result.find((i) => i.key === "tape");
    expect(manual).toBeDefined();
    expect(manual?.source).toBe("manual");
    expect(manual?.checked).toBe(true);
  });

  it("should_carry_over_checked_state_for_persisting_generated_items", () => {
    const result = regeneratePackingList(existing(), generated());
    expect(result.find((i) => i.key === "wig")?.checked).toBe(true);
  });

  it("should_drop_generated_items_no_longer_produced", () => {
    const result = regeneratePackingList(existing(), generated());
    expect(result.find((i) => i.key === "boots")).toBeUndefined();
  });

  it("should_add_new_generated_items_unchecked", () => {
    const result = regeneratePackingList(existing(), generated());
    expect(result.find((i) => i.key === "sword")?.checked).toBe(false);
  });

  it("should_not_mutate_the_input", () => {
    const input = existing();
    const copy = JSON.parse(JSON.stringify(input));
    regeneratePackingList(input, generated());
    expect(input).toEqual(copy);
  });
});
