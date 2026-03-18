import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getStorageSizeMb } from "./storageUsage";
import { MAX_LENGTH, sanitizeOptional } from "./lib/validation";

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
    const email =
      args.email.length <= MAX_LENGTH.email
        ? args.email.trim()
        : args.email.slice(0, MAX_LENGTH.email);
    const name = sanitizeOptional(args.name, MAX_LENGTH.name, "Name");
    const image =
      args.image != null && args.image.length <= MAX_LENGTH.url ? args.image : undefined;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      // Do not overwrite image on patch — profile pic may have been uploaded; only sync email/name from session.
      await ctx.db.patch(existing._id, {
        email,
        name,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      externalId: args.externalId,
      email,
      name,
      image,
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

/**
 * Recalculate currentUsageMb from all stored files referenced by this user's
 * entities. Call after sign-in to backfill usage if uploads happened before
 * the user row existed, or to fix drift.
 */
export const recalculateUsage = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return null;
    const externalId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) return null;

    let totalMb = 0;
    const addSize = async (doc: { imageStorageId?: Id<"_storage"> } | undefined) => {
      if (!doc?.imageStorageId) return;
      totalMb += await getStorageSizeMb(ctx, doc.imageStorageId);
    };

    const closetItems = await ctx.db
      .query("closetItems")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const item of closetItems) await addSize(item);

    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const b of builds) await addSize(b);

    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const c of conventions) await addSize(c);

    const refImages = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const r of refImages) await addSize(r);

    const processPics = await ctx.db
      .query("buildProcessPictures")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const p of processPics) await addSize(p);

    await addSize(user);

    await ctx.db.patch(user._id, { currentUsageMb: totalMb });
    return totalMb;
  },
});

/**
 * Update the current user's profile image to a Convex storage ID (after upload).
 * Auth required; only the user's own row can be updated. Counts toward storage quota.
 */
export const updateProfileImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return null;
    const externalId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, {
      imageStorageId: args.storageId,
      // Keep image for OAuth fallback; storage takes precedence when present
    });
    return user._id;
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
