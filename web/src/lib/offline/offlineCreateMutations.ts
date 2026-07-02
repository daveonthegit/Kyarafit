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
 * NOTE: `buildReferenceImages:add` / `buildProcessPictures:add` are intentionally NOT here — their
 * server handlers do not accept `idempotencyKey`, so enqueuing them offline would not be
 * replay-dedupe-safe (REQ-D62). Add them once the backend adopts `runIdempotent`. The idempotent
 * build-media create today is `buildProgressUpdates:add`.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
const CREATE_MUTATIONS = new Set<string>([
  "builds:create",
  "conventions:create",
  "workflow:create",
  "buildProgressUpdates:add",
]);

export function isCreateMutation(functionName: string): boolean {
  return CREATE_MUTATIONS.has(functionName);
}
