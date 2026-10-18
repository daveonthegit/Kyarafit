import {
  BYO_PERSONAL_TABLES,
  BYO_TOMBSTONE_RETENTION_MS,
  emptyByoSnapshot,
  validateByoSnapshot,
  type ByoDeletionMarker,
  type ByoSnapshot,
  type ByoSnapshotRecord,
} from "./byoSnapshot";
import { mergeMediaManifests } from "./byoMediaManifest";
import { canonicalJson, compareText, timestamp } from "./byoSnapshotJson";

type Candidate =
  { retired: false; row: ByoSnapshotRecord } | { retired: true; row: ByoDeletionMarker };

/**
 * A total order makes merge a join (commutative, associative, idempotent). Clocks are milliseconds
 * supplied by callers, never clamped against this device's clock. Skew may lose an edit under LWW;
 * changing clocks during merge would break convergence. Deletion time counts as a write, even if
 * an older adapter did not advance updatedAt. At equal clocks deletion beats a live row; then
 * deletion time, update time, compact-marker status, and canonical JSON break all remaining ties.
 */
function compare(a: Candidate, b: Candidate): number {
  const aDeleted = a.row.deletedAt !== null;
  const bDeleted = b.row.deletedAt !== null;
  return (
    Math.max(a.row.updatedAt, a.row.deletedAt ?? 0) -
      Math.max(b.row.updatedAt, b.row.deletedAt ?? 0) ||
    Number(aDeleted) - Number(bDeleted) ||
    (a.row.deletedAt ?? 0) - (b.row.deletedAt ?? 0) ||
    a.row.updatedAt - b.row.updatedAt ||
    Number(a.retired) - Number(b.retired) ||
    compareText(canonicalJson(a.row), canonicalJson(b.row))
  );
}

/** Whole-record BYO LWW, deliberately separate from managed sync's per-field offlineConflict. */
export function mergeByoSnapshots(left: ByoSnapshot, right: ByoSnapshot): ByoSnapshot {
  const inputs = [validateByoSnapshot(left), validateByoSnapshot(right)];
  const result = emptyByoSnapshot();
  result.media = mergeMediaManifests(...inputs.map((input) => input.media));
  for (const table of BYO_PERSONAL_TABLES) {
    const byId = new Map<string, Candidate>();
    for (const input of inputs) {
      const candidates: Candidate[] = [
        ...input.tables[table].map((row): Candidate => ({ retired: false, row })),
        ...input.retired[table].map((row): Candidate => ({ retired: true, row })),
      ];
      for (const candidate of candidates) {
        const prior = byId.get(candidate.row.id);
        if (!prior || compare(candidate, prior) > 0) byId.set(candidate.row.id, candidate);
      }
    }
    for (const candidate of byId.values()) {
      if (candidate.retired) result.retired[table].push(candidate.row);
      else result.tables[table].push(candidate.row);
    }
  }
  return validateByoSnapshot(result);
}

/**
 * After ~90 days, discard deleted payloads/media refs, NOT deletion knowledge. Simply dropping
 * tombstones would allow a long-offline device/export to resurrect data. Compact per-id markers
 * therefore persist indefinitely. A deliberate newer live write can restore the same identity.
 * No implicit pruning occurs in merge, and unreferenced immutable files are not deleted here.
 */
export function compactByoTombstones(snapshot: ByoSnapshot, now: number): ByoSnapshot {
  timestamp(now);
  const result = validateByoSnapshot(snapshot);
  for (const table of BYO_PERSONAL_TABLES) {
    result.tables[table] = result.tables[table].filter((row) => {
      if (
        row.deletedAt === null ||
        Math.max(row.deletedAt, row.updatedAt) > now - BYO_TOMBSTONE_RETENTION_MS
      ) {
        return true;
      }
      result.retired[table].push({
        id: row.id,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      });
      return false;
    });
  }
  return validateByoSnapshot(result);
}
