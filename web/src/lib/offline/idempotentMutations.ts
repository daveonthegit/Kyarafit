/**
 * Convex mutations whose server handler accepts an `idempotencyKey` arg and dedupes replays via the
 * `idempotencyLedger` (see `convex/lib/idempotency.ts`). The sync worker injects the queued row's
 * idempotency key into the args of these mutations on replay, so a re-sent write can't insert a
 * duplicate row (DATA_AND_SYNC.md §6, REQ-D62).
 *
 * Only list mutations that actually declare `idempotencyKey` in their validator — passing it to a
 * mutation that doesn't would be rejected by Convex arg validation. This set MUST match every
 * handler that accepts `idempotencyKey` server-side (grep `convex/**` for `idempotencyKey`) and is
 * kept in parity with mobile's registry. No mutation may be enqueued offline unless it is listed
 * here (REQ-D62).
 *
 * Keys are Convex function names (`getFunctionName(api.x.y)`), e.g. `"builds:create"`.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
const IDEMPOTENT_MUTATIONS = new Set<string>([
  "builds:create",
  "builds:update",
  "builds:updateStatusMany",
  "builds:duplicate",
  "builds:addNodesToBuild",
  "conventions:create",
  "conventions:update",
  "conventions:archiveMany",
  "conventions:replacePlan",
  "conventions:addManualPackingItem",
  "workflow:create",
  "workflow:update",
  "workflow:move",
  "workflow:moveAndResequence",
  "users:setFocusedBuild",
  "buildProgressUpdates:add",
  "buildProgressUpdates:update",
]);

export function isIdempotentMutation(functionName: string): boolean {
  return IDEMPOTENT_MUTATIONS.has(functionName);
}
