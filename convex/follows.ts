import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const follow = mutation({
  args: { followerId: v.string(), followingId: v.string() },
  handler: async (ctx, args) => {
    if (args.followerId === args.followingId) {
      throw new Error("Cannot follow yourself");
    }
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("follows", {
      followerId: args.followerId,
      followingId: args.followingId,
    });
  },
});

export const unfollow = mutation({
  args: { followerId: v.string(), followingId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const isFollowing = query({
  args: { followerId: v.string(), followingId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .unique();
    return !!row;
  },
});

/** List user IDs that the given user is following. */
export const listFollowingIds = query({
  args: { followerId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.followerId))
      .collect();
    return rows.map((r) => r.followingId);
  },
});

/** List user IDs that follow the given user. */
export const listFollowerIds = query({
  args: { followingId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.followingId))
      .collect();
    return rows.map((r) => r.followerId);
  },
});
