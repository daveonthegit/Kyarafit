import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function getUserOrThrow(ctx: MutationCtx): Promise<{ _id: Id<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
    .unique();
  if (!user) throw new Error("User not found");
  return user;
}

export const registerToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserOrThrow(ctx);
    const existing = await ctx.db
      .query("userPushPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        expoPushToken: args.token,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("userPushPreferences", {
      userId: user._id,
      expoPushToken: args.token,
      marketingOptIn: false,
      transactionalOptIn: true,
      updatedAt: now,
    });
  },
});

export const setMarketingOptIn = mutation({
  args: { marketingOptIn: v.boolean() },
  handler: async (ctx, args) => {
    const user = await getUserOrThrow(ctx);
    const existing = await ctx.db
      .query("userPushPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        marketingOptIn: args.marketingOptIn,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("userPushPreferences", {
      userId: user._id,
      marketingOptIn: args.marketingOptIn,
      transactionalOptIn: true,
      updatedAt: now,
    });
  },
});
