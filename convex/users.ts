import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getStorageSizeMb } from "./storageUsage";
import { MAX_LENGTH, sanitizeOptional, validateUsername } from "./lib/validation";

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

/** Public profile by username (for /u/[username]). Returns null if not found or profile not public. userId is externalId for use with listPublicByUser. */
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase().trim()))
      .unique();
    if (!user || user.profileVisibility !== "public") return null;
    return {
      _id: user._id,
      userId: user.externalId,
      name: user.name,
      displayName: user.displayName,
      username: user.username,
      image: user.image,
      imageStorageId: user.imageStorageId,
      bio: user.bio,
    };
  },
});

export const checkUsernameAvailability = query({
  args: {
    username: v.string(),
    currentExternalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const raw = args.username.trim();
    if (!raw) {
      return {
        normalized: "",
        valid: false,
        available: false,
        reason: "empty",
      };
    }

    let normalized: string;
    try {
      normalized = validateUsername(raw);
    } catch (error) {
      return {
        normalized: raw.toLowerCase(),
        valid: false,
        available: false,
        reason: error instanceof Error ? error.message : "invalid",
      };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    if (!existing) {
      return {
        normalized,
        valid: true,
        available: true,
        reason: null,
      };
    }

    if (args.currentExternalId && existing.externalId === args.currentExternalId) {
      return {
        normalized,
        valid: true,
        available: true,
        reason: "current_user",
      };
    }

    return {
      normalized,
      valid: true,
      available: false,
      reason: "taken",
    };
  },
});

export const upsert = mutation({
  args: {
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    /** Sync from Better Auth session so app users table has username for getByUsername. */
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email =
      args.email.length <= MAX_LENGTH.email
        ? args.email.trim()
        : args.email.slice(0, MAX_LENGTH.email);
    const name = sanitizeOptional(args.name, MAX_LENGTH.name, "Name");
    const image =
      args.image != null && args.image.length <= MAX_LENGTH.url ? args.image : undefined;
    let username: string | undefined;
    if (args.username != null && args.username.trim() !== "") {
      try {
        username = validateUsername(args.username);
      } catch {
        username = undefined;
      }
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      // Sync email/name from session. Sync username from Better Auth only when Convex doesn't have one yet, so getByUsername finds the user without overwriting a username set only in app Settings.
      const patch: { email: string; name: string | undefined; username?: string } = {
        email,
        name,
      };
      if (username !== undefined && existing.username === undefined) {
        const taken = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique();
        if (!taken || taken._id === existing._id) {
          patch.username = username;
        }
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    let usernameToInsert: string | undefined;
    if (username !== undefined) {
      const taken = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
      if (!taken) usernameToInsert = username;
    }
    const id = await ctx.db.insert("users", {
      externalId: args.externalId,
      email,
      name,
      image,
      tier: "FREE",
      currentUsageMb: 0,
      ...(usernameToInsert !== undefined && { username: usernameToInsert }),
    });

    // Send welcome email on first sign-up (non-blocking)
    await ctx.scheduler.runAfter(0, sendWelcomeAction, {
      to: args.email,
      name: args.name,
    });

    return id;
  },
});

/** Returns the current user's focused build id (for home hero), or null. */
export const getFocusedBuildId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
    return user?.focusedBuildId ?? null;
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

    const cosplayNodes = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_userId", (q) => q.eq("userId", externalId))
      .collect();
    for (const node of cosplayNodes) await addSize(node);

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

/**
 * Set the build to show as "Current Focus" on the home hero.
 * Pass buildId to set focus, or omit to clear (fall back to most recent).
 * Auth required; build must belong to the current user.
 */
export const setFocusedBuild = mutation({
  args: { buildId: v.optional(v.id("builds")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) return null;
    const externalId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) return null;

    if (args.buildId != null) {
      const build = await ctx.db.get(args.buildId);
      if (!build || build.userId !== externalId) return null;
    }

    await ctx.db.patch(user._id, { focusedBuildId: args.buildId ?? undefined });
    return user._id;
  },
});

/**
 * Update current user's profile (username, displayName, bio, profileVisibility).
 * Auth required. Username must be unique; validated as slug.
 */
export const updateProfile = mutation({
  args: {
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    profileVisibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("You must be signed in to update your profile");
    }
    const externalId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    if (!user) {
      throw new Error("User record not found");
    }

    const patch: Record<string, unknown> = {};
    if (args.displayName !== undefined) {
      patch.displayName =
        args.displayName === ""
          ? undefined
          : sanitizeOptional(args.displayName, MAX_LENGTH.displayName, "Display name");
    }
    if (args.bio !== undefined) {
      patch.bio = args.bio === "" ? undefined : sanitizeOptional(args.bio, MAX_LENGTH.bio, "Bio");
    }
    if (args.profileVisibility !== undefined) {
      patch.profileVisibility = args.profileVisibility;
    }
    if (args.username !== undefined) {
      const username = args.username === "" ? undefined : validateUsername(args.username);
      if (username) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique();
        if (existing && existing._id !== user._id) {
          throw new Error("Username is already taken");
        }
        patch.username = username;
      } else {
        patch.username = undefined;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
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
