import { describe, it, expect, vi } from "vitest";
import { EXPORT_BUNDLE_VERSION } from "@kyarafit/design-system/domain/importExport";
import {
  buildExport,
  importData,
  type EntityDoc,
  type PortableCollections,
  type PortableTable,
} from "../dataPortability";

/**
 * Wave 7 mobile data export/import (PRODUCT_SPEC.md §3 REQ-012; DATA_AND_SYNC.md §11
 * REQ-D101/D102). Export/import is FREE for everyone, re-importing is idempotent (no duplicates),
 * and malformed input fails gracefully. Names mirror the web slice for parity.
 */
const collections: PortableCollections = {
  builds: [
    { _id: "b1", userId: "u1", name: "Aerith", status: "wip", budgetCents: 5000 },
    { _id: "b2", userId: "u1", name: "Cloud", status: "idea" },
  ],
  elements: [{ _id: "e1", userId: "u1", name: "Buster Sword", nodeType: "element", tags: [] }],
  conventions: [
    { _id: "c1", userId: "u1", name: "Comiket", startDate: "2026-08-14", endDate: "2026-08-16" },
  ],
};

describe("mobile data export (REQ-012, REQ-D102)", () => {
  it("should_build_an_export_bundle_for_free_user", () => {
    // No tier argument exists — export is free for everyone.
    const serialized = buildExport(collections);
    const parsed = JSON.parse(serialized) as { version: number; rows: { table: string }[] };

    expect(parsed.version).toBe(EXPORT_BUNDLE_VERSION);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows.map((row) => row.table).sort()).toEqual([
      "builds",
      "builds",
      "conventions",
      "elements",
    ]);
  });
});

describe("mobile data import idempotency (REQ-D101)", () => {
  it("should_not_duplicate_rows_on_reimport", async () => {
    const serialized = buildExport(collections);
    const created: { table: PortableTable; id: string }[] = [];
    const create = (table: PortableTable, doc: EntityDoc): void => {
      created.push({ table, id: doc._id });
    };

    // First import into an empty store creates every row.
    const first = await importData({ serialized, existing: {}, create });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(4);

    // Re-importing the same bundle when the rows already exist creates nothing (dedupe by id).
    const second = await importData({ serialized, existing: collections, create });
    expect(second.ok).toBe(true);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(4);

    // The create callback was only ever invoked for the first (cold) import.
    expect(created).toHaveLength(4);
  });
});

describe("mobile data import error handling (REQ-D101)", () => {
  it("should_report_an_error_for_a_malformed_import_file", async () => {
    const create = vi.fn();

    const notJson = await importData({ serialized: "{ not json", existing: {}, create });
    expect(notJson.ok).toBe(false);
    expect(notJson.error).toBe("malformed");

    // Valid JSON but not a bundle shape is also rejected, and nothing is written.
    const wrongShape = await importData({ serialized: "[]", existing: {}, create });
    expect(wrongShape.ok).toBe(false);
    expect(wrongShape.error).toBe("malformed");

    expect(create).not.toHaveBeenCalled();
  });
});
