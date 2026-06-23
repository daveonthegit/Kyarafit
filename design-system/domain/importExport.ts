/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per DATA_AND_SYNC.md §11 (REQ-D101/102).
 *
 * Pure logic for local data export/import:
 * - Round-trip fidelity: importing what was exported reproduces the data.
 * - Idempotent import: re-importing the same bundle does not duplicate rows (dedupe by id).
 * Shared so web and mobile export/import are interchangeable.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export interface ExportableRow {
  id: string;
  [key: string]: unknown;
}

export interface ExportBundle {
  version: number;
  rows: ExportableRow[];
}

export const EXPORT_BUNDLE_VERSION = 1;

/** Serialize rows into a portable bundle string. */
export function exportBundle(rows: ExportableRow[]): string {
  const bundle: ExportBundle = { version: EXPORT_BUNDLE_VERSION, rows };
  return JSON.stringify(bundle);
}

/** Parse a bundle string back into rows. Inverse of exportBundle. */
export function importBundle(serialized: string): ExportableRow[] {
  const parsed = JSON.parse(serialized) as ExportBundle;
  return parsed.rows;
}

/**
 * Merge imported rows into existing data, deduping by id (idempotent: re-importing the same rows
 * yields the same result). Existing rows win on id collision; new ids are appended in order.
 * Pure; does not mutate inputs.
 */
export function mergeImported<T extends ExportableRow>(existing: T[], imported: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of existing) {
    byId.set(row.id, row);
  }
  for (const row of imported) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
}
