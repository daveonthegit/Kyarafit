import { describe, expect, it } from "vitest";
import {
  deriveElementOverallBucket,
  deriveMaterialOverallBucket,
  deriveProgressPercent,
  isAllowedLink,
  normalizeDirectCostCents,
  wouldCreateCycle,
} from "../../../convex/lib/cosplayGraph";

describe("cosplayGraph", () => {
  it("enforces allowed parent-child relationships", () => {
    expect(isAllowedLink("element", "element")).toBe(true);
    expect(isAllowedLink("element", "material")).toBe(true);
    expect(isAllowedLink("material", "material")).toBe(true);
    expect(isAllowedLink("material", "element")).toBe(false);
  });

  it("derives per-unit pricing correctly", () => {
    expect(
      normalizeDirectCostCents({
        pricingMode: "per_unit",
        unitCostCents: 275,
        quantity: 3,
      })
    ).toBe(825);
    expect(
      normalizeDirectCostCents({
        pricingMode: "total",
        directCostCents: 1499,
      })
    ).toBe(1499);
  });

  it("derives element completion from children and tasks", () => {
    expect(
      deriveElementOverallBucket({
        childBuckets: ["complete", "complete"],
        taskCount: 2,
        completedTaskCount: 2,
      })
    ).toBe("complete");

    expect(
      deriveElementOverallBucket({
        buildStatus: "wip",
      })
    ).toBe("in_progress");
  });

  it("derives material completion pragmatically", () => {
    expect(
      deriveMaterialOverallBucket({
        materialStatus: "in_use",
      })
    ).toBe("in_progress");

    expect(
      deriveMaterialOverallBucket({
        childBuckets: ["complete", "complete"],
      })
    ).toBe("complete");
  });

  it("computes progress from task and child completion units", () => {
    expect(
      deriveProgressPercent({
        childBuckets: ["complete", "incomplete"],
        taskCount: 2,
        completedTaskCount: 1,
      })
    ).toBe(50);

    expect(
      deriveProgressPercent({
        ownBucket: "in_progress",
      })
    ).toBe(50);
  });

  it("detects cycles in reusable graphs", async () => {
    const graph: Record<string, string[]> = {
      wigBase: ["fiberPack", "stylingGuide"],
      fiberPack: ["adhesive"],
      stylingGuide: [],
      adhesive: [],
    };

    await expect(
      wouldCreateCycle("adhesive", "wigBase", async (nodeId) => graph[nodeId] ?? [])
    ).resolves.toBe(true);
    await expect(
      wouldCreateCycle("wigBase", "adhesive", async (nodeId) => graph[nodeId] ?? [])
    ).resolves.toBe(false);
  });
});
