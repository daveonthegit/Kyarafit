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

/**
 * Two-part variant of {@link runIdempotent} for handlers whose body is awkward to wrap in a closure
 * (e.g. those that destructure `...fields` or are large). Call {@link idempotentReplay} at the top
 * and return its stored result on a hit; call {@link idempotentRecord} exactly once at the single
 * trailing return. Record must run at most once per execution (one ledger row per key).
 */
export async function idempotentReplay(
  ctx: MutationCtx,
  key: string | undefined
): Promise<{ hit: true; result: unknown } | { hit: false }> {
  if (!key) return { hit: false };
  const existing = await ctx.db
    .query("idempotencyLedger")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return existing ? { hit: true, result: existing.result } : { hit: false };
}

export async function idempotentRecord<T>(
  ctx: MutationCtx,
  key: string | undefined,
  userId: string,
  result: T
): Promise<T> {
  if (key) {
    await ctx.db.insert("idempotencyLedger", {
      key,
      userId,
      createdAt: Date.now(),
      result: result as unknown,
    });
  }
  return result;
}
