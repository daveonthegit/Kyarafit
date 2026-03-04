import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const sortByValidator = v.optional(
  v.union(v.literal("name"), v.literal("category"), v.literal("cost"))
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
    costCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("closetItems", args);
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
    costCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const item = await ctx.db.get(id);
    if (!item || item.userId !== userId) {
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
  args: { id: v.id("closetItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
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
      await ctx.db.delete(id);
    }
  },
});
