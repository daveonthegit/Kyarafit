import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalIdentity, requireIdentity } from "./lib/authz";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import { assertActiveAccountTargets } from "./lib/accountDeletion";

const VALID_ROLES = ["viewer", "editor"] as const;

/** List collaborators for a build. Only the owner or an existing collaborator may read the list (PII). */
export const listByBuild = query({
  args: {
    buildId: v.id("builds"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const build = await ctx.db.get(args.buildId);
    if (!build) return [];

    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();

    const allowed = build.userId === actorId || rows.some((r) => r.userId === actorId);
    if (!allowed) return [];

    const withUser = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", r.userId))
          .unique();
        return {
          userId: r.userId,
          role: r.role,
          email: user?.email ?? null,
          name: user?.displayName ?? user?.name ?? null,
          username: user?.username ?? null,
        };
      })
    );
    return withUser;
  },
});

/**
 * Add or update a collaborator. The caller must be the build owner, established from
 * the session: a caller-supplied `ownerId` let anyone grant themselves `editor` on
 * any build, and such a row is indistinguishable from a legitimate grant afterwards.
 * `ownerId` is retained for deployed clients but ignored. `userId` names the grantee,
 * a different user, so it stays required.
 */
export const set = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    await assertActiveAccountTargets(ctx, args.userId);
    if (args.userId === actorId) throw new Error("Cannot add owner as collaborator");
    if (!VALID_ROLES.includes(args.role as (typeof VALID_ROLES)[number])) {
      throw new Error("Role must be viewer or editor");
    }
    const existing = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const row = existing.find((r) => r.userId === args.userId);
    if (row) {
      await ctx.db.patch(row._id, { role: args.role });
      return row._id;
    }
    return await ctx.db.insert("buildCollaborators", {
      buildId: args.buildId,
      userId: args.userId,
      role: args.role,
    });
  },
});

/**
 * Add a collaborator by email. Caller must be the build owner, from the session —
 * this was both an escalation path and, via its distinct "no user found" error, a
 * free email-existence oracle. `ownerId` is retained for deployed clients but ignored.
 */
export const addByEmail = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.optional(v.string()),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    const email = args.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error("No user found with that email");
    const targetUserId = user.externalId;
    await assertActiveAccountTargets(ctx, targetUserId);
    if (targetUserId === actorId) throw new Error("Cannot add owner as collaborator");
    const role = VALID_ROLES.includes(args.role as (typeof VALID_ROLES)[number])
      ? (args.role as "viewer" | "editor")
      : "viewer";
    const existing = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    if (existing.some((r) => r.userId === targetUserId)) {
      throw new Error("User is already a collaborator");
    }
    return await ctx.db.insert("buildCollaborators", {
      buildId: args.buildId,
      userId: targetUserId,
      role,
    });
  },
});

/**
 * Remove a collaborator. Caller must be the build owner, from the session.
 * `ownerId` is retained for deployed clients but ignored; `userId` names the
 * collaborator being removed and stays required.
 */
export const remove = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const row = rows.find((r) => r.userId === args.userId);
    if (row) await ctx.db.delete(row._id);
  },
});

/** List build IDs shared with this user (as collaborator). For "shared with me" list. */
export const listBuildIdsSharedWithUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();
    return rows.map((r) => r.buildId);
  },
});

/**
 * Whether the acting user can edit the build. Answers only about the session's own
 * permissions; answering about an arbitrary id made this a free permission oracle.
 */
export const canEdit = query({
  args: { buildId: v.id("builds"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return false;
    const build = await ctx.db.get(args.buildId);
    if (!build) return false;
    if (build.userId === actorId) return true;
    const row = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const collab = row.find((r) => r.userId === actorId);
    return collab?.role === "editor";
  },
});

/**
 * Whether the acting user can view the build. Delegates to the same predicate the
 * public-viewer paths use, so `unlisted` requires a matching share token here too —
 * this query used to answer `true` for unlisted to any caller, a looser rule than
 * `canReadBuildWorkflowData` gave for the same question.
 */
export const canView = query({
  args: {
    buildId: v.id("builds"),
    userId: v.optional(v.string()),
    shareToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build) return false;
    return await canReadBuildWorkflowData(ctx, build, {
      viewerUserId: actorId,
      shareToken: args.shareToken ?? null,
    });
  },
});
