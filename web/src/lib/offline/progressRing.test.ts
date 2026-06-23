import { describe, it, expect } from "vitest";
import { progressRingGeometry } from "@kyarafit/design-system/domain/progressRing";

const C = 2 * Math.PI * 16;

describe("progressRingGeometry", () => {
  it("should_be_empty_at_0_percent", () => {
    const g = progressRingGeometry(0, 16);
    expect(g.clampedPercent).toBe(0);
    expect(g.dashOffset).toBeCloseTo(C);
  });

  it("should_be_full_at_100_percent", () => {
    expect(progressRingGeometry(100, 16).dashOffset).toBeCloseTo(0);
  });

  it("should_be_half_at_50_percent", () => {
    expect(progressRingGeometry(50, 16).dashOffset).toBeCloseTo(C / 2);
  });

  it("should_clamp_below_0", () => {
    const g = progressRingGeometry(-20, 16);
    expect(g.clampedPercent).toBe(0);
    expect(g.dashOffset).toBeCloseTo(C);
  });

  it("should_clamp_above_100", () => {
    const g = progressRingGeometry(150, 16);
    expect(g.clampedPercent).toBe(100);
    expect(g.dashOffset).toBeCloseTo(0);
  });

  it("should_derive_dashArray_and_circumference_from_radius", () => {
    const g = progressRingGeometry(50, 16);
    expect(g.circumference).toBeCloseTo(C);
    expect(g.dashArray).toBe(`${C} ${C}`);
    expect(progressRingGeometry(50, 10).circumference).toBeCloseTo(2 * Math.PI * 10);
  });
});
