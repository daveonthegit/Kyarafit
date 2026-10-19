import { getOfflineDb, isVaultOpen } from "./db";

/**
 * The vault's durable replication queue (`mutation_queue`), drained by the paid sync worker.
 *
 * Rows are appended ONLY by `VaultStore.commit`, inside the same SQLite transaction as the local
 * change they describe, so a queued op always has its local data and vice versa. Rows are never
 * evicted: a row leaves the queue only when the server acknowledged it (`deleteMutation`). Rows past
 * the retry ceiling are parked as `failed` (kept, visible, retryable) rather than dropped.
 *
 * Drain-path helpers throw on SQLite failure so the worker stops instead of losing its place; the
 * status counters read 0 while the vault is locked.
 */

export type PendingMutation = {
  id: number;
  idempotency_key: string;
  fn: string;
  args_json: string;
  retry_count: number;
  /** Local id of the entity an op creates (see `./clientId`); null otherwise. */
  client_id: string | null;
  /** JSON `[[table, id], ...]` of the vault rows this op covers. */
  touched_json: string | null;
};

/** Pending rows in FIFO order (oldest first). */
export function listPendingMutations(limit = 100): PendingMutation[] {
  return getOfflineDb().getAllSync<PendingMutation>(
    `SELECT id, idempotency_key, fn, args_json, retry_count, client_id, touched_json
     FROM mutation_queue WHERE status = 'pending' ORDER BY id ASC LIMIT ?`,
    [limit]
  );
}

/** Remove a row after the server acknowledged its replay. */
export function deleteMutation(id: number): void {
  getOfflineDb().runSync(`DELETE FROM mutation_queue WHERE id = ?`, [id]);
}

/** Increment retry count after a transient failure. */
export function bumpMutationRetry(id: number): void {
  getOfflineDb().runSync(`UPDATE mutation_queue SET retry_count = retry_count + 1 WHERE id = ?`, [
    id,
  ]);
}

/** Park a row whose retries are exhausted. It stays in the queue (visible, retryable), never dropped. */
export function failMutation(id: number): void {
  getOfflineDb().runSync(`UPDATE mutation_queue SET status = 'failed' WHERE id = ?`, [id]);
}

function countByStatus(status: "pending" | "failed"): number {
  if (!isVaultOpen()) return 0;
  try {
    const row = getOfflineDb().getFirstSync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mutation_queue WHERE status = ?`,
      [status]
    );
    return row?.c ?? 0;
  } catch (error) {
    console.warn("[vault] queue count failed", error);
    return 0;
  }
}

/** Count of pending rows awaiting replay (sync status, REQ-D64). */
export function countPendingMutations(): number {
  return countByStatus("pending");
}

/** Count of rows past the retry ceiling (failed-sync error state, REQ-D64). */
export function countFailedMutations(): number {
  return countByStatus("failed");
}

/**
 * Reset failed rows back to pending (retry counter cleared) so a manual "sync now" can retry them
 * (REQ-D64 actionable error state). Returns the number of rows requeued.
 */
export function requeueFailedMutations(): number {
  const db = getOfflineDb();
  const before = db.getFirstSync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'failed'`
  );
  db.runSync(
    `UPDATE mutation_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed'`
  );
  return before?.c ?? 0;
}
