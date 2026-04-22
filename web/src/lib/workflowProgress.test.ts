import { describe, expect, it } from "vitest";
import {
  deriveBuildBlendedProgress,
  deriveStatusProgress,
  deriveWeightedProgress,
  deriveWorkflowAggregateProgress,
  isOverdueStatus,
} from "@kyarafit/design-system/domain";

describe("workflowProgress", () => {
  it("prefers manual progress over status-derived progress", () => {
    expect(deriveStatusProgress({ status: "not_started", manualProgressPercent: 73 })).toBe(73);
  });

  it("excludes cancelled work from weighted aggregates", () => {
    expect(
      deriveWorkflowAggregateProgress({
        kind: "group",
        status: "in_progress",
        childProgress: [
          { progressPercent: 100, weight: 2 },
          { progressPercent: 0, weight: 5, excluded: true },
        ],
      })
    ).toBe(100);
  });

  it("renormalizes build progress when one source is missing", () => {
    expect(
      deriveBuildBlendedProgress({
        workflowProgressPercent: 80,
        nodeProgressPercent: 20,
        packingProgressPercent: null,
      })
    ).toBe(55);
  });

  it("weights blended progress by the configured inputs", () => {
    expect(
      deriveWeightedProgress([
        { progressPercent: 100, weight: 3 },
        { progressPercent: 0, weight: 1 },
      ])
    ).toBe(75);
  });

  it("marks incomplete dated work as overdue", () => {
    expect(
      isOverdueStatus({
        dueDate: "2026-03-20",
        status: "in_progress",
        today: "2026-03-28",
      })
    ).toBe(true);
    expect(
      isOverdueStatus({
        dueDate: "2026-03-20",
        status: "done",
        today: "2026-03-28",
      })
    ).toBe(false);
  });
});
