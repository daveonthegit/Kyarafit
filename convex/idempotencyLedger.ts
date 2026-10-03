import { internalMutation } from "./_generated/server";

/**
 * Maintenance for the offline replay dedupe ledger (see convex/lib/idempotency.ts).
 *
 * Each offline-replayed mutation records a session/operation-scoped key. A daily cron calls
 * `prune` for both scoped and legacy rows. Dedupe lasts only for the retention window: a retry
 * after expiration executes again, so clients must not rely on permanent deduplication.
 */

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PRUNE_BATCH = 500;

export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const stale = await ctx.db
      .query("idempotencyLedger")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(PRUNE_BATCH);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return { deleted: stale.length };
  },
});
