import type { MutationCtx } from "../_generated/server";

/**
 * Run a mutation body at most once per idempotency `key` (blueprint §3.13.5).
 *
 * The offline sync worker replays queued mutations at-least-once (a lost response can trigger a
 * retry of an already-committed write). Offline-capable mutations pass the queued `idempotencyKey`;
 * this helper records the key + result in the `idempotencyLedger` on first execution and, on any
 * replay with the same key, returns the stored result without re-running the body — so a replayed
 * create can never insert a duplicate row.
 *
 * When `key` is undefined/empty (e.g. an online call that never went through the queue), the body
 * runs normally with no ledger interaction.
 */
export async function runIdempotent<T>(
  ctx: MutationCtx,
  key: string | undefined,
  userId: string,
  run: () => Promise<T>
): Promise<T> {
  if (!key) return run();

  const existing = await ctx.db
    .query("idempotencyLedger")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (existing) {
    return existing.result as T;
  }

  const result = await run();
  await ctx.db.insert("idempotencyLedger", {
    key,
    userId,
    createdAt: Date.now(),
    result: result as unknown,
  });
  return result;
}
