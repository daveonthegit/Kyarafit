import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("closetItems")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
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
