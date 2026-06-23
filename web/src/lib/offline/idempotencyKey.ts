/**
 * Stable unique key for a queued offline mutation. Stored on the mutation queue row (UNIQUE) so a
 * given queued op is replayed at most once per row, and injected into args for server-side dedupe
 * via the `idempotencyLedger` (DATA_AND_SYNC.md §6, REQ-D62).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
export function newIdempotencyKey(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fall through to the time-based fallback
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
