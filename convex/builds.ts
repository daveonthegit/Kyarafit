import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const withCounts = await Promise.all(
      builds.map(async (b) => {
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        return {
          ...b,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
        };
      })
    );
    return withCounts;
  },
});

export const get = query({
  args: { id: v.id("builds") },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.id);
    if (!build) return null;
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    return {
      ...build,
      tasksTotal: tasks.length,
      tasksChecked: tasks.filter((t) => t.checked).length,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    character: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("builds", args);
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("builds"),
    userId: v.string(),
    name: v.optional(v.string()),
    character: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const build = await ctx.db.get(id);
    if (!build || build.userId !== userId) {
      throw new Error("Not found or not authorized");
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("builds"), userId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.id);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    // Cascade: delete tasks and item links
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

    await ctx.db.delete(args.id);
  },
});

export const getItems = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return links.map((l) => l.closetItemId);
  },
});

/** Returns builds with their tasks and linked closet-item IDs — used by mobile sync. */
export const listWithDetails = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return await Promise.all(
      builds.map(async (b) => {
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const links = await ctx.db
          .query("buildItemLinks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        return {
          ...b,
          tasks,
          linkedItemIds: links.map((l) => l.closetItemId as string),
        };
      })
    );
  },
});

export const linkItems = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(v.id("closetItems")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    // Remove existing links
    const existing = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    for (const l of existing) await ctx.db.delete(l._id);

    // Create new links
    for (const closetItemId of args.closetItemIds) {
      await ctx.db.insert("buildItemLinks", {
        userId: args.userId,
        buildId: args.buildId,
        closetItemId,
      });
    }
  },
});
