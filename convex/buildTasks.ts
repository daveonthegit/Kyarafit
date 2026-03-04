import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByBuild = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
  },
});

/** Returns tasks for multiple builds (e.g. for itinerary view). */
export const listByBuilds = query({
  args: { buildIds: v.array(v.id("builds")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const buildId of args.buildIds) {
      const tasks = await ctx.db
        .query("buildTasks")
        .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
        .collect();
      results.push({ buildId, tasks });
    }
    return results;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    label: v.string(),
    closetItemId: v.optional(v.id("closetItems")),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }

    const existing = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();

    const id = await ctx.db.insert("buildTasks", {
      userId: args.userId,
      buildId: args.buildId,
      label: args.label,
      closetItemId: args.closetItemId,
      sortOrder: args.sortOrder ?? existing.length,
      checked: false,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("buildTasks"),
    userId: v.string(),
    label: v.optional(v.string()),
    closetItemId: v.optional(v.id("closetItems")),
    sortOrder: v.optional(v.number()),
    checked: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) {
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
  args: { id: v.id("buildTasks"), userId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    await ctx.db.delete(args.id);
  },
});
