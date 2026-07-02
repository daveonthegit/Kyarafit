import { getOfflineDb } from "./db";

/**
 * SQLite-backed offline mutation queue (blueprint §3.13.3), over the `mutation_queue` table in
 * `./db`. All helpers are best-effort and never throw, degrading to no-ops / empty results so
 * callers never crash (e.g. web / RN-web where `expo-sqlite` may be unavailable).
 */

export type PendingMutation = {
  id: number;
  idempotency_key: string;
  fn: string;
  args_json: string;
  retry_count: number;
  /** Optimistic client id minted for an offline create (see `./clientId`); null otherwise. */
  client_id: string | null;
};

/**
 * Append a mutation for later replay. Idempotency key is UNIQUE, so re-enqueues are ignored.
 * `clientId` is set only for offline creates, so the worker can map it to the server `_id` on
 * replay (see `./idMap`).
 */
export function enqueueMutation(
  fn: string,
  args: unknown,
  idempotencyKey: string,
  clientId?: string
): void {
  try {
    const argsJson = JSON.stringify(args ?? {}) ?? "{}";
    const db = getOfflineDb();
    db.runSync(
      `INSERT OR IGNORE INTO mutation_queue (idempotency_key, op, fn, args_json, client_id, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [idempotencyKey, "mutation", fn, argsJson, clientId ?? null, Date.now()]
    );
  } catch {
    // Best-effort; ignore.
  }
}

/** Pending rows in FIFO order (oldest first). */
export function listPendingMutations(limit = 100): PendingMutation[] {
  try {
    const db = getOfflineDb();
    return db.getAllSync<PendingMutation>(
      `SELECT id, idempotency_key, fn, args_json, retry_count, client_id
       FROM mutation_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?`,
      [limit]
    );
  } catch {
    return [];
  }
}

/** Remove a row after a successful replay. */
export function deleteMutation(id: number): void {
  try {
    getOfflineDb().runSync(`DELETE FROM mutation_queue WHERE id = ?`, [id]);
  } catch {
    // Best-effort; ignore.
  }
}

/** Increment retry count after a transient failure. */
export function bumpMutationRetry(id: number): void {
  try {
    getOfflineDb().runSync(`UPDATE mutation_queue SET retry_count = retry_count + 1 WHERE id = ?`, [
      id,
    ]);
  } catch {
    // Best-effort; ignore.
  }
}

/** Mark a row permanently failed (retries exhausted) so it stops blocking the queue. */
export function failMutation(id: number): void {
  try {
    getOfflineDb().runSync(`UPDATE mutation_queue SET status = 'failed' WHERE id = ?`, [id]);
  } catch {
    // Best-effort; ignore.
  }
}

/** Count of pending rows awaiting replay (sync-status badge, REQ-D64). */
export function countPendingMutations(): number {
  try {
    const row = getOfflineDb().getFirstSync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'pending'`
    );
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

/** Count of rows past the retry ceiling (surfaced as the failed-sync error state, REQ-D64). */
export function countFailedMutations(): number {
  try {
    const row = getOfflineDb().getFirstSync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'failed'`
    );
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Reset failed rows back to pending (retry counter cleared) so a manual "sync now" can retry them
 * (REQ-D64 actionable error state). Returns the number of rows requeued.
 */
export function requeueFailedMutations(): number {
  try {
    const db = getOfflineDb();
    const before = db.getFirstSync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'failed'`
    );
    db.runSync(
      `UPDATE mutation_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed'`
    );
    return before?.c ?? 0;
  } catch {
    return 0;
  }
}
