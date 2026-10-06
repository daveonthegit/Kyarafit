import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MAX_LENGTH, sanitizeAndLimit } from "./lib/validation";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import { requireIdentity } from "./lib/authz";

/** List comments for a build (newest last or first by preference). Viewer must be able to see the build. */
export const listByBuild = query({
  args: { buildId: v.id("builds"), shareToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return [];
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: args.shareToken ?? null,
    });
    if (!allowed) return [];
    const comments = await ctx.db
      .query("buildComments")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const sorted = [...comments].sort((a, b) => a.createdAt - b.createdAt);
    const withAuthor = await Promise.all(
      sorted.map(async (c) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", c.userId))
          .unique();
        const authorUsername = user?.username?.trim() || null;
        const authorName =
          user?.displayName?.trim() ||
          user?.name?.trim() ||
          (authorUsername != null ? `@${authorUsername}` : "Member");
        return {
          _id: c._id,
          buildId: c.buildId,
          body: c.body,
          createdAt: c.createdAt,
          authorName,
          authorUsername,
        };
      })
    );
    return withAuthor;
  },
});

/**
 * Add a comment as the acting user, who must be able to see the build. Authorship
 * comes from the session — the comment renders under the author's display name, so
 * a caller-supplied id let anyone post as anyone. `userId` is retained for deployed
 * clients but ignored.
 */
export const add = mutation({
  args: {
    userId: v.optional(v.string()),
    buildId: v.id("builds"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canSee =
      build.visibility === "public" || build.visibility === "unlisted" || build.userId === actorId;
    if (!canSee) throw new Error("Cannot comment on this build");
    const sanitized = sanitizeAndLimit(args.body, MAX_LENGTH.notes, "Comment");
    if (!sanitized.trim()) throw new Error("Comment cannot be empty");
    return await ctx.db.insert("buildComments", {
      userId: actorId,
      buildId: args.buildId,
      body: sanitized.trim(),
      createdAt: Date.now(),
    });
  },
});
