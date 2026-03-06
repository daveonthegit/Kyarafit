import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { MAX_LENGTH, sanitizeAndLimit } from "./lib/validation";

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

/** Returns all build tasks for the planner with build name and optional due date from convention day plan. */
export const listForPlanner = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const buildTasksOnly = tasks.filter(
      (t): t is typeof t & { buildId: NonNullable<typeof t.buildId> } => t.buildId != null
    );

    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const buildIdToDate = new Map<string, string>();
    for (const conv of conventions) {
      const plans = await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_conventionId", (q) => q.eq("conventionId", conv._id))
        .collect();
      for (const p of plans) {
        if (p.buildId) {
          const id = p.buildId;
          const existing = buildIdToDate.get(id);
          if (!existing || p.date < existing) buildIdToDate.set(id, p.date);
        }
      }
    }

    const result: Array<{
      _id: (typeof tasks)[0]["_id"];
      label: string;
      checked: boolean;
      buildId: (typeof buildTasksOnly)[0]["buildId"];
      buildName: string;
      dueDate?: string;
      sortOrder: number;
    }> = [];
    for (const task of buildTasksOnly) {
      const build = await ctx.db.get(task.buildId);
      if (!build || build.userId !== args.userId) continue;
      result.push({
        _id: task._id,
        label: task.label,
        checked: task.checked,
        buildId: task.buildId,
        buildName: build.name,
        dueDate: buildIdToDate.get(task.buildId),
        sortOrder: task.sortOrder,
      });
    }
    result.sort((a, b) => {
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return a.sortOrder - b.sortOrder;
    });
    return result;
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
    const label = sanitizeAndLimit(args.label, MAX_LENGTH.label, "Label");
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
        label,
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
      label,
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
      else if (val !== undefined) {
        if (k === "label") patch.label = sanitizeAndLimit(val as string, MAX_LENGTH.label, "Label");
        else patch[k] = val;
      }
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
