/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per DATA_AND_SYNC.md §6.1 (REQ-D65/66).
 *
 * Per-field last-write-wins merge for sync. For each field, the value with the greater
 * `fieldUpdatedAt` timestamp wins (fallback to row `updatedAt`). A tombstone (`deletedAt`) wins over
 * any older edit. Equal timestamps resolve deterministically: higher `version`, then lexicographically
 * greater `clientId`.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export interface SyncRow {
  [key: string]: unknown;
  version?: number;
  clientId?: string;
  updatedAt?: number;
  /** Per-field last-modified timestamps (ms). */
  fieldUpdatedAt?: Record<string, number>;
  /** Soft-delete tombstone (ms). */
  deletedAt?: number | null;
}

const META_KEYS: ReadonlySet<string> = new Set([
  "version",
  "clientId",
  "updatedAt",
  "fieldUpdatedAt",
  "deletedAt",
]);

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

/** Effective last-modified time for a single data field, falling back to the row's `updatedAt`. */
function fieldTimestamp(row: SyncRow, field: string): number {
  const ts = row.fieldUpdatedAt?.[field];
  if (typeof ts === "number") return ts;
  return numberOr(row.updatedAt, 0);
}

/** Latest data-edit time for a row (ignores the tombstone). */
function latestEditTime(row: SyncRow): number {
  let max = numberOr(row.updatedAt, 0);
  if (row.fieldUpdatedAt) {
    for (const ts of Object.values(row.fieldUpdatedAt)) {
      if (typeof ts === "number" && ts > max) max = ts;
    }
  }
  return max;
}

/** Deterministic tie-break when timestamps are equal: higher `version`, then greater `clientId`. */
function remoteWinsTie(local: SyncRow, remote: SyncRow): boolean {
  const lv = numberOr(local.version, 0);
  const rv = numberOr(remote.version, 0);
  if (rv !== lv) return rv > lv;
  const lc = typeof local.clientId === "string" ? local.clientId : "";
  const rc = typeof remote.clientId === "string" ? remote.clientId : "";
  return rc > lc;
}

/** Merge two versions of the same row field-by-field (LWW). Returns the merged row. */
export function mergeFieldLWW<T extends SyncRow>(local: T, remote: T): T {
  const merged: Record<string, unknown> = {};

  const dataFields = new Set<string>();
  for (const key of Object.keys(local)) {
    if (!META_KEYS.has(key)) dataFields.add(key);
  }
  for (const key of Object.keys(remote)) {
    if (!META_KEYS.has(key)) dataFields.add(key);
  }

  for (const field of Array.from(dataFields)) {
    const inLocal = field in local;
    const inRemote = field in remote;
    if (inLocal && !inRemote) {
      merged[field] = local[field];
      continue;
    }
    if (inRemote && !inLocal) {
      merged[field] = remote[field];
      continue;
    }
    const lt = fieldTimestamp(local, field);
    const rt = fieldTimestamp(remote, field);
    let useRemote: boolean;
    if (rt > lt) useRemote = true;
    else if (lt > rt) useRemote = false;
    else useRemote = remoteWinsTie(local, remote);
    merged[field] = useRemote ? remote[field] : local[field];
  }

  const lv = numberOr(local.version, 0);
  const rv = numberOr(remote.version, 0);
  if (local.version !== undefined || remote.version !== undefined) {
    merged.version = Math.max(lv, rv);
  }

  const lu = numberOr(local.updatedAt, 0);
  const ru = numberOr(remote.updatedAt, 0);
  if (local.updatedAt !== undefined || remote.updatedAt !== undefined) {
    merged.updatedAt = Math.max(lu, ru);
  }

  const newerRow = ru > lu || (ru === lu && remoteWinsTie(local, remote)) ? remote : local;
  if (typeof newerRow.clientId === "string") {
    merged.clientId = newerRow.clientId;
  }

  if (local.fieldUpdatedAt || remote.fieldUpdatedAt) {
    const fieldTimes: Record<string, number> = {};
    for (const src of [local.fieldUpdatedAt, remote.fieldUpdatedAt]) {
      if (!src) continue;
      for (const [field, ts] of Object.entries(src)) {
        if (typeof ts !== "number") continue;
        const existing = fieldTimes[field];
        if (existing === undefined || ts > existing) fieldTimes[field] = ts;
      }
    }
    merged.fieldUpdatedAt = fieldTimes;
  }

  const localDel = typeof local.deletedAt === "number" ? local.deletedAt : null;
  const remoteDel = typeof remote.deletedAt === "number" ? remote.deletedAt : null;
  const localTombWins = localDel !== null && localDel >= latestEditTime(remote);
  const remoteTombWins = remoteDel !== null && remoteDel >= latestEditTime(local);
  let mergedDel: number | null = null;
  if (localTombWins && remoteTombWins) mergedDel = Math.max(localDel, remoteDel);
  else if (localTombWins) mergedDel = localDel;
  else if (remoteTombWins) mergedDel = remoteDel;
  if (mergedDel !== null) merged.deletedAt = mergedDel;

  return merged as T;
}
