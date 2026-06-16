/**
 * Convex mutations that **create a single new entity** and return its document. When one of these
 * runs offline, the bridge mints a `clientId` (see `./clientId`), hands it back optimistically as
 * the new row's `_id`, and stores it on the queue row. On replay the worker maps that `clientId` to
 * the server `_id` (`./idMap`) so later queued ops that referenced the optimistic id are rewritten
 * to the real id before being sent (`offlineIdMap.rewriteIdsDeep`).
 *
 * Only list creates whose handler returns a doc with `_id` and accept an `idempotencyKey` (so a
 * replay returns the same row rather than inserting a duplicate). Keys are Convex function names
 * (`getFunctionName(api.x.y)`), e.g. `"builds:create"`.
 */
const CREATE_MUTATIONS = new Set<string>([
  "builds:create",
  "conventions:create",
  "workflow:create",
]);

export function isCreateMutation(functionName: string): boolean {
  return CREATE_MUTATIONS.has(functionName);
}
