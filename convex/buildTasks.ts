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

/** Returns tasks for a closet item (standalone item tasks + build tasks assigned to this item). */
export const listByClosetItem = query({
  args: { closetItemId: v.id("closetItems") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const result = await Promise.all(
      sorted.map(async (task) => {
        const build = task.buildId ? await ctx.db.get(task.buildId) : null;
        return {
          _id: task._id,
          buildId: task.buildId ?? null,
          label: task.label,
          checked: task.checked,
          sortOrder: task.sortOrder,
          buildName: build && "name" in build ? build.name : null,
        };
      })
    );
    return result;
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
    buildId: v.optional(v.id("builds")),
    label: v.string(),
    closetItemId: v.optional(v.id("closetItems")),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.buildId) {
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
    }
    if (!args.closetItemId) {
      throw new Error("Either buildId or closetItemId is required");
    }
    const item = await ctx.db.get(args.closetItemId);
    if (!item || item.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const existing = await ctx.db
      .query("buildTasks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const id = await ctx.db.insert("buildTasks", {
      userId: args.userId,
      buildId: undefined,
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
    closetItemId: v.optional(v.union(v.id("closetItems"), v.null())),
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
      if (val === null) patch[k] = undefined;
      else if (val !== undefined) patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }

    // When completion task is toggled, sync linked closet item status
    if (args.checked !== undefined) {
      const items = await ctx.db
        .query("closetItems")
        .withIndex("by_completionTaskId", (q) => q.eq("completionTaskId", id))
        .collect();
      for (const item of items) {
        if (item.userId === userId) {
          await ctx.db.patch(item._id, {
            status: args.checked ? "complete" : "in_progress",
          });
        }
      }
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
    // Clear completionTaskId from any closet item that used this task
    const items = await ctx.db
      .query("closetItems")
      .withIndex("by_completionTaskId", (q) => q.eq("completionTaskId", args.id))
      .collect();
    for (const item of items) {
      if (item.userId === args.userId) {
        await ctx.db.patch(item._id, { completionTaskId: undefined });
      }
    }
  },
});
