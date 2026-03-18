import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Like a build. User must be able to see the build (public, unlisted with link, or shared). */
export const like = mutation({
  args: { userId: v.string(), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canSee =
      build.visibility === "public" ||
      build.visibility === "unlisted" ||
      build.userId === args.userId;
    if (!canSee) throw new Error("Cannot like this build");
    const existing = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) =>
        q.eq("userId", args.userId).eq("buildId", args.buildId)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("buildLikes", {
      userId: args.userId,
      buildId: args.buildId,
    });
  },
});

/** Remove like. */
export const unlike = mutation({
  args: { userId: v.string(), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) =>
        q.eq("userId", args.userId).eq("buildId", args.buildId)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

/** Whether the current user has liked the build. */
export const isLikedBy = query({
  args: { userId: v.string(), buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("buildLikes")
      .withIndex("by_userId_buildId", (q) =>
        q.eq("userId", args.userId).eq("buildId", args.buildId)
      )
      .unique();
    return !!row;
  },
});

/** Like count for a build. */
export const countByBuild = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("buildLikes")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return rows.length;
  },
});
