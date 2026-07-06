import { getOfflineDb } from "./db";

/**
 * Persisted cursor for the incremental warm-up pull (`sync.listChangedSince`). Stored in the
 * `sync_meta` key-value table. Best-effort and never throws: on failure the cursor reads as 0, so
 * the next warm-up does a safe (idempotent) full re-pull rather than crashing.
 */

const CURSOR_KEY = "listChangedSince:cursor";
const LAST_SYNCED_KEY = "sync:lastSyncedAt";
const BACKFILL_COMPLETE_KEY = "backfill:complete";

function readMetaNumber(key: string): number {
  try {
    const row = getOfflineDb().getFirstSync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key]
    );
    const parsed = row ? Number(row.value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeMetaNumber(key: string, value: number): void {
  try {
    getOfflineDb().runSync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value)]
    );
  } catch {
    // Best-effort; ignore.
  }
}

export function getSyncCursor(): number {
  return readMetaNumber(CURSOR_KEY);
}

export function setSyncCursor(cursor: number): void {
  writeMetaNumber(CURSOR_KEY, cursor);
}

/**
 * Timestamp (ms) of the last successful warm-up pull, or `null` if never synced. Surfaced by the
 * sync-status UI (REQ-D64).
 */
export function getLastSyncedAt(): number | null {
  const value = readMetaNumber(LAST_SYNCED_KEY);
  return value > 0 ? value : null;
}

export function setLastSyncedAt(ts: number): void {
  writeMetaNumber(LAST_SYNCED_KEY, ts);
}

/**
 * Per-device marker: the one-time upgrade backfill has drained every local-first table (REQ-D95).
 * Best-effort; a read failure returns `false` so the (idempotent, server-deduped) backfill re-runs
 * rather than being wrongly skipped.
 */
export function isBackfillComplete(): boolean {
  try {
    const row = getOfflineDb().getFirstSync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [BACKFILL_COMPLETE_KEY]
    );
    return row?.value === "1";
  } catch {
    return false;
  }
}

export function setBackfillComplete(): void {
  try {
    getOfflineDb().runSync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [BACKFILL_COMPLETE_KEY, "1"]
    );
  } catch {
    // Best-effort; ignore.
  }
}
