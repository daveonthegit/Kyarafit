import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";

// Typed reference to the internal sendWelcome action.
// Using makeFunctionReference avoids a circular dependency on _generated/api
// when the generated types haven't been refreshed yet after adding email.ts.
const sendWelcomeAction = makeFunctionReference<
  "action",
  { to: string; name?: string | undefined }
>("email:sendWelcome");

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        image: args.image,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      externalId: args.externalId,
      email: args.email,
      name: args.name,
      image: args.image,
      tier: "FREE",
      currentUsageMb: 0,
    });

    // Send welcome email on first sign-up (non-blocking)
    await ctx.scheduler.runAfter(0, sendWelcomeAction, {
      to: args.email,
      name: args.name,
    });

    return id;
  },
});

export const getMe = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    if (!user) return null;

    const TIER_LIMITS: Record<string, number> = {
      ANON: 0,
      FREE: 50,
      PREMIUM_BASIC: 500,
      PREMIUM_PRO: -1,
    };

    return {
      tier: user.tier,
      currentUsageMb: user.currentUsageMb,
      storageLimitMb: TIER_LIMITS[user.tier] ?? 50,
    };
  },
});

/** Internal mutation for admin/system use — update tier directly. */
export const setTier = internalMutation({
  args: {
    externalId: v.string(),
    tier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, { tier: args.tier });
    return user._id;
  },
});
