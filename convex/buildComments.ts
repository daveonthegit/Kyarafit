import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MAX_LENGTH, sanitizeAndLimit } from "./lib/validation";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";

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
        return {
          _id: c._id,
          buildId: c.buildId,
          userId: c.userId,
          body: c.body,
          createdAt: c.createdAt,
          authorName: user?.displayName ?? user?.name ?? user?.email ?? "Unknown",
          authorUsername: user?.username ?? null,
        };
      })
    );
    return withAuthor;
  },
});

/** Add a comment. User must be able to see the build. */
export const add = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canSee =
      build.visibility === "public" ||
      build.visibility === "unlisted" ||
      build.userId === args.userId;
    if (!canSee) throw new Error("Cannot comment on this build");
    const sanitized = sanitizeAndLimit(args.body, MAX_LENGTH.notes, "Comment");
    if (!sanitized.trim()) throw new Error("Comment cannot be empty");
    return await ctx.db.insert("buildComments", {
      userId: args.userId,
      buildId: args.buildId,
      body: sanitized.trim(),
      createdAt: Date.now(),
    });
  },
});
