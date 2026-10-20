import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { cleanupMutation } from "./lib/guardedMutation";
import {
  DOWNGRADE_RETENTION_MS,
  isCloudPurgeable,
} from "@kyarafit/design-system/domain/tierTransition";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { purgeAccountReplica } from "./lib/replicaStore";

/**
 * Downgrade retention (DATA_AND_SYNC.md §10, REQ-D96/D97), daily cron. Purges the managed-sync row
 * replica (and its photo blobs) of users who downgraded paid→free and stayed free past grace +
 * freeze. Published copies are not personal sync data and stay: publishing is free for every tier.
 * Never touches on-device data, which Convex cannot reach. Bounded by `limit`; idempotent through
 * `cloudPurgedAt`; `dryRun` reports without deleting. Each purge schedules
 * `replica:startGeneration`, so devices that synced the old replica upload their vault again.
 */
const startGeneration = makeFunctionReference<"mutation", { userId: string }>(
  "replica:startGeneration"
);

export const purgeDowngradedCloudData = cleanupMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    const dryRun = args.dryRun ?? false;
    const candidates = await ctx.db
      .query("users")
      .withIndex("by_downgradedAt", (q) =>
        q.gt("downgradedAt", 0).lte("downgradedAt", now - DOWNGRADE_RETENTION_MS)
      )
      .take(limit);
    let usersPurged = 0;
    let rowsDeleted = 0;
    const purgedUserIds: string[] = [];
    for (const user of candidates) {
      if (
        !isCloudPurgeable(user.downgradedAt, now) ||
        normalizeConvexTier(user.tier) !== "FREE" ||
        user.cloudPurgedAt != null
      )
        continue;
      rowsDeleted += await purgeAccountReplica(ctx, user.externalId, dryRun);
      if (!dryRun) {
        await ctx.db.patch(user._id, { cloudPurgedAt: now, downgradedAt: undefined });
        await ctx.scheduler.runAfter(0, startGeneration, { userId: user.externalId });
      }
      usersPurged += 1;
      purgedUserIds.push(user.externalId);
    }
    return { usersPurged, rowsDeleted, dryRun, purgedUserIds };
  },
});
