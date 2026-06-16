import { getOfflineDb } from "./db";

/**
 * Persisted cursor for the incremental warm-up pull (`sync.listChangedSince`). Stored in the
 * `sync_meta` key-value table. Best-effort and never throws: on failure the cursor reads as 0, so
 * the next warm-up does a safe (idempotent) full re-pull rather than crashing.
 */

const CURSOR_KEY = "listChangedSince:cursor";

export function getSyncCursor(): number {
  try {
    const row = getOfflineDb().getFirstSync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [CURSOR_KEY]
    );
    const parsed = row ? Number(row.value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setSyncCursor(cursor: number): void {
  try {
    getOfflineDb().runSync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [CURSOR_KEY, String(cursor)]
    );
  } catch {
    // Best-effort; ignore.
  }
}
