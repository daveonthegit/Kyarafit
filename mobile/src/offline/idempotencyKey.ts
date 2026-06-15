import * as Crypto from "expo-crypto";

/**
 * Stable unique key for a queued offline mutation. Stored on the `mutation_queue` row (UNIQUE) so
 * a given queued op is replayed at most once per row, and available for server-side dedupe when
 * the `idempotencyLedger` wiring lands (blueprint §3.13.5).
 */
export function newIdempotencyKey(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
