import { describe, it, expect } from "vitest";
import {
  MAX_MUTATION_RETRIES,
  nextMutationBackoffMs,
  shouldRetryMutation,
} from "@kyarafit/design-system/domain/offlineMutationQueue";

describe("nextMutationBackoffMs", () => {
  it("ramps then caps at 30s", () => {
    expect(nextMutationBackoffMs(0)).toBe(1000);
    expect(nextMutationBackoffMs(1)).toBe(2000);
    expect(nextMutationBackoffMs(2)).toBe(4000);
    expect(nextMutationBackoffMs(3)).toBe(8000);
    expect(nextMutationBackoffMs(4)).toBe(30000);
    expect(nextMutationBackoffMs(99)).toBe(30000);
  });

  it("clamps negative input to the first step", () => {
    expect(nextMutationBackoffMs(-5)).toBe(1000);
  });
});

describe("shouldRetryMutation", () => {
  it("retries below the max", () => {
    expect(shouldRetryMutation(0)).toBe(true);
    expect(shouldRetryMutation(MAX_MUTATION_RETRIES - 1)).toBe(true);
  });

  it("stops at or beyond the max", () => {
    expect(shouldRetryMutation(MAX_MUTATION_RETRIES)).toBe(false);
    expect(shouldRetryMutation(MAX_MUTATION_RETRIES + 1)).toBe(false);
  });
});
