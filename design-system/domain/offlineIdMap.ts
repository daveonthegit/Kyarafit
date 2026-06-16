/**
 * Shared, platform-agnostic helpers for the offline `clientId` / `id_map` machinery
 * (local-first plan, blueprint §3.13.3). Pure functions only — unit-testable in plain Node and
 * reused by the mobile (and future web) sync workers so id-rewriting behaviour is identical.
 *
 * An offline-created entity has no server id yet, so the bridge mints a temporary **client id**
 * (prefixed, so it is recognizable) and hands it back optimistically. When the create is later
 * replayed and the server returns the real `_id`, the worker records `clientId -> serverId` in the
 * `id_map`. Any *subsequent* queued op that referenced the client id (e.g. `addNodesToBuild` with
 * the optimistic build id) is rewritten to the real server id before being sent.
 */

/** Prefix that marks an id as a not-yet-synced, locally-minted client id. */
export const LOCAL_ID_PREFIX = "local:";

/** Whether a value is a locally-minted client id (vs. a real Convex document id). */
export function isClientId(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(LOCAL_ID_PREFIX);
}

/**
 * Recursively replace any string that is a known client id with its mapped server id, anywhere in
 * a (JSON-shaped) args value — strings, arrays, and plain objects. Object keys are left untouched;
 * only values are rewritten. Returns a new value; the input is not mutated. Values with no mapping
 * (including not-yet-synced client ids) pass through unchanged.
 */
export function rewriteIdsDeep<T>(value: T, idMap: Readonly<Record<string, string>>): T {
  if (typeof value === "string") {
    const mapped = idMap[value];
    return (mapped ?? value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteIdsDeep(entry, idMap)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteIdsDeep(entry, idMap);
    }
    return out as T;
  }
  return value;
}

/**
 * Whether any string within an args value still references an unmapped client id — i.e. a queued op
 * depends on a create that has not synced yet, so it cannot be replayed in order. Lets the worker
 * defer such ops instead of sending a dangling client id to the server.
 */
export function hasUnmappedClientId(
  value: unknown,
  idMap: Readonly<Record<string, string>>
): boolean {
  if (typeof value === "string") {
    return isClientId(value) && idMap[value] === undefined;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasUnmappedClientId(entry, idMap));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      hasUnmappedClientId(entry, idMap)
    );
  }
  return false;
}
