import { v } from "convex/values";
import { cleanupMutation } from "./lib/guardedMutation";
import {
  DOWNGRADE_RETENTION_MS,
  isCloudPurgeable,
} from "@kyarafit/design-system/domain/tierTransition";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { purgeAccountReplica } from "./lib/replicaStore";

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
      if (!dryRun) await ctx.db.patch(user._id, { cloudPurgedAt: now, downgradedAt: undefined });
      usersPurged += 1;
      purgedUserIds.push(user.externalId);
    }
    return { usersPurged, rowsDeleted, dryRun, purgedUserIds };
  },
});
