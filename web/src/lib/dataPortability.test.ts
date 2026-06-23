import { describe, it, expect, vi } from "vitest";
import { importBundle, type ExportableRow } from "@kyarafit/design-system/domain/importExport";
import {
  buildDataBundle,
  countRows,
  emptyCollections,
  MalformedBundleError,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
  runImport,
  summarizeTotals,
  toExportableRows,
  type CreateRowFn,
  type PortableCollections,
} from "./dataPortability";

// Spec: PRODUCT_SPEC.md §4.9 (REQ-012/095/096) + DATA_AND_SYNC.md §11 (REQ-D100/101/102). Export and
// import are FREE; bundles round-trip faithfully and re-importing is idempotent.

function sampleCollections(): PortableCollections {
  return {
    ...emptyCollections(),
    builds: [
      { id: "b1", name: "Aerith", status: "wip" },
      { id: "b2", name: "Cloud", status: "idea" },
    ],
    conventions: [{ id: "c1", name: "AnimeExpo", startDate: "2026-07-01", endDate: "2026-07-04" }],
  };
}

describe("toExportableRows", () => {
  it("maps Convex _id to a portable id while preserving other fields", () => {
    const rows = toExportableRows([{ _id: "x1", name: "Tifa", budgetCents: 5000 }]);
    expect(rows).toEqual([{ _id: "x1", id: "x1", name: "Tifa", budgetCents: 5000 }]);
  });

  it("passes through rows that already carry a string id", () => {
    const rows = toExportableRows([{ id: "k1", name: "Yuffie" }]);
    expect(rows[0].id).toBe("k1");
  });
});

describe("buildDataBundle / parseDataBundle round-trip (REQ-D102)", () => {
  it("reproduces every collection without loss", () => {
    const collections = sampleCollections();
    const serialized = buildDataBundle(collections, Date.parse("2026-06-17T00:00:00.000Z"));
    const parsed = parseDataBundle(serialized);
    expect(parsed).toEqual(collections);
  });

  it("records a wrapper version, bundle version, and ISO export timestamp", () => {
    const serialized = buildDataBundle(emptyCollections(), Date.parse("2026-06-17T12:00:00.000Z"));
    const wrapper = JSON.parse(serialized) as {
      version: number;
      bundleVersion: number;
      exportedAt: string;
      collections: Record<string, string>;
    };
    expect(wrapper.version).toBe(1);
    expect(wrapper.bundleVersion).toBe(1);
    expect(wrapper.exportedAt).toBe("2026-06-17T12:00:00.000Z");
    // Each collection is itself a serialized exportBundle string.
    for (const key of PORTABLE_COLLECTIONS) {
      expect(importBundle(wrapper.collections[key])).toEqual([]);
    }
  });
});

describe("countRows", () => {
  it("sums rows across all collections", () => {
    expect(countRows(sampleCollections())).toBe(3);
    expect(countRows(emptyCollections())).toBe(0);
  });
});

describe("parseDataBundle error handling (REQ-D101, graceful failure)", () => {
  it("throws a MalformedBundleError for non-JSON input", () => {
    expect(() => parseDataBundle("not json {")).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when the bundle shape is wrong", () => {
    expect(() => parseDataBundle(JSON.stringify({ nope: true }))).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when a collection section is malformed", () => {
    const bad = JSON.stringify({ collections: { builds: "{not a bundle" } });
    expect(() => parseDataBundle(bad)).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when a row is missing a string id", () => {
    const bad = JSON.stringify({
      collections: { builds: JSON.stringify({ version: 1, rows: [{ name: "no id" }] }) },
    });
    expect(() => parseDataBundle(bad)).toThrow(MalformedBundleError);
  });
});

describe("runImport idempotency (REQ-D101)", () => {
  it("creates missing rows once and never duplicates on re-import", async () => {
    const store: PortableCollections = emptyCollections();
    const createRow: CreateRowFn = vi.fn(
      (collection: keyof PortableCollections, row: ExportableRow) => {
        store[collection].push(row);
      }
    );

    const bundle = buildDataBundle(sampleCollections());
    const imported = parseDataBundle(bundle);

    const first = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(first)).toEqual({ added: 3, skipped: 0 });
    expect(createRow).toHaveBeenCalledTimes(3);

    // Re-import the identical bundle against the now-populated store: nothing is created.
    const callsAfterFirst = (createRow as ReturnType<typeof vi.fn>).mock.calls.length;
    const second = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(second)).toEqual({ added: 0, skipped: 3 });
    expect(createRow).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("only creates rows whose ids are not already present", async () => {
    const existing: PortableCollections = {
      ...emptyCollections(),
      builds: [{ id: "b1", name: "Aerith" }],
    };
    const imported: PortableCollections = {
      ...emptyCollections(),
      builds: [
        { id: "b1", name: "Aerith" },
        { id: "b3", name: "Tifa" },
      ],
    };
    const created: string[] = [];
    const createRow: CreateRowFn = (_collection, row) => {
      created.push(row.id);
    };
    const summary = await runImport({ imported, existing, createRow });
    expect(created).toEqual(["b3"]);
    expect(summary.builds).toEqual({ added: 1, skipped: 1 });
  });
});
