import type { MutationCtx } from "../_generated/server";
import { requireIdentity } from "./authz";

/**
 * Dedupe at-least-once offline writes by (session actor, server-selected operation, key).
 * Callers use a stable module.function operation literal, never a client argument.
 * The mutation body and ledger insert commit atomically; Convex retries index conflicts.
 * Empty keys run normally. Retention is bounded by the ledger prune job.
 *
 * Legacy rows have no operation and are deliberately never replayed or promoted: their
 * operation cannot be recovered safely. They expire through the existing age-based prune.
 */
export async function runIdempotent<T>(
  ctx: MutationCtx,
  key: string | undefined,
  userId: string,
  operation: string,
  run: () => Promise<T>
): Promise<T> {
  const actorId = await requireIdentity(ctx);
  if (actorId !== userId) throw new Error("Unauthorized");
  if (!operation) throw new Error("Missing idempotency operation");
  const replay = await idempotentReplay(ctx, key, operation);
  if (replay.hit) return replay.result as T;
  return idempotentRecord(ctx, key, actorId, await run(), operation);
}

/**
 * Two-part variant: authenticate before calling; return on a hit and record once at the end.
 * Every caller must supply a nonempty server-selected operation, even for unkeyed writes.
 */
export async function idempotentReplay(
  ctx: MutationCtx,
  key: string | undefined,
  operation: string
): Promise<{ hit: true; result: unknown } | { hit: false }> {
  const actorId = await requireIdentity(ctx);
  if (!operation) throw new Error("Missing idempotency operation");
  if (!key) return { hit: false };
  const existing = await ctx.db
    .query("idempotencyLedger")
    .withIndex("by_userId_operation_key", (q) =>
      q.eq("userId", actorId).eq("operation", operation).eq("key", key)
    )
    .unique();
  return existing ? { hit: true, result: existing.result } : { hit: false };
}

/** Verify the session actor and record only operation-scoped results. */
export async function idempotentRecord<T>(
  ctx: MutationCtx,
  key: string | undefined,
  userId: string,
  result: T,
  operation: string
): Promise<T> {
  const actorId = await requireIdentity(ctx);
  if (actorId !== userId) throw new Error("Unauthorized");
  if (!operation) throw new Error("Missing idempotency operation");
  if (key) {
    await ctx.db.insert("idempotencyLedger", {
      key,
      userId: actorId,
      operation,
      createdAt: Date.now(),
      result: result as unknown,
    });
  }
  return result;
}
