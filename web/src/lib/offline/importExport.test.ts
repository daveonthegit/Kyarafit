import { describe, it, expect } from "vitest";
import {
  exportBundle,
  importBundle,
  mergeImported,
  type ExportableRow,
} from "@kyarafit/design-system/domain/importExport";

// Spec: DATA_AND_SYNC.md §11 (REQ-D101/102). Export/import is free, round-trips faithfully, and
// re-importing is idempotent (no duplicates).
const rows: ExportableRow[] = [
  { id: "1", name: "Aerith", budgetCents: 5000 },
  { id: "2", name: "Cloud", budgetCents: 8000 },
];

describe("export/import round-trip (REQ-D102)", () => {
  it("should_round_trip_rows_without_loss", () => {
    expect(importBundle(exportBundle(rows))).toEqual(rows);
  });
});

describe("mergeImported idempotency (REQ-D101)", () => {
  it("should_not_duplicate_rows_on_reimport", () => {
    const once = mergeImported(rows, rows);
    const twice = mergeImported(once, rows);
    expect(twice).toEqual(once);
    expect(twice.map((r) => r.id).sort()).toEqual(["1", "2"]);
  });

  it("should_add_new_rows_while_deduping_existing_ids", () => {
    const incoming: ExportableRow[] = [
      { id: "2", name: "Cloud" },
      { id: "3", name: "Tifa" },
    ];
    const result = mergeImported(rows, incoming);
    expect(result.map((r) => r.id).sort()).toEqual(["1", "2", "3"]);
  });

  it("should_not_mutate_the_inputs", () => {
    const existingCopy = JSON.parse(JSON.stringify(rows));
    mergeImported(rows, [{ id: "9", name: "New" }]);
    expect(rows).toEqual(existingCopy);
  });
});
