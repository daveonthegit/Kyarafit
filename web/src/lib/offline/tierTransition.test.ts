import { describe, it, expect } from "vitest";
import {
  selectBackfillRows,
  planDowngrade,
  cloudRetentionPhase,
  cloudRetentionBanner,
  isCloudFrozen,
  isCloudPurgeable,
  DOWNGRADE_GRACE_MS,
  DOWNGRADE_RETENTION_MS,
  type BackfillRow,
} from "@kyarafit/design-system/domain/tierTransition";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";

// Spec: DATA_AND_SYNC.md §10 (REQ-D95/96).
describe("selectBackfillRows (REQ-D95 upgrade backfill dedupe)", () => {
  const rows: BackfillRow[] = [
    { clientId: "a", name: "Aerith" },
    { clientId: "b", name: "Bayonetta" },
    { clientId: "c", name: "Cloud" },
  ];

  it("should_skip_rows_already_present_on_the_server", () => {
    const result = selectBackfillRows(rows, ["b"]);
    expect(result.map((r) => r.clientId)).toEqual(["a", "c"]);
  });

  it("should_be_idempotent_when_all_rows_already_synced", () => {
    expect(selectBackfillRows(rows, ["a", "b", "c"])).toEqual([]);
  });

  it("should_not_mutate_the_input", () => {
    const copy = [...rows];
    selectBackfillRows(rows, ["a"]);
    expect(rows).toEqual(copy);
  });
});

describe("planDowngrade (REQ-D96)", () => {
  it("should_stop_sync_and_preserve_local_data", () => {
    const plan = planDowngrade();
    expect(plan.stopSync).toBe(true);
    expect(plan.keepLocalData).toBe(true);
  });

  it("should_never_delete_local_data_on_downgrade", () => {
    expect(planDowngrade().deleteLocalData).toBe(false);
  });

  it("should_stop_sync_and_preserve_data_on_downgrade", () => {
    const plan = planDowngrade();
    expect(plan.stopSync).toBe(true);
    expect(plan.keepLocalData).toBe(true);
    expect(plan.deleteLocalData).toBe(false);
    // Once the tier flips to FREE the worker gate stops the worker automatically (REQ-D60/D96).
    expect(shouldRunSyncWorker("FREE", true)).toBe(false);
    expect(shouldRunSyncWorker("PRO", true)).toBe(true);
  });
});

describe("cloudRetentionPhase (REQ-D96/D97 grace → freeze → purge)", () => {
  const now = 1_000_000_000_000;

  it("should_report_active_when_never_downgraded", () => {
    expect(cloudRetentionPhase(null, now)).toBe("active");
    expect(cloudRetentionPhase(undefined, now)).toBe("active");
    expect(isCloudFrozen(null, now)).toBe(false);
    expect(isCloudPurgeable(null, now)).toBe(false);
  });

  it("should_keep_cloud_intact_during_the_grace_period", () => {
    const downgradedAt = now - (DOWNGRADE_GRACE_MS - 1);
    expect(cloudRetentionPhase(downgradedAt, now)).toBe("grace");
    expect(isCloudFrozen(downgradedAt, now)).toBe(false);
    expect(isCloudPurgeable(downgradedAt, now)).toBe(false);
  });

  it("should_freeze_cloud_after_grace_but_before_retention", () => {
    const downgradedAt = now - DOWNGRADE_GRACE_MS;
    expect(cloudRetentionPhase(downgradedAt, now)).toBe("frozen");
    expect(isCloudFrozen(downgradedAt, now)).toBe(true);
    expect(isCloudPurgeable(downgradedAt, now)).toBe(false);
  });

  it("should_become_purgeable_only_after_the_retention_window", () => {
    const justBefore = now - (DOWNGRADE_RETENTION_MS - 1);
    expect(cloudRetentionPhase(justBefore, now)).toBe("frozen");
    expect(isCloudPurgeable(justBefore, now)).toBe(false);

    const atRetention = now - DOWNGRADE_RETENTION_MS;
    expect(cloudRetentionPhase(atRetention, now)).toBe("purgeable");
    expect(isCloudFrozen(atRetention, now)).toBe(true);
    expect(isCloudPurgeable(atRetention, now)).toBe(true);
  });
});

describe("cloudRetentionBanner (REQ-D96/D97 downgrade status surface)", () => {
  const now = 1_000_000_000_000;

  it("should_return_null_when_never_downgraded", () => {
    expect(cloudRetentionBanner(null, now)).toBeNull();
    expect(cloudRetentionBanner(undefined, now)).toBeNull();
  });

  it("should_surface_grace_with_the_freeze_deadline", () => {
    const downgradedAt = now - (DOWNGRADE_GRACE_MS - 1);
    expect(cloudRetentionBanner(downgradedAt, now)).toEqual({
      phase: "grace",
      deadline: downgradedAt + DOWNGRADE_GRACE_MS,
    });
  });

  it("should_surface_frozen_with_the_purge_deadline", () => {
    const downgradedAt = now - DOWNGRADE_GRACE_MS;
    expect(cloudRetentionBanner(downgradedAt, now)).toEqual({
      phase: "frozen",
      deadline: downgradedAt + DOWNGRADE_RETENTION_MS,
    });
  });

  it("should_surface_purgeable_after_the_retention_window", () => {
    const downgradedAt = now - DOWNGRADE_RETENTION_MS;
    expect(cloudRetentionBanner(downgradedAt, now)).toEqual({
      phase: "purgeable",
      deadline: downgradedAt + DOWNGRADE_RETENTION_MS,
    });
  });
});
