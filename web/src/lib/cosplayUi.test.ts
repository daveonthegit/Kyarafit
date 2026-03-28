import { describe, expect, test } from "vitest";
import {
  formatCostSummary,
  formatNodeStatus,
  formatNodeTypeLabel,
  nodeMatchesSubstate,
  nodeSearchText,
} from "./cosplayUi";

describe("cosplayUi", () => {
  test("formats node type labels", () => {
    expect(formatNodeTypeLabel("element")).toBe("Element");
    expect(formatNodeTypeLabel("material")).toBe("Material");
  });

  test("formats element and material status labels", () => {
    expect(
      formatNodeStatus({
        nodeType: "element",
        buildStatus: "wip",
        overallBucket: "in_progress",
      })
    ).toBe("WIP");
    expect(
      formatNodeStatus({
        nodeType: "material",
        materialStatus: "in_use",
        overallBucket: "in_progress",
      })
    ).toBe("In use");
  });

  test("matches substates across element and material state dimensions", () => {
    expect(
      nodeMatchesSubstate({
        _id: "1",
        nodeType: "element",
        name: "Wig",
        buildStatus: "wip",
      }, "wip")
    ).toBe(true);
    expect(
      nodeMatchesSubstate({
        _id: "2",
        nodeType: "material",
        name: "Foam",
        materialStatus: "bought",
      }, "bought")
    ).toBe(true);
  });

  test("builds searchable text from mixed node metadata", () => {
    const text = nodeSearchText({
      _id: "1",
      nodeType: "material",
      name: "EVA Foam",
      category: "material",
      tags: ["armor", "blue"],
      notes: "Main body sheets",
      materialStatus: "to_buy",
    });
    expect(text).toContain("eva foam");
    expect(text).toContain("armor");
    expect(text).toContain("material");
  });

  test("formats direct and rollup cost summaries", () => {
    expect(formatCostSummary({ directCostCents: 1200, totalCostCents: 5400 })).toBe(
      "Own 1200 / Rollup 5400"
    );
    expect(formatCostSummary({ directCostCents: 1200, totalCostCents: 1200 })).toBe(
      "Total 1200"
    );
  });
});
