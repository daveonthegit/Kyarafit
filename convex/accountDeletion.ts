import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteUserOwnedData, scheduleDeletion, stepDeletion } from "./lib/accountDeletion";

const stepRef = makeFunctionReference<
  "mutation",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:step");
const failRef = makeFunctionReference<
  "mutation",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:fail");
const jobArgs = { jobId: v.id("accountDeletionJobs") };
const stepArgs = { ...jobArgs, revision: v.number() };

export const begin = internalMutation({
  args: { externalId: v.string() },
  handler: (ctx, args) => deleteUserOwnedData(ctx, args.externalId),
});

export const step = internalMutation({
  args: stepArgs,
  handler: (ctx, args) => stepDeletion(ctx, args.jobId, args.revision),
});

/** Catch outside the transaction: the failed chunk rolls back, then only status is committed. */
export const run = internalAction({
  args: stepArgs,
  handler: async (ctx, args): Promise<void> => {
    try {
      await ctx.runMutation(stepRef, args);
    } catch {
      // Do not retain or log errors, which can contain row values or personal identifiers.
      await ctx.runMutation(failRef, args);
    }
  },
});

export const fail = internalMutation({
  args: stepArgs,
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status === "pending" && job.revision === args.revision)
      await ctx.db.patch(job._id, { status: "failed", updatedAt: Date.now() });
  },
});

/** Operator/dev recovery by opaque job id; safe after duplicate calls or a failed chunk. */
export const resume = internalMutation({
  args: jobArgs,
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status === "complete") return;
    if (job.scheduledId) {
      const scheduled = await ctx.db.system.get("_scheduled_functions", job.scheduledId);
      if (scheduled?.state.kind === "pending") await ctx.scheduler.cancel(job.scheduledId);
    }
    await ctx.db.patch(job._id, {
      status: "pending",
      attempts: job.attempts + 1,
      revision: job.revision + 1,
      updatedAt: Date.now(),
    });
    await scheduleDeletion(ctx, job._id);
  },
});

/** Internal observability exposes no subject, user row, payload, media id or cursor. */
export const status = internalQuery({
  args: jobArgs,
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const scheduled = job.scheduledId
      ? await ctx.db.system.get("_scheduled_functions", job.scheduledId)
      : null;
    return {
      status: job.status,
      phase: job.phase,
      processed: job.processed,
      attempts: job.attempts,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      scheduledState: scheduled?.state.kind,
    };
  },
});
