import { compareText, fail, keys, object, timestamp } from "./byoSnapshotJson";

/** Immutable original bytes, named by their lowercase SHA-256 digest (not a hosted URL/key). */
export interface ByoMediaEntry {
  hash: string;
  byteLength: number;
}

export function validateMediaHash(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    fail("Expected a lowercase SHA-256 media digest.");
  }
  return value;
}

/** Equal content hashes must describe the same immutable bytes; disagreement is corruption. */
export function mergeMediaManifests(...manifests: readonly unknown[]): ByoMediaEntry[] {
  const byHash = new Map<string, ByoMediaEntry>();
  for (const manifest of manifests) {
    if (!Array.isArray(manifest) || manifest.length > 100_000) fail("Invalid media manifest.");
    for (const raw of manifest) {
      const entry = object(raw);
      keys(entry, ["hash", "byteLength"]);
      const hash = validateMediaHash(entry.hash);
      const byteLength = timestamp(entry.byteLength);
      const prior = byHash.get(hash);
      if (prior && prior.byteLength !== byteLength) fail("Conflicting immutable media size.");
      byHash.set(hash, { hash, byteLength });
    }
  }
  if (byHash.size > 100_000) fail("Media manifest exceeds the entry limit.");
  return [...byHash.values()].sort((a, b) => compareText(a.hash, b.hash));
}

/**
 * P2 COMPATIBILITY SEAM: adapters must extract/restore media references after P2 freezes imageRefs.
 * Do not infer hashes from legacy storage ids, remote URLs, or hosted R2 keys. Original bytes must
 * be hashed and verified by the adapter; the pure engine never reads or transforms media.
 */
export interface ByoMediaReferenceAdapter<T> {
  toSnapshotData(row: T): { data: Record<string, unknown>; mediaHashes: string[] };
  fromSnapshotData(data: Record<string, unknown>, mediaHashes: readonly string[]): T;
}
