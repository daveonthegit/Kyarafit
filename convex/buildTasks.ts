import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { canUserEditBuild } from "./lib/buildAccess";
import { MAX_LENGTH, sanitizeAndLimit, validateDateString } from "./lib/validation";

const legacyNodeIdValidator = v.union(v.id("cosplayNodes"), v.id("closetItems"));

async function resolveCosplayNodeId(
  ctx: QueryCtx | MutationCtx,
  id: Id<"cosplayNodes"> | Id<"closetItems"> | undefined | null
) {
  if (!id) return null;
  const current = await ctx.db.get(id as Id<"cosplayNodes">);
  if (current && "nodeType" in current) {
    return current._id as Id<"cosplayNodes">;
  }
  const migrated = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_legacyClosetItemId", (q) => q.eq("legacyClosetItemId", id as Id<"closetItems">))
    .unique();
  return migrated?._id ?? null;
}

async function listTasksForCosplayNode(
  ctx: QueryCtx,
  cosplayNodeId: Id<"cosplayNodes">
) {
  const tasks = await ctx.db
    .query("buildTasks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  return await Promise.all(
    sorted.map(async (task) => {
      const build = task.buildId ? await ctx.db.get(task.buildId) : null;
      return {
        ...task,
        buildId: task.buildId ?? null,
        buildName: build && "name" in build ? build.name : null,
      };
    })
  );
}

export const listByBuild = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
  },
});

export const listByCosplayNode = query({
  args: { cosplayNodeId: legacyNodeIdValidator },
  handler: async (ctx, args) => {
    const cosplayNodeId = await resolveCosplayNodeId(ctx, args.cosplayNodeId);
    if (!cosplayNodeId) return [];
    return await listTasksForCosplayNode(ctx, cosplayNodeId);
  },
});

/** Legacy alias while callers migrate away from closet naming. */
export const listByClosetItem = query({
  args: { closetItemId: legacyNodeIdValidator },
  handler: async (ctx, args) => {
    const cosplayNodeId = await resolveCosplayNodeId(ctx, args.closetItemId);
    if (!cosplayNodeId) return [];
    return await listTasksForCosplayNode(ctx, cosplayNodeId);
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
      (task): task is typeof task & { buildId: NonNullable<typeof task.buildId> } => task.buildId != null
    );

    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const buildIdToDate = new Map<string, string>();
    const buildIdToConventionId = new Map<string, Id<"conventions">>();
    for (const convention of conventions) {
      const plans = await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_conventionId", (q) => q.eq("conventionId", convention._id))
        .collect();
      for (const plan of plans) {
        if (!plan.buildId) continue;
        const existing = buildIdToDate.get(plan.buildId);
        if (!existing || plan.date < existing) {
          buildIdToDate.set(plan.buildId, plan.date);
          buildIdToConventionId.set(plan.buildId, convention._id);
        }
      }
    }

    const result: Array<{
      _id: Doc<"buildTasks">["_id"];
      label: string;
      checked: boolean;
      buildId?: Doc<"buildTasks">["buildId"];
      buildName: string;
      conventionId?: Id<"conventions">;
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
        dueDate: task.dueDate ?? buildIdToDate.get(task.buildId),
        sortOrder: task.sortOrder,
        ...(buildIdToConventionId.has(task.buildId)
          ? { conventionId: buildIdToConventionId.get(task.buildId)! }
          : {}),
      });
    }

    const packingOnlyTasks = tasks.filter((task) => task.packingListItemId != null);
    for (const task of packingOnlyTasks) {
      const packingItem = await ctx.db.get(task.packingListItemId!);
      if (!packingItem || packingItem.userId !== args.userId) continue;
      const convention = await ctx.db.get(packingItem.conventionId);
      if (!convention) continue;
      result.push({
        _id: task._id,
        label: task.label,
        checked: task.checked,
        buildName: convention.name,
        conventionId: packingItem.conventionId,
        dueDate: task.dueDate ?? packingItem.date,
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
    cosplayNodeId: v.optional(legacyNodeIdValidator),
    closetItemId: v.optional(legacyNodeIdValidator),
    sortOrder: v.optional(v.number()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const label = sanitizeAndLimit(args.label, MAX_LENGTH.label, "Label");
    const dueDate = args.dueDate ? validateDateString(args.dueDate, "Due date") : undefined;
    const resolvedNodeId = await resolveCosplayNodeId(
      ctx,
      args.cosplayNodeId ?? args.closetItemId ?? null
    );

    if (args.buildId) {
      const build = await ctx.db.get(args.buildId);
      if (!build) throw new Error("Build not found");
      const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
      if (!canEdit) throw new Error("Not authorized");
      const existing = await ctx.db
        .query("buildTasks")
        .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
        .collect();
      const id = await ctx.db.insert("buildTasks", {
        userId: args.userId,
        buildId: args.buildId,
        label,
        cosplayNodeId: resolvedNodeId ?? undefined,
        closetItemId: undefined,
        sortOrder: args.sortOrder ?? existing.length,
        checked: false,
        dueDate,
      });
      return await ctx.db.get(id);
    }

    if (!resolvedNodeId) {
      throw new Error("Either buildId or cosplayNodeId is required");
    }
    const node = await ctx.db.get(resolvedNodeId);
    if (!node || node.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const existing = await ctx.db
      .query("buildTasks")
      .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", resolvedNodeId))
      .collect();
    const id = await ctx.db.insert("buildTasks", {
      userId: args.userId,
      buildId: undefined,
      label,
      cosplayNodeId: resolvedNodeId,
      closetItemId: undefined,
      sortOrder: args.sortOrder ?? existing.length,
      checked: false,
      dueDate,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("buildTasks"),
    userId: v.string(),
    label: v.optional(v.string()),
    cosplayNodeId: v.optional(v.union(legacyNodeIdValidator, v.null())),
    closetItemId: v.optional(v.union(legacyNodeIdValidator, v.null())),
    sortOrder: v.optional(v.number()),
    checked: v.optional(v.boolean()),
    dueDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const task = await ctx.db.get(id);
    if (!task) throw new Error("Task not found");
    const allowed =
      task.userId === userId ||
      (task.buildId && (await canUserEditBuild(ctx, task.buildId, userId)));
    if (!allowed) throw new Error("Not authorized");

    const patch: Record<string, unknown> = {};
    if (fields.label !== undefined) {
      patch.label = sanitizeAndLimit(fields.label, MAX_LENGTH.label, "Label");
    }
    if (fields.sortOrder !== undefined) patch.sortOrder = fields.sortOrder;
    if (fields.checked !== undefined) patch.checked = fields.checked;
    if (fields.dueDate !== undefined) {
      patch.dueDate =
        fields.dueDate === null ? undefined : validateDateString(fields.dueDate, "Due date");
    }
    if (fields.cosplayNodeId !== undefined || fields.closetItemId !== undefined) {
      const sourceId =
        fields.cosplayNodeId === undefined ? fields.closetItemId : fields.cosplayNodeId;
      patch.cosplayNodeId =
        sourceId === null ? undefined : await resolveCosplayNodeId(ctx, sourceId ?? null);
      patch.closetItemId = undefined;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }

    if (args.checked !== undefined && task.packingListItemId) {
      const packingItem = await ctx.db.get(task.packingListItemId);
      if (packingItem && packingItem.userId === userId) {
        await ctx.db.patch(task.packingListItemId, { checked: args.checked });
      }
    }

    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("buildTasks"), userId: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    const allowed =
      task.userId === args.userId ||
      (task.buildId && (await canUserEditBuild(ctx, task.buildId, args.userId)));
    if (!allowed) throw new Error("Not authorized");
    await ctx.db.delete(args.id);
  },
});
