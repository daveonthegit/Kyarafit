import type { ByoMediaEntry } from "./byoMediaManifest";

/**
 * B2 adapter seam only; no Drive/OAuth implementation or network/platform imports in the engine.
 * Bind one instance to one account's authoritative remote. Credentials never enter snapshot JSON.
 * Snapshot writes may race; adapters/callers re-read, merge and retry to achieve convergence.
 * A rejected operation leaves local CRUD usable; reconnect/retry policy belongs to orchestration.
 */
export interface ByoSnapshotTransport {
  /** Missing remote file is null, distinct from malformed JSON or a rejected transport read. */
  readSnapshot(): Promise<string | null>;
  writeSnapshot(serialized: string): Promise<void>;
  /** Implementations MUST verify byte length and SHA-256, and never overwrite different bytes. */
  putMediaIfAbsent(entry: ByoMediaEntry, bytes: Uint8Array): Promise<void>;
  /** Implementations MUST verify the digest before returning original bytes. */
  readMedia(entry: ByoMediaEntry): Promise<Uint8Array>;
}
