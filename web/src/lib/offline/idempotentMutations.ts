/**
 * Convex mutations whose server handler accepts an `idempotencyKey` arg and dedupes replays via the
 * `idempotencyLedger` (see `convex/lib/idempotency.ts`). The sync worker injects the queued row's
 * idempotency key into the args of these mutations on replay, so a re-sent write can't insert a
 * duplicate row (DATA_AND_SYNC.md §6, REQ-D62).
 *
 * Only list mutations that actually declare `idempotencyKey` in their validator. Web Wave 3 scope:
 * the migrated Builds-list slice. Keys are Convex function names (`getFunctionName(api.x.y)`).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
const IDEMPOTENT_MUTATIONS = new Set<string>([
  "builds:create",
  "builds:update",
  "builds:updateStatusMany",
]);

export function isIdempotentMutation(functionName: string): boolean {
  return IDEMPOTENT_MUTATIONS.has(functionName);
}
