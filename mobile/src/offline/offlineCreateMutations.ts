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
 * `buildReferenceImages:add` / `buildProcessPictures:add` accept an `idempotencyKey` (their handlers
 * use `idempotentReplay`/`idempotentRecord`), so an offline-enqueued create replays dedupe-safe
 * (REQ-D62). Offline they carry an `imageUrl` (the `imageStorageId` upload path needs the online-only
 * `files:generateUploadUrl` round-trip).
 */
const CREATE_MUTATIONS = new Set<string>([
  "builds:create",
  "conventions:create",
  "workflow:create",
  "buildProgressUpdates:add",
  "buildReferenceImages:add",
  "buildProcessPictures:add",
]);

export function isCreateMutation(functionName: string): boolean {
  return CREATE_MUTATIONS.has(functionName);
}
