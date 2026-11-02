import { v } from "convex/values";
import { query } from "./_generated/server";
import { mutation } from "./lib/guardedMutation";
import { optionalIdentity, requireIdentity } from "./lib/authz";

/**
 * The follower is always the acting user; `followerId` is retained for deployed
 * clients but ignored. `followingId` names a *different* user, so it stays required.
 */
export const follow = mutation({
  args: { followerId: v.optional(v.string()), followingId: v.string() },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    if (actorId === args.followingId) {
      throw new Error("Cannot follow yourself");
    }
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", actorId).eq("followingId", args.followingId)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("follows", {
      followerId: actorId,
      followingId: args.followingId,
    });
  },
});

export const unfollow = mutation({
  args: { followerId: v.optional(v.string()), followingId: v.string() },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const row = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", actorId).eq("followingId", args.followingId)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});

/** Whether the acting user follows `followingId`. */
export const isFollowing = query({
  args: { followerId: v.optional(v.string()), followingId: v.string() },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return false;
    const row = await ctx.db
      .query("follows")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", actorId).eq("followingId", args.followingId)
      )
      .unique();
    return !!row;
  },
});

/**
 * User IDs the acting user follows. Own edges only: the outbound and inbound edge
 * lists together made the whole user base walkable from one seed id, which chained
 * into `users.getByExternalId` for email harvesting.
 */
export const listFollowingIds = query({
  args: { followerId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", actorId))
      .collect();
    return rows.map((r) => r.followingId);
  },
});

/** User IDs that follow the acting user. Own edges only — see `listFollowingIds`. */
export const listFollowerIds = query({
  args: { followingId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", actorId))
      .collect();
    return rows.map((r) => r.followerId);
  },
});
