import { cleanupMutation as internalMutation } from "./lib/guardedMutation";
import { makeFunctionReference } from "convex/server";
import { deletionEpoch } from "./lib/deletionReferences";
import { initialLedgerCheckpoint, inspectLedgerChunk } from "./lib/ledgerInspection";

const validateNext = makeFunctionReference<"mutation", Record<string, never>>(
  "idempotencyLedger:validateResults"
);

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
    // Reuse the existing maintenance trigger; no public caller can launch or bypass inspection.
    await ctx.scheduler.runAfter(0, validateNext, {});
    return { deleted: stale.length };
  },
});

/** Resumable inspection of pre-guard results; retained rejection markers never repeat side effects. */
export const validateResults = internalMutation({
  args: {},
  handler: async (ctx) => {
    const generation = await deletionEpoch(ctx);
    let state = await ctx.db.query("ledgerValidationState").first();
    if (state?.ledgerRowId) {
      const row = await ctx.db.get(state.ledgerRowId);
      if (row && !row.replayBlocked && row.validatedEpoch !== generation) {
        const unchanged =
          row.resultRevision === state.ledgerResultRevision &&
          generation === state.ledgerGeneration;
        const checkpoint =
          unchanged && state.ledgerCursor
            ? JSON.parse(state.ledgerCursor)
            : initialLedgerCheckpoint();
        const inspected = await inspectLedgerChunk(ctx, row.result, checkpoint);
        if (!inspected.done) {
          await ctx.db.patch(state._id, {
            ledgerCursor: JSON.stringify(inspected.checkpoint),
            ledgerGeneration: generation,
            ledgerResultRevision: row.resultRevision,
          });
          await ctx.scheduler.runAfter(0, validateNext, {});
          return;
        }
        await ctx.db.patch(
          row._id,
          inspected.blocked
            ? {
                result: undefined,
                replayBlocked: true,
                subjectHashes: undefined,
                validatedEpoch: generation,
                resultRevision: crypto.randomUUID(),
              }
            : {
                subjectHashes: inspected.checkpoint.subjects,
                validatedEpoch: generation,
                resultRevision: row.resultRevision ?? crypto.randomUUID(),
              }
        );
      } else if (row?.replayBlocked && row.validatedEpoch !== generation)
        await ctx.db.patch(row._id, { validatedEpoch: generation });
      if (state.pageDone) await ctx.db.delete(state._id);
      else
        await ctx.db.patch(state._id, {
          cursor: state.nextCursor,
          ledgerRowId: undefined,
          ledgerCursor: undefined,
          ledgerGeneration: undefined,
          ledgerResultRevision: undefined,
          nextCursor: undefined,
          pageDone: undefined,
        });
      // Start fresh after a finished page to catch a generation change during a long scan.
      await ctx.scheduler.runAfter(0, validateNext, {});
      return;
    }
    const page = await ctx.db
      .query("idempotencyLedger")
      .withIndex("by_validatedEpoch", (q) => q.lt("validatedEpoch", generation))
      .paginate({ cursor: state?.cursor ?? null, numItems: 1 });
    const row = page.page[0];
    if (!row) {
      if (state) await ctx.db.delete(state._id);
      return;
    }
    const patch = {
      ledgerRowId: row._id,
      ledgerCursor: JSON.stringify(initialLedgerCheckpoint()),
      ledgerGeneration: generation,
      ledgerResultRevision: row.resultRevision,
      nextCursor: page.isDone ? undefined : page.continueCursor,
      pageDone: page.isDone,
    };
    if (state) await ctx.db.patch(state._id, patch);
    else {
      const id = await ctx.db.insert("ledgerValidationState", patch);
      state = await ctx.db.get(id);
    }
    await ctx.scheduler.runAfter(0, validateNext, {});
  },
});
