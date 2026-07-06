import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { canUserEditBuild } from "./lib/buildAccess";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { idempotentReplay, idempotentRecord } from "./lib/idempotency";

export const listByBuild = query({
  args: { buildId: v.id("builds"), shareToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return [];
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: args.shareToken ?? null,
    });
    if (!allowed) return [];
    const rows = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return rows.sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
  },
});

export const add = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"buildReferenceImages"> | null;

    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    if (!args.imageStorageId && !args.imageUrl) {
      throw new Error("Either imageStorageId or imageUrl is required");
    }
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
    }
    const existing = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const maxOrder = existing.length ? Math.max(...existing.map((r) => r.sortOrder), -1) : -1;
    const id = await ctx.db.insert(
      "buildReferenceImages",
      withCreateMeta({
        userId: args.userId,
        buildId: args.buildId,
        imageStorageId: args.imageStorageId,
        imageUrl: args.imageUrl,
        sortOrder: maxOrder + 1,
      })
    );
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(id));
  },
});

export const remove = mutation({
  args: {
    id: v.id("buildReferenceImages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    const build = doc.buildId ? await ctx.db.get(doc.buildId) : null;
    const canEdit = build && (await canUserEditBuild(ctx, doc.buildId, args.userId));
    if (!canEdit) throw new Error("Not authorized");
    await subtractUsageForStorageId(ctx, doc.userId, doc.imageStorageId);
    await ctx.db.delete(args.id);
  },
});

export const reorder = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
    orderedIds: v.array(v.id("buildReferenceImages")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const existing = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const existingIds = new Set(existing.map((r) => r._id));
    const rowsById = new Map(existing.map((r) => [r._id, r]));
    const orderedSet = new Set(args.orderedIds);
    const appended = existing.filter((r) => !orderedSet.has(r._id));
    const fullOrder = [
      ...args.orderedIds.filter((id) => existingIds.has(id)),
      ...appended.map((r) => r._id),
    ];
    for (let i = 0; i < fullOrder.length; i++) {
      const row = rowsById.get(fullOrder[i]);
      await ctx.db.patch(fullOrder[i], withUpdateMeta(row ?? {}, { sortOrder: i }));
    }
  },
});
