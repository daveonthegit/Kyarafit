import type { EntityOverlayRow } from "@kyarafit/design-system/domain/offlineEntityOverlay";
import { getOfflineDb } from "./db";
import { bumpOverlayVersion } from "./entityOverlayStore";

/**
 * SQLite-backed local entity overlay (blueprint §3.13.2), over the `entity_rows` table in `./db`.
 * Pending (unsynced) rows are the optimistic view of offline writes that `useOfflineQuery` overlays
 * onto the last server snapshot (see `offlineEntityOverlay`). The sync worker clears a pending row
 * once its queued mutation replays. All helpers are best-effort and never throw, degrading to
 * no-ops / empty results so callers never crash (e.g. web / RN-web where `expo-sqlite` may be
 * unavailable).
 */

/**
 * Upsert a pending overlay for an offline write. Edits accumulate by shallow-merging onto any
 * existing pending row for the same entity, so repeated offline edits compose. Bumps the overlay
 * version so subscribed queries repaint.
 */
export function writeEntityOverlay(
  table: string,
  id: string,
  userId: string,
  doc: Record<string, unknown> | null,
  deleted: boolean
): void {
  try {
    const db = getOfflineDb();
    let merged = doc ?? {};
    if (!deleted && doc) {
      const existing = db.getFirstSync<{ json: string }>(
        `SELECT json FROM entity_rows WHERE table_name = ? AND id = ? AND synced_at IS NULL`,
        [table, id]
      );
      if (existing) {
        try {
          merged = { ...(JSON.parse(existing.json) as Record<string, unknown>), ...doc };
        } catch {
          // Corrupt prior overlay — fall back to the new fields only.
        }
      }
    }
    const json = JSON.stringify(merged) ?? "{}";
    db.runSync(
      `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
       VALUES (?, ?, ?, ?, ?, NULL, ?)
       ON CONFLICT(table_name, id) DO UPDATE SET
         json = excluded.json,
         updated_at = excluded.updated_at,
         synced_at = NULL,
         deleted = excluded.deleted`,
      [table, id, userId, json, Date.now(), deleted ? 1 : 0]
    );
    bumpOverlayVersion();
  } catch {
    // Best-effort; ignore.
  }
}

/** Pending (unsynced) overlays for a table, oldest first, ready for `applyListOverlay`. */
export function listPendingEntityRows(table: string): EntityOverlayRow[] {
  try {
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
  } catch {
    return [];
  }
}

/** Clear a pending overlay once its write has synced (called by the sync worker on drain success). */
export function clearEntityOverlay(table: string, id: string): void {
  try {
    getOfflineDb().runSync(
      `DELETE FROM entity_rows WHERE table_name = ? AND id = ? AND synced_at IS NULL`,
      [table, id]
    );
    bumpOverlayVersion();
  } catch {
    // Best-effort; ignore.
  }
}
