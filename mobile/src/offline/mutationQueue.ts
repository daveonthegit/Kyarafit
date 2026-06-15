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
};

/** Append a mutation for later replay. Idempotency key is UNIQUE, so re-enqueues are ignored. */
export function enqueueMutation(fn: string, args: unknown, idempotencyKey: string): void {
  try {
    const argsJson = JSON.stringify(args ?? {}) ?? "{}";
    const db = getOfflineDb();
    db.runSync(
      `INSERT OR IGNORE INTO mutation_queue (idempotency_key, op, fn, args_json, created_at, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [idempotencyKey, "mutation", fn, argsJson, Date.now()]
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
      `SELECT id, idempotency_key, fn, args_json, retry_count
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
