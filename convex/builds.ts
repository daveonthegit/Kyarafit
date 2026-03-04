import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const VALID_STATUSES = ["idea", "wip", "ready", "archived"] as const;

const sortByValidator = v.optional(
  v.union(v.literal("name"), v.literal("progress"), v.literal("targetDate"), v.literal("budget"))
);
const orderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));

export const list = query({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: sortByValidator,
    order: orderValidator,
  },
  handler: async (ctx, args) => {
    const order = args.order ?? "asc";
    const sortBy = args.sortBy ?? "name";

    const statusFilter =
      args.status && VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])
        ? args.status
        : undefined;

    const builds = await (statusFilter
      ? ctx.db
          .query("builds")
          .withIndex("by_userId_status", (q) =>
            q.eq("userId", args.userId).eq("status", statusFilter)
          )
          .collect()
      : ctx.db
          .query("builds")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect());

    const withCounts = await Promise.all(
      builds.map(async (b) => {
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const tasksChecked = tasks.filter((t) => t.checked).length;
        const tasksTotal = tasks.length;
        const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;
        const links = await ctx.db
          .query("buildItemLinks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        let totalCostCents = 0;
        for (const link of links) {
          const item = await ctx.db.get(link.closetItemId);
          if (item?.costCents != null) totalCostCents += item.costCents;
        }
        return {
          ...b,
          tasksTotal,
          tasksChecked,
          progress,
          totalCostCents,
        };
      })
    );

    let filtered = withCounts;
    const searchTrimmed = args.search?.trim();
    if (searchTrimmed) {
      const lower = searchTrimmed.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(lower) || (b.character ?? "").toLowerCase().includes(lower)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "progress":
          cmp = (a.progress ?? 0) - (b.progress ?? 0);
          break;
        case "targetDate": {
          const ad = a.targetDate ?? "";
          const bd = b.targetDate ?? "";
          cmp = ad.localeCompare(bd);
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        case "budget": {
          const ac = a.budgetCents ?? -1;
          const bc = b.budgetCents ?? -1;
          cmp = ac - bc;
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        default:
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
      }
      return order === "desc" ? -cmp : cmp;
    });

    return sorted.map(({ progress: _p, ...rest }) => rest);
  },
});

/** Returns the user's most recently created build (for home hero). Includes task counts. */
export const getMostRecentForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    if (builds.length === 0) return null;
    const sorted = [...builds].sort((a, b) => b._creationTime - a._creationTime);
    const build = sorted[0];
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    const tasksChecked = tasks.filter((t) => t.checked).length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;
    return {
      ...build,
      tasksTotal,
      tasksChecked,
      progress,
    };
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

/** Delete multiple builds (cascade tasks + links). Authorized per build. */
export const removeMany = mutation({
  args: {
    ids: v.array(v.id("builds")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const build = await ctx.db.get(id);
      if (!build || build.userId !== args.userId) continue;
      const tasks = await ctx.db
        .query("buildTasks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const t of tasks) await ctx.db.delete(t._id);
      const links = await ctx.db
        .query("buildItemLinks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const l of links) await ctx.db.delete(l._id);
      await ctx.db.delete(id);
    }
  },
});

/** Set status for multiple builds. Authorized per build. */
export const updateStatusMany = mutation({
  args: {
    ids: v.array(v.id("builds")),
    userId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (!VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])) {
      throw new Error("Invalid status");
    }
    for (const id of args.ids) {
      const build = await ctx.db.get(id);
      if (!build || build.userId !== args.userId) continue;
      await ctx.db.patch(id, { status: args.status });
    }
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

/** Returns aggregated summary for one build (status, progress, dates, linked items, budget). Used by Summary dashboard. */
export const getSummary = query({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) return null;

    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    const tasksChecked = tasks.filter((t) => t.checked).length;
    const tasksTotal = tasks.length;
    const progressPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    let linkedItemCount = links.length;
    let linkedItemsCompleteCount = 0;
    let totalCostCents = 0;
    for (const link of links) {
      const item = await ctx.db.get(link.closetItemId);
      if (item) {
        if (item.status === "complete") linkedItemsCompleteCount += 1;
        totalCostCents += item.costCents ?? 0;
      }
    }

    const createdMs = (build as { _creationTime?: number })._creationTime ?? Date.now();
    const createdDate = new Date(createdMs).toISOString().slice(0, 10);
    const now = Date.now();
    const elapsedMs = now - createdMs;
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

    let remainingDays: number | null = null;
    if (build.targetDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetStart = new Date(build.targetDate);
      targetStart.setHours(0, 0, 0, 0);
      remainingDays = Math.ceil((targetStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const budgetCents = build.budgetCents ?? null;
    const budgetDifferenceCents = budgetCents != null ? budgetCents - totalCostCents : null;

    return {
      status: build.status,
      progressPercent,
      tasksChecked,
      tasksTotal,
      createdDate,
      targetDate: build.targetDate ?? null,
      elapsedDays,
      remainingDays,
      linkedItemCount,
      linkedItemsCompleteCount,
      totalCostCents,
      budgetCents,
      budgetDifferenceCents,
    };
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
    const newIds = new Set(args.closetItemIds);
    const existing = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    // For items being unlinked: delete their build tasks and clear completionTaskId
    for (const l of existing) {
      if (newIds.has(l.closetItemId)) continue;
      const item = await ctx.db.get(l.closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const tasksForItem = await ctx.db
        .query("buildTasks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", l.closetItemId))
        .collect();
      const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
      for (const task of tasksInBuild) await ctx.db.delete(task._id);
      if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
        await ctx.db.patch(l.closetItemId, { completionTaskId: undefined });
      }
    }
    // Remove existing links
    for (const l of existing) await ctx.db.delete(l._id);

    // Create new links
    for (const closetItemId of args.closetItemIds) {
      await ctx.db.insert("buildItemLinks", {
        userId: args.userId,
        buildId: args.buildId,
        closetItemId,
      });
    }

    // Auto-create a completion task for each linked item that doesn't have one
    const existingTasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    let nextSortOrder = existingTasks.length;
    for (const closetItemId of args.closetItemIds) {
      const item = await ctx.db.get(closetItemId);
      if (!item || item.completionTaskId) continue;
      const taskId = await ctx.db.insert("buildTasks", {
        userId: args.userId,
        buildId: args.buildId,
        label: `Complete ${item.name}`,
        closetItemId,
        sortOrder: nextSortOrder++,
        checked: false,
      });
      await ctx.db.patch(closetItemId, { completionTaskId: taskId });
    }
  },
});

/** Add closet items to a build (merge with existing links). Does not remove current links. */
export const addItemsToBuild = mutation({
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
    const existing = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const existingIds = new Set(existing.map((l) => l.closetItemId));
    const toAdd = args.closetItemIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) return;

    for (const closetItemId of toAdd) {
      await ctx.db.insert("buildItemLinks", {
        userId: args.userId,
        buildId: args.buildId,
        closetItemId,
      });
    }

    const existingTasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    let nextSortOrder = existingTasks.length;
    for (const closetItemId of toAdd) {
      const item = await ctx.db.get(closetItemId);
      if (!item || item.completionTaskId) continue;
      const taskId = await ctx.db.insert("buildTasks", {
        userId: args.userId,
        buildId: args.buildId,
        label: `Complete ${item.name}`,
        closetItemId,
        sortOrder: nextSortOrder++,
        checked: false,
      });
      await ctx.db.patch(closetItemId, { completionTaskId: taskId });
    }
  },
});

/** Remove a closet item from a build (delete the buildItemLink). Clears item's completionTaskId if that task belongs to this build. */
export const removeItemFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemId: v.id("closetItems"),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const item = await ctx.db.get(args.closetItemId);
    if (!item || item.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    for (const link of links) {
      if (link.buildId === args.buildId) {
        await ctx.db.delete(link._id);
        break;
      }
    }
    // Delete all tasks in this build that reference this closet item; clear completionTaskId if it was one of them
    const tasksForItem = await ctx.db
      .query("buildTasks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
    for (const task of tasksInBuild) {
      await ctx.db.delete(task._id);
    }
    if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
      await ctx.db.patch(args.closetItemId, { completionTaskId: undefined });
    }
  },
});

/** Remove multiple closet items from a build. Deletes all build tasks for each item in this build and clears completionTaskId when relevant. */
export const removeItemsFromBuild = mutation({
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
    for (const closetItemId of args.closetItemIds) {
      const item = await ctx.db.get(closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const links = await ctx.db
        .query("buildItemLinks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", closetItemId))
        .collect();
      for (const link of links) {
        if (link.buildId === args.buildId) {
          await ctx.db.delete(link._id);
          break;
        }
      }
      // Delete all tasks in this build that reference this closet item; clear completionTaskId if it was one of them
      const tasksForItem = await ctx.db
        .query("buildTasks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", closetItemId))
        .collect();
      const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
      for (const task of tasksInBuild) {
        await ctx.db.delete(task._id);
      }
      if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
        await ctx.db.patch(closetItemId, { completionTaskId: undefined });
      }
    }
  },
});

/** Returns build ids and names that link to this closet item (for closet item detail). Deduplicated by build id. */
export const getBuildsUsingClosetItem = query({
  args: { closetItemId: v.id("closetItems") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const buildIds = Array.from(new Set(links.map((l) => l.buildId)));
    const builds = await Promise.all(buildIds.map((buildId) => ctx.db.get(buildId)));
    return builds.flatMap((b) => (b && "name" in b ? [{ _id: b._id, name: b.name }] : []));
  },
});
