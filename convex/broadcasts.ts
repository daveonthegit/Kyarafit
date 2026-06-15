import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireAdmin } from "./admin";

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    audience: v.union(
      v.literal("all"),
      v.literal("tier:pro"),
      v.literal("tier:supporter"),
      v.literal("userIds")
    ),
    audienceArgs: v.optional(v.any()),
    scheduledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await ctx.db.insert("broadcasts", {
      title: args.title,
      body: args.body,
      deepLink: args.deepLink,
      audience: args.audience,
      audienceArgs: args.audienceArgs,
      scheduledAt: args.scheduledAt,
      createdBy: admin._id,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    broadcastId: v.id("broadcasts"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    deepLink: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    audienceArgs: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.broadcastId);
    if (!row || row.sentAt != null || row.cancelledAt != null) {
      throw new Error("Broadcast not found, sent, or cancelled");
    }
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.body !== undefined) patch.body = args.body;
    if (args.deepLink !== undefined) patch.deepLink = args.deepLink;
    if (args.scheduledAt !== undefined) patch.scheduledAt = args.scheduledAt;
    if (args.audienceArgs !== undefined) patch.audienceArgs = args.audienceArgs;
    await ctx.db.patch(args.broadcastId, patch);
  },
});

export const cancel = mutation({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.broadcastId);
    if (!row || row.sentAt != null || row.cancelledAt != null) {
      throw new Error("Broadcast not found, sent, or cancelled");
    }
    await ctx.db.patch(args.broadcastId, { cancelledAt: Date.now() });
  },
});

/** Stub: Phase 7 wires Expo Push fan-out + audience resolution. */
export const deliverDueStub = internalMutation({
  args: {},
  handler: async () => {
    return { ok: true as const, processed: 0 };
  },
});

/** Stub: Phase 7 polls Expo receipts. */
export const reconcileReceiptsStub = internalMutation({
  args: {},
  handler: async () => {
    return { ok: true as const };
  },
});
