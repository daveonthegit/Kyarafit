import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const VALID_ROLES = ["viewer", "editor"] as const;

/** List collaborators for a build. Only owner (or collaborator) can list. */
export const listByBuild = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
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

/** Add or update collaborator. Caller must be build owner. */
export const set = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.ownerId) {
      throw new Error("Not found or not authorized");
    }
    if (args.userId === args.ownerId) throw new Error("Cannot add owner as collaborator");
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

/** Add collaborator by email. Caller must be build owner. Finds user by email and adds as viewer or editor. */
export const addByEmail = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.ownerId) {
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
    if (targetUserId === args.ownerId) throw new Error("Cannot add owner as collaborator");
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

/** Remove collaborator. Caller must be build owner. */
export const remove = mutation({
  args: {
    buildId: v.id("builds"),
    ownerId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.ownerId) {
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
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.map((r) => r.buildId);
  },
});

/** Check if user can edit build (owner or editor collaborator). */
export const canEdit = query({
  args: { buildId: v.id("builds"), userId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return false;
    if (build.userId === args.userId) return true;
    const row = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const collab = row.find((r) => r.userId === args.userId);
    return collab?.role === "editor";
  },
});

/** Check if user can view build (owner, any collaborator, or public/unlisted). */
export const canView = query({
  args: { buildId: v.id("builds"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return false;
    if (build.visibility === "public") return true;
    if (build.visibility === "unlisted") return true; // link holder can view
    if (args.userId === build.userId) return true;
    if (!args.userId) return false;
    const row = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return row.some((r) => r.userId === args.userId);
  },
});
