/**
 * Shared, platform-agnostic helpers for the offline-first query cache (Phase 0 of the
 * local-first plan). Pure functions only — no SQLite/IndexedDB/Convex imports — so the mobile
 * SQLite cache and the future web (OPFS) cache derive identical keys, and the logic stays
 * unit-testable in plain Node.
 */

/** Sentinel Convex `useQuery` accepts to skip execution. Skipped queries are never cached. */
export const OFFLINE_QUERY_SKIP = "skip";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Deterministic JSON serialization: object keys are sorted recursively so two argument objects
 * that are deeply equal but differ in key order produce the same string. Arrays keep their order.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/**
 * Build a stable cache key for a Convex query identified by `functionName` (e.g. the value of
 * `getFunctionName(api.x.y)`) and its `args`. Returns `null` when the query is not cacheable —
 * i.e. it is skipped — so callers bypass the cache entirely. `undefined` args (no-arg queries)
 * are normalized to an empty object so they key identically to an explicit `{}`.
 */
export function offlineQueryKey(functionName: string, args: unknown): string | null {
  if (args === OFFLINE_QUERY_SKIP) return null;
  const normalizedArgs = args === undefined ? {} : args;
  return `${functionName}:${stableStringify(normalizedArgs)}`;
}
