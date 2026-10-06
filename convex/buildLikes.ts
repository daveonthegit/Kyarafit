import { v } from "convex/values";
import { query } from "./_generated/server";
import { mutation } from "./lib/guardedMutation";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import { optionalIdentity, requireIdentity } from "./lib/authz";

/**
 * Like a build as the acting user. The like must be attributable to the session,
 * or likes can be forged as anyone. `userId` is retained for deployed clients but
 * ignored.
 */
export const like = mutation({
  args: { userId: v.optional(v.string()), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canSee =
      build.visibility === "public" || build.visibility === "unlisted" || build.userId === actorId;
    if (!canSee) throw new Error("Cannot like this build");
    const existing = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) => q.eq("userId", actorId).eq("buildId", args.buildId))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("buildLikes", {
      userId: actorId,
      buildId: args.buildId,
    });
  },
});

/** Remove the acting user's own like. Had no authorization check at all. */
export const unlike = mutation({
  args: { userId: v.optional(v.string()), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const row = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) => q.eq("userId", actorId).eq("buildId", args.buildId))
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

/** Whether the acting user has liked the build. */
export const isLikedBy = query({
  args: { userId: v.optional(v.string()), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return false;
    const row = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) => q.eq("userId", actorId).eq("buildId", args.buildId))
      .unique();
    return !!row;
  },
});

/** Like count for a build. */
export const countByBuild = query({
  args: { buildId: v.id("builds"), shareToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return 0;
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: args.shareToken ?? null,
    });
    if (!allowed) return 0;
    const rows = await ctx.db
      .query("buildLikes")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return rows.length;
  },
});
