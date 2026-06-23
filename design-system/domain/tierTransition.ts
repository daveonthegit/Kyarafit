/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per DATA_AND_SYNC.md §10 (REQ-D95/96).
 *
 * Pure logic for tier transitions:
 * - Upgrade backfill must be idempotent across devices (never duplicate rows already on the server).
 * - Downgrade must stop sync and PRESERVE local data — it must never delete the local store.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export interface BackfillRow {
  /** Client-minted stable id used by the server idempotency ledger to dedupe upserts. */
  clientId: string;
  [key: string]: unknown;
}

/**
 * Rows to push during an upgrade backfill: only those whose clientId is not already present on the
 * server (dedupe across devices). Pure; preserves input order.
 */
export function selectBackfillRows<T extends BackfillRow>(
  localRows: T[],
  serverClientIds: string[]
): T[] {
  const present = new Set(serverClientIds);
  return localRows.filter((row) => !present.has(row.clientId));
}

export interface DowngradePlan {
  stopSync: boolean;
  keepLocalData: boolean;
  deleteLocalData: boolean;
}

/** Downgrade plan: stop sync, keep local data, never delete it. */
export function planDowngrade(): DowngradePlan {
  return { stopSync: true, keepLocalData: true, deleteLocalData: false };
}
