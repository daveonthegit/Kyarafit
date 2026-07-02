/**
 * Convex mutations that **create a single new entity** and return its document. When one of these
 * runs offline, the bridge mints a `clientId` (see `./clientId`), hands it back optimistically as
 * the new row's `_id`, and stores it on the queue row. On replay the worker maps that `clientId` to
 * the server `_id` (`./idMap`) so later queued ops that referenced the optimistic id are rewritten
 * to the real id before being sent (`offlineIdMap.rewriteIdsDeep`).
 *
 * Only list creates whose handler returns a doc with `_id` and accept an `idempotencyKey` (so a
 * replay returns the same row rather than inserting a duplicate — REQ-D62). Every entry here MUST
 * also be in `idempotentMutations`. Kept in parity with web. Keys are Convex function names
 * (`getFunctionName(api.x.y)`), e.g. `"builds:create"`.
 *
 * NOTE: `buildReferenceImages:add` / `buildProcessPictures:add` are intentionally NOT here — their
 * server handlers do not accept `idempotencyKey`, so enqueuing them offline would not be
 * replay-dedupe-safe (REQ-D62). The idempotent build-media create today is `buildProgressUpdates:add`.
 */
const CREATE_MUTATIONS = new Set<string>([
  "builds:create",
  "conventions:create",
  "workflow:create",
  "elements:create",
  "buildProgressUpdates:add",
]);

export function isCreateMutation(functionName: string): boolean {
  return CREATE_MUTATIONS.has(functionName);
}
