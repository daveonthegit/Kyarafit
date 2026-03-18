import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeOptionalUrl,
  sanitizeString,
} from "./lib/validation";

const CLOSET_ITEM_STATUSES = ["planned", "in_progress", "complete"] as const;

const sortByValidator = v.optional(
  v.union(v.literal("name"), v.literal("category"), v.literal("cost"), v.literal("status"))
);
const orderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));

export const list = query({
  args: {
    userId: v.string(),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: sortByValidator,
    order: orderValidator,
  },
  handler: async (ctx, args) => {
    const order = args.order ?? "asc";
    const sortBy = args.sortBy ?? "name";

    const categoryFilter = args.category?.trim().length ? args.category.trim() : undefined;

    const items = await (categoryFilter
      ? ctx.db
          .query("closetItems")
          .withIndex("by_userId_category", (q) =>
            q.eq("userId", args.userId).eq("category", categoryFilter)
          )
          .collect()
      : ctx.db
          .query("closetItems")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect());

    let filtered = items;
    const searchTrimmed = args.search?.trim();
    if (searchTrimmed) {
      const lower = searchTrimmed.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          (i.notes ?? "").toLowerCase().includes(lower) ||
          i.tags.some((t) => t.toLowerCase().includes(lower))
      );
    }

    const statusRank = (s: string | undefined) => {
      if (s === "complete") return 2;
      if (s === "in_progress") return 1;
      return 0;
    };
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "category":
          cmp = (a.category ?? "").localeCompare(b.category ?? "");
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "cost": {
          const ac = a.costCents ?? -1;
          const bc = b.costCents ?? -1;
          cmp = ac - bc;
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        case "status":
          cmp = statusRank(a.status) - statusRank(b.status);
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        default:
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
      }
      return order === "desc" ? -cmp : cmp;
    });

    return sorted;
  },
});

export const get = query({
  args: { id: v.id("closetItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    itemLink: v.optional(v.string()),
    costCents: v.optional(v.number()),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.id("buildTasks")),
  },
  handler: async (ctx, args) => {
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
    }
    const name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
    const category = sanitizeAndLimit(args.category, MAX_LENGTH.category, "Category");
    const notes = sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes");
    const itemLink = sanitizeOptionalUrl(args.itemLink);
    const tags = args.tags
      .map((t, i) => sanitizeAndLimit(t, MAX_LENGTH.tag, `Tag ${i + 1}`))
      .filter(Boolean);
    const status =
      args.status &&
      CLOSET_ITEM_STATUSES.includes(args.status as (typeof CLOSET_ITEM_STATUSES)[number])
        ? sanitizeString(args.status)
        : "planned";
    const id = await ctx.db.insert("closetItems", {
      userId: args.userId,
      name,
      category,
      tags,
      notes,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      itemLink,
      costCents: args.costCents,
      status,
      completionTaskId: args.completionTaskId,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("closetItems"),
    userId: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    itemLink: v.optional(v.union(v.string(), v.null())),
    costCents: v.optional(v.number()),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.union(v.id("buildTasks"), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) {
      throw new Error("Not found or not authorized");
    }
    const newStorageId = fields.imageStorageId;
    const oldStorageId = item.imageStorageId;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, userId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, userId, newStorageId);
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === null) {
        patch[k] = undefined;
        continue;
      }
      if (val === undefined) continue;
      if (k === "name") {
        patch.name = sanitizeAndLimit(val as string, MAX_LENGTH.name, "Name");
      } else if (k === "category") {
        patch.category = sanitizeAndLimit(val as string, MAX_LENGTH.category, "Category");
      } else if (k === "notes") {
        patch.notes = sanitizeOptional(val as string, MAX_LENGTH.notes, "Notes");
      } else if (k === "tags") {
        patch.tags = (val as string[])
          .map((t, i) => sanitizeAndLimit(t, MAX_LENGTH.tag, `Tag ${i + 1}`))
          .filter(Boolean);
      } else if (k === "status") {
        if (!CLOSET_ITEM_STATUSES.includes(val as (typeof CLOSET_ITEM_STATUSES)[number])) continue;
        patch[k] = sanitizeString(val as string);
      } else if (k === "itemLink") {
        patch.itemLink = val === null ? undefined : sanitizeOptionalUrl(val as string);
      } else {
        patch[k] = val;
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("closetItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    await subtractUsageForStorageId(ctx, args.userId, item.imageStorageId);
    await ctx.db.delete(args.id);
  },
});

/** Delete multiple closet items. Authorized per item. */
export const removeMany = mutation({
  args: {
    ids: v.array(v.id("closetItems")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const item = await ctx.db.get(id);
      if (!item || item.userId !== args.userId) continue;
      await subtractUsageForStorageId(ctx, args.userId, item.imageStorageId);
      await ctx.db.delete(id);
    }
  },
});
