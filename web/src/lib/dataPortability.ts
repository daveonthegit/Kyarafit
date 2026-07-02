/**
 * Data export / import orchestration (PRODUCT_SPEC.md §4.9 REQ-012/095/096, DATA_AND_SYNC.md §11
 * REQ-D100/101/102). Pure, dependency-free, and unit-testable: it takes already-gathered query
 * results plus an injected `createRow` callback so it can be exercised without a live Convex.
 *
 * Export and import are FREE for everyone — there is intentionally no tier gate in this module.
 *
 * Round-trip fidelity (REQ-D102): each collection is serialized with the shared `exportBundle` and
 * read back with `importBundle`, so a bundle exported on one device reproduces faithfully on another.
 * Idempotent import (REQ-D101): merges via `mergeImported` (dedupe by id) so re-importing the same
 * bundle never creates duplicate rows.
 */
import {
  exportBundle,
  importBundle,
  mergeImported,
  EXPORT_BUNDLE_VERSION,
  type ExportableRow,
} from "@kyarafit/design-system/domain/importExport";

/** Local-first entity collections included in a portable bundle. Order is stable for summaries. */
export const PORTABLE_COLLECTIONS = [
  "builds",
  "conventions",
  "workflowItems",
  "packingListItems",
] as const;

export type PortableCollectionKey = (typeof PORTABLE_COLLECTIONS)[number];

export type PortableCollections = Record<PortableCollectionKey, ExportableRow[]>;

/** Wrapper-bundle version (independent of the per-collection `EXPORT_BUNDLE_VERSION`). */
export const DATA_BUNDLE_VERSION = 1;

export interface DataBundle {
  /** Wrapper schema version. */
  version: number;
  /** Per-collection bundle version (from the shared exportBundle contract). */
  bundleVersion: number;
  /** ISO timestamp the bundle was produced. */
  exportedAt: string;
  /** One serialized `exportBundle` string per collection. */
  collections: Record<PortableCollectionKey, string>;
}

/** Thrown when an imported file is not a readable Kyarafit data bundle. Carries a friendly message. */
export class MalformedBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedBundleError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An empty set of collections — used as the loading/signed-out default and the import accumulator. */
export function emptyCollections(): PortableCollections {
  return {
    builds: [],
    conventions: [],
    workflowItems: [],
    packingListItems: [],
  };
}

/**
 * Convert Convex documents (keyed by `_id`) into `ExportableRow`s (keyed by `id`), preserving every
 * other field for round-trip fidelity. Rows that already carry a string `id` are passed through.
 */
export function toExportableRows(docs: ReadonlyArray<unknown>): ExportableRow[] {
  return docs.map((doc) => {
    if (!isRecord(doc)) {
      throw new Error("Cannot export a non-object row.");
    }
    const id = typeof doc.id === "string" ? doc.id : doc._id;
    if (typeof id !== "string") {
      throw new Error("Row is missing a string id and cannot be exported.");
    }
    return { ...doc, id };
  });
}

/** Serialize all collections into a single portable bundle string (REQ-D102). */
export function buildDataBundle(
  collections: PortableCollections,
  exportedAt: number = Date.now()
): string {
  const serialized = {} as Record<PortableCollectionKey, string>;
  for (const key of PORTABLE_COLLECTIONS) {
    serialized[key] = exportBundle(collections[key] ?? []);
  }
  const bundle: DataBundle = {
    version: DATA_BUNDLE_VERSION,
    bundleVersion: EXPORT_BUNDLE_VERSION,
    exportedAt: new Date(exportedAt).toISOString(),
    collections: serialized,
  };
  return JSON.stringify(bundle, null, 2);
}

/** Total number of rows across all collections (for an "export N items" affordance). */
export function countRows(collections: PortableCollections): number {
  return PORTABLE_COLLECTIONS.reduce((sum, key) => sum + (collections[key]?.length ?? 0), 0);
}

/**
 * Parse a bundle string back into collections. Throws `MalformedBundleError` (never crashes) for
 * non-JSON, non-bundle, or structurally-invalid input so the UI can show a clear error.
 */
export function parseDataBundle(serialized: string): PortableCollections {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new MalformedBundleError("This file isn't valid JSON, so it can't be imported.");
  }
  if (!isRecord(parsed) || !isRecord(parsed.collections)) {
    throw new MalformedBundleError("This file isn't a Kyarafit data export.");
  }
  const rawCollections = parsed.collections;
  const result = emptyCollections();
  for (const key of PORTABLE_COLLECTIONS) {
    const raw = rawCollections[key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    let rows: ExportableRow[];
    try {
      rows = importBundle(raw);
    } catch {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    if (!Array.isArray(rows) || !rows.every((row) => isRecord(row) && typeof row.id === "string")) {
      throw new MalformedBundleError(`The "${key}" section of this file is malformed.`);
    }
    result[key] = rows;
  }
  return result;
}

export interface CollectionImportResult {
  added: number;
  skipped: number;
}

export type ImportSummary = Record<PortableCollectionKey, CollectionImportResult>;

export interface ImportTotals {
  added: number;
  skipped: number;
}

/** Persist one new row for a collection (e.g. a Convex create mutation). Injected for testability. */
export type CreateRowFn = (
  collection: PortableCollectionKey,
  row: ExportableRow
) => Promise<unknown> | unknown;

export interface RunImportArgs {
  imported: PortableCollections;
  existing: PortableCollections;
  createRow: CreateRowFn;
}

/**
 * Merge imported rows into the existing data and create only the rows that are missing by id
 * (REQ-D101). Idempotent: re-running with the same bundle once its rows already exist creates
 * nothing, so `createRow` is never invoked for an already-present id.
 */
export async function runImport({
  imported,
  existing,
  createRow,
}: RunImportArgs): Promise<ImportSummary> {
  const summary = {} as ImportSummary;
  for (const key of PORTABLE_COLLECTIONS) {
    const existingRows = existing[key] ?? [];
    const importedRows = imported[key] ?? [];
    const existingIds = new Set(existingRows.map((row) => row.id));
    // mergeImported dedupes by id (existing wins, new ids appended once). The rows to create are
    // exactly the merged ids that were not already present.
    const merged = mergeImported(existingRows, importedRows);
    const toCreate = merged.filter((row) => !existingIds.has(row.id));
    for (const row of toCreate) {
      await createRow(key, row);
    }
    summary[key] = {
      added: toCreate.length,
      skipped: importedRows.length - toCreate.length,
    };
  }
  return summary;
}

/** Roll a per-collection summary up into overall added/skipped totals. */
export function summarizeTotals(summary: ImportSummary): ImportTotals {
  let added = 0;
  let skipped = 0;
  for (const key of PORTABLE_COLLECTIONS) {
    added += summary[key].added;
    skipped += summary[key].skipped;
  }
  return { added, skipped };
}
