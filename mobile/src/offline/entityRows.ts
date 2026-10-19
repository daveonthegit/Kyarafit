import type { EntityOverlayRow } from "@kyarafit/design-system/domain/offlineEntityOverlay";
import { getOfflineDb } from "./db";

/**
 * Raw access to the vault's `entity_rows` for the (paid) sync worker and upgrade backfill. Screens
 * never use this — they read and write through `@/vault` — and the worker reloads the vault store
 * after it changes rows here.
 *
 * Row states: `synced_at IS NULL` means the row holds local changes the cloud has not acknowledged
 * (for a free vault, that is every row); `deleted = 1` is a tombstone kept until its delete syncs.
 * These helpers throw on SQLite failure so a sync pass stops instead of believing it succeeded.
 */

/** Live rows the cloud has not acknowledged, oldest first (upgrade backfill input). */
export function listPendingEntityRows(table: string): EntityOverlayRow[] {
  const rows = getOfflineDb().getAllSync<{ id: string; json: string; deleted: number }>(
    `SELECT id, json, deleted FROM entity_rows
     WHERE table_name = ? AND synced_at IS NULL
     ORDER BY updated_at ASC, id ASC`,
    [table]
  );
  return rows.map((row) => {
    let doc: Record<string, unknown> | null = null;
    try {
      doc = JSON.parse(row.json) as Record<string, unknown>;
    } catch {
      doc = null;
    }
    return { id: row.id, deleted: !!row.deleted, doc };
  });
}

/**
 * Write a server document pulled by the sync worker as a synced row. Never clobbers a row with
 * unacknowledged local changes (`synced_at IS NULL`): local edits win until they themselves sync.
 */
export function upsertSyncedEntityRow(
  table: string,
  id: string,
  userId: string,
  doc: Record<string, unknown>
): void {
  const json = JSON.stringify(doc) ?? "{}";
  const now = Date.now();
  getOfflineDb().runSync(
    `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(table_name, id) DO UPDATE SET
       json = excluded.json,
       updated_at = excluded.updated_at,
       synced_at = excluded.synced_at,
       deleted = 0
     WHERE entity_rows.synced_at IS NOT NULL`,
    [table, id, userId, json, now, now]
  );
}

/** Live synced rows for a table (paid image mirroring input). */
export function listSyncedEntityRows(table: string): Record<string, unknown>[] {
  const rows = getOfflineDb().getAllSync<{ id: string; json: string }>(
    `SELECT id, json FROM entity_rows
     WHERE table_name = ? AND synced_at IS NOT NULL AND deleted = 0
     ORDER BY updated_at DESC`,
    [table]
  );
  const docs: Record<string, unknown>[] = [];
  for (const row of rows) {
    try {
      docs.push({ ...(JSON.parse(row.json) as Record<string, unknown>), _id: row.id });
    } catch {
      // Unreadable row: leave it on disk untouched.
    }
  }
  return docs;
}

/**
 * Mark rows covered by a replayed operation as acknowledged — unless another still-pending
 * operation also touches them (its change has not reached the cloud yet).
 */
export function markEntityRowsSynced(
  touched: readonly (readonly [string, string])[],
  queueRowId: number
): void {
  const db = getOfflineDb();
  const now = Date.now();
  for (const [table, id] of touched) {
    db.runSync(
      `UPDATE entity_rows SET synced_at = ?
       WHERE table_name = ? AND id = ? AND synced_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM mutation_queue
           WHERE status = 'pending' AND id <> ? AND touched_json LIKE ?
         )`,
      [now, table, id, queueRowId, `%${JSON.stringify(id)}%`]
    );
  }
}

/** Mark a backfilled local row as acknowledged by the cloud. */
export function markEntityRowSynced(table: string, id: string): void {
  getOfflineDb().runSync(
    `UPDATE entity_rows SET synced_at = ? WHERE table_name = ? AND id = ? AND synced_at IS NULL`,
    [Date.now(), table, id]
  );
}
