/**
 * Mutations that must never be queued for offline replay — they require a live server round-trip to
 * be meaningful (e.g. minting a one-time upload URL). `useOfflineMutation` always calls these
 * directly against Convex, so offline they fail naturally (exactly like a plain Convex call) rather
 * than enqueuing a useless op or resolving to `undefined` and breaking the caller.
 *
 * Parity with mobile's `onlineOnlyMutations`. Keys are Convex function names
 * (`getFunctionName(api.x.y)`), e.g. `"files:generateUploadUrl"`.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
const ONLINE_ONLY_MUTATIONS = new Set<string>(["files:generateUploadUrl"]);

export function isOnlineOnlyMutation(functionName: string): boolean {
  return ONLINE_ONLY_MUTATIONS.has(functionName);
}
