import { describe, it, expect } from "vitest";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";

// Spec: DATA_AND_SYNC.md §6 (REQ-D60). The sync worker runs ONLY for a paid, signed-in user.
// These describe intended behavior; they fail until syncPolicy is implemented.
describe("shouldRunSyncWorker (REQ-D60)", () => {
  it("should_not_start_sync_worker_for_free_user", () => {
    expect(shouldRunSyncWorker("FREE", true)).toBe(false);
  });

  it("should_start_sync_worker_for_paid_signed_in_user", () => {
    expect(shouldRunSyncWorker("PRO", true)).toBe(true);
    expect(shouldRunSyncWorker("SUPPORTER", true)).toBe(true);
  });

  it("should_not_start_sync_worker_when_signed_out", () => {
    expect(shouldRunSyncWorker("PRO", false)).toBe(false);
  });

  it("should_treat_legacy_paid_tiers_as_paid", () => {
    expect(shouldRunSyncWorker("STUDIO", true)).toBe(true);
  });

  it("should_not_start_for_missing_or_unknown_tier", () => {
    expect(shouldRunSyncWorker(null, true)).toBe(false);
    expect(shouldRunSyncWorker(undefined, true)).toBe(false);
  });
});
