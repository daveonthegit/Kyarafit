/**
 * Convex mutations that create a single new entity and return its document. When one runs offline,
 * the bridge mints a `clientId` (see `./clientId`), hands it back optimistically as the new row's
 * `_id`, and stores it on the queue row. On replay the worker maps that `clientId` to the server
 * `_id` so later queued ops that referenced the optimistic id are rewritten before send.
 *
 * Web Wave 3 scope: only the migrated Builds-list slice (`builds:create`). Grow this set as more
 * screens move onto the bridge. Keys are Convex function names (`getFunctionName(api.x.y)`).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
const CREATE_MUTATIONS = new Set<string>(["builds:create"]);

export function isCreateMutation(functionName: string): boolean {
  return CREATE_MUTATIONS.has(functionName);
}
