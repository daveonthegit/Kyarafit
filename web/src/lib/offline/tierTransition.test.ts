import { describe, it, expect } from "vitest";
import {
  selectBackfillRows,
  planDowngrade,
  type BackfillRow,
} from "@kyarafit/design-system/domain/tierTransition";

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
});
