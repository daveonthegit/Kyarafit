import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByBuild = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
  },
});

export const add = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    if (!args.imageStorageId && !args.imageUrl) {
      throw new Error("Either imageStorageId or imageUrl is required");
    }
    const existing = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const maxOrder = existing.length ? Math.max(...existing.map((r) => r.sortOrder), -1) : -1;
    const id = await ctx.db.insert("buildReferenceImages", {
      userId: args.userId,
      buildId: args.buildId,
      imageStorageId: args.imageStorageId,
      imageUrl: args.imageUrl,
      sortOrder: maxOrder + 1,
    });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: {
    id: v.id("buildReferenceImages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
    orderedIds: v.array(v.id("buildReferenceImages")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const existing = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const existingIds = new Set(existing.map((r) => r._id));
    const orderedSet = new Set(args.orderedIds);
    const appended = existing.filter((r) => !orderedSet.has(r._id));
    const fullOrder = [
      ...args.orderedIds.filter((id) => existingIds.has(id)),
      ...appended.map((r) => r._id),
    ];
    for (let i = 0; i < fullOrder.length; i++) {
      await ctx.db.patch(fullOrder[i], { sortOrder: i });
    }
  },
});
