/**
 * Data export / import orchestration for the mobile app (Wave 7 — REQ-012 / REQ-D101 / REQ-D102).
 *
 * Export / import is FREE for everyone (PRODUCT_SPEC.md §3, REQ-012): nothing here gates on tier.
 *
 * This module is intentionally pure-ish so it is unit-testable without React or native modules:
 * it takes already-read offline query results (`PortableCollections`) and an injected `create`
 * callback, and it leans on the SHARED, already-tested helpers from
 * `@kyarafit/design-system/domain/importExport` (`exportBundle` / `importBundle` / `mergeImported`,
 * `EXPORT_BUNDLE_VERSION`) so mobile and web stay at behavioral parity.
 *
 * Idempotency (REQ-D101): merge dedupes by row `id`, and only rows whose id is not already present
 * are created. Within a single device, re-importing your own current data is therefore a no-op.
 *
 * TODO(REQ-D101): full cross-device idempotency needs id remapping via the local `id_map` (the
 * offline create mutations mint fresh server ids rather than preserving the bundle id). That id_map
 * layer is out of scope for this slice; the merge below is the single dedupe point so wiring it in
 * later is a localized change.
 */
import {
  exportBundle,
  importBundle,
  mergeImported,
  type ExportableRow,
} from "@kyarafit/design-system/domain/importExport";

/** Local-first entity tables included in a portable export bundle (DATA_AND_SYNC.md §3 + §11). */
export const PORTABLE_TABLES = ["builds", "elements", "conventions"] as const;
export type PortableTable = (typeof PORTABLE_TABLES)[number];

/** A Convex document as read through the offline queries: always identified by `_id`. */
export interface EntityDoc {
  _id: string;
  [key: string]: unknown;
}

/**
 * A single row inside the portable bundle. `id` is `<table>:<_id>` so ids stay globally unique
 * across tables and the shared dedupe-by-id stays correct; `doc` is the original entity document.
 */
export interface PortableRow extends ExportableRow {
  table: PortableTable;
  doc: EntityDoc;
}

/** Per-table collections of entity documents to export (any subset of `PORTABLE_TABLES`). */
export type PortableCollections = {
  [Table in PortableTable]?: readonly EntityDoc[];
};

/** Callback that persists one imported row via the platform's offline create mutations. */
export type CreateRow = (table: PortableTable, doc: EntityDoc) => Promise<void> | void;

/** Outcome of an import attempt. `ok: false` means the file was malformed; nothing was written. */
export interface ImportSummary {
  ok: boolean;
  created: number;
  skipped: number;
  error?: string;
}

function rowId(table: PortableTable, docId: string): string {
  return `${table}:${docId}`;
}

const PORTABLE_TABLE_SET: ReadonlySet<string> = new Set(PORTABLE_TABLES);

function isPortableRow(value: unknown): value is PortableRow {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") return false;
  if (typeof row.table !== "string" || !PORTABLE_TABLE_SET.has(row.table)) return false;
  const doc = row.doc;
  return typeof doc === "object" && doc !== null && typeof (doc as EntityDoc)._id === "string";
}

/**
 * Flatten per-table collections into portable rows. Order is stable: table order first, then the
 * input order within each table.
 */
export function buildPortableRows(collections: PortableCollections): PortableRow[] {
  const rows: PortableRow[] = [];
  for (const table of PORTABLE_TABLES) {
    const docs = collections[table] ?? [];
    for (const doc of docs) {
      rows.push({ id: rowId(table, doc._id), table, doc });
    }
  }
  return rows;
}

/**
 * Serialize the user's local-first entities into a portable JSON bundle string. FREE for everyone
 * (REQ-012). The shape is `{ version: EXPORT_BUNDLE_VERSION, rows: PortableRow[] }`.
 */
export function buildExport(collections: PortableCollections): string {
  return exportBundle(buildPortableRows(collections));
}

/**
 * Import a bundle string: parse → merge (dedupe by id, REQ-D101) → create only the rows whose id is
 * not already present, via the injected `create` callback. Malformed input fails gracefully and
 * writes nothing.
 */
export async function importData(params: {
  serialized: string;
  existing: PortableCollections;
  create: CreateRow;
}): Promise<ImportSummary> {
  const { serialized, existing, create } = params;

  let parsed: unknown;
  try {
    parsed = importBundle(serialized);
  } catch {
    return { ok: false, created: 0, skipped: 0, error: "malformed" };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, created: 0, skipped: 0, error: "malformed" };
  }

  const imported = parsed.filter(isPortableRow);
  const existingRows = buildPortableRows(existing);
  const existingIds = new Set(existingRows.map((row) => row.id));

  // Route through the shared merge so dedupe-by-id behavior matches web exactly; new rows are the
  // merged set minus the ids that already existed locally.
  const merged = mergeImported<PortableRow>(existingRows, imported);
  const toCreate = merged.filter((row) => !existingIds.has(row.id));

  let created = 0;
  for (const row of toCreate) {
    await create(row.table, row.doc);
    created += 1;
  }

  return { ok: true, created, skipped: imported.length - created };
}
