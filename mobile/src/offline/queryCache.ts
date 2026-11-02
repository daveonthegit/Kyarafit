import { getOfflineDb } from "./db";

/**
 * SQLite-backed read/write for cached Convex query results (stale-while-revalidate). Both helpers
 * are best-effort and never throw: on any failure (including web / RN-web where `expo-sqlite` may
 * be unavailable) they degrade to a cache miss / no-op so callers fall back to live Convex data.
 *
 * Backed by the `query_cache(query_key, payload_json, fetched_at)` table in `./db`. Bounded by the
 * existing storage caps + LRU eviction in `enforceOfflineStorageCaps`.
 */

/** Read a cached query payload by key. Returns `undefined` on miss or any failure. */
export function readOfflineQueryCache(key: string): unknown {
  try {
    const db = getOfflineDb();
    const row = db.getFirstSync<{ payload_json: string }>(
      "SELECT payload_json FROM query_cache WHERE query_key = ?",
      [key]
    );
    if (!row) return undefined;
    return JSON.parse(row.payload_json) as unknown;
  } catch {
    return undefined;
  }
}

/** Upsert a query payload by key. Best-effort; swallows failures so callers never crash. */
export function writeOfflineQueryCache(key: string, payload: unknown): void {
  try {
    const json = JSON.stringify(payload);
    // JSON.stringify returns undefined for non-serializable top-level values (e.g. a function).
    if (json === undefined) return;
    const db = getOfflineDb();
    db.runSync(
      "INSERT OR REPLACE INTO query_cache (query_key, payload_json, fetched_at) VALUES (?, ?, ?)",
      [key, json, Date.now()]
    );
  } catch {
    // Best-effort cache; ignore.
  }
}
