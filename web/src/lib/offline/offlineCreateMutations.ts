/**
 * Convex mutations that create a single new entity and return its document. When one runs offline,
 * the bridge mints a `clientId` (see `./clientId`), hands it back optimistically as the new row's
 * `_id`, and stores it on the queue row. On replay the worker maps that `clientId` to the server
 * `_id` so later queued ops that referenced the optimistic id are rewritten before send.
 *
 * Only list creates whose handler returns a doc with `_id` AND accept an `idempotencyKey` (so a
 * replay returns the same row rather than inserting a duplicate — REQ-D62). Every entry here MUST
 * also be in `idempotentMutations`. Kept in parity with mobile. Keys are Convex function names
 * (`getFunctionName(api.x.y)`).
 *
 * `buildReferenceImages:add` / `buildProcessPictures:add` accept an `idempotencyKey` (their handlers
 * use `idempotentReplay`/`idempotentRecord`), so an offline-enqueued create replays dedupe-safe
 * (REQ-D62). Offline they carry an `imageUrl` (the `imageStorageId` upload path needs the online-only
 * `files:generateUploadUrl` round-trip).
 *
 * OFFLINE CORE: never imports `convex/react`.
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
