import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { canUserEditBuild } from "./lib/buildAccess";
import {
  entityKey,
  getWorkflowAttachmentsForUser,
  getWorkflowItemsByAttachmentKey,
  getWorkflowItemsForUser,
} from "./lib/workflowDomain";
import { sanitizeAndLimit, validateDateString, MAX_LENGTH } from "./lib/validation";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";

const legacyNodeIdValidator = v.id("cosplayNodes");

async function resolveCosplayNodeId(
  ctx: QueryCtx | MutationCtx,
  id: Id<"cosplayNodes"> | undefined | null
) {
  if (!id) return null;
  const current = await ctx.db.get(id);
  return current && "nodeType" in current ? (current._id as Id<"cosplayNodes">) : null;
}

export async function workflowTasksForBuildOwner(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  ownerUserId: string
) {
  const scoped = await getWorkflowItemsByAttachmentKey(
    ctx,
    ownerUserId,
    [entityKey("build", buildId)],
    buildId
  );
  const tasks = scoped.items.filter((item) => item.kind === "task");
  return await Promise.all(tasks.map((item) => mapLegacyTaskShape(ctx, item, ownerUserId)));
}

async function mapLegacyTaskShape(ctx: QueryCtx, item: Doc<"workflowItems">, userId: string) {
  const attachments = (await getWorkflowAttachmentsForUser(ctx, userId)).filter(
    (attachment) => attachment.workflowItemId === item._id
  );
  const buildAttachment = attachments.find((attachment) => attachment.entityType === "build");
  const nodeAttachment = attachments.find((attachment) => attachment.entityType === "cosplayNode");
  const packingAttachment = attachments.find(
    (attachment) => attachment.entityType === "packingItem"
  );
  const build = buildAttachment ? await ctx.db.get(buildAttachment.entityId as Id<"builds">) : null;
  return {
    _id: item._id,
    buildId: buildAttachment?.entityId as Id<"builds"> | undefined,
    label: item.title,
    cosplayNodeId: nodeAttachment?.entityId as Id<"cosplayNodes"> | undefined,
    closetItemId: undefined,
    packingListItemId: packingAttachment?.entityId as Id<"packingListItems"> | undefined,
    sortOrder: item.sortOrder,
    checked: item.status === "done",
    dueDate: item.dueDate,
    buildName: build?.name ?? null,
  };
}

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
    return await workflowTasksForBuildOwner(ctx, args.buildId, build.userId);
  },
});

export const listByCosplayNode = query({
  args: { cosplayNodeId: legacyNodeIdValidator },
  handler: async (ctx, args) => {
    const cosplayNodeId = await resolveCosplayNodeId(ctx, args.cosplayNodeId);
    if (!cosplayNodeId) return [];
    const node = await ctx.db.get(cosplayNodeId);
    if (!node) return [];
    const scoped = await getWorkflowItemsByAttachmentKey(ctx, node.userId, [
      entityKey("cosplayNode", cosplayNodeId),
    ]);
    return await Promise.all(
      scoped.items
        .filter((item) => item.kind === "task")
        .map((item) => mapLegacyTaskShape(ctx, item, node.userId))
    );
  },
});

export const listByClosetItem = query({
  args: { closetItemId: legacyNodeIdValidator },
  handler: async (ctx, args) => {
    const cosplayNodeId = await resolveCosplayNodeId(ctx, args.closetItemId);
    if (!cosplayNodeId) return [];
    const node = await ctx.db.get(cosplayNodeId);
    if (!node) return [];
    const scoped = await getWorkflowItemsByAttachmentKey(ctx, node.userId, [
      entityKey("cosplayNode", cosplayNodeId),
    ]);
    return await Promise.all(
      scoped.items
        .filter((item) => item.kind === "task")
        .map((item) => mapLegacyTaskShape(ctx, item, node.userId))
    );
  },
});

export const listByBuilds = query({
  args: { buildIds: v.array(v.id("builds")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const results = [];
    for (const buildId of args.buildIds) {
      const build = await ctx.db.get(buildId);
      if (!build) {
        results.push({ buildId, tasks: [] });
        continue;
      }
      const allowed = await canReadBuildWorkflowData(ctx, build, {
        viewerUserId,
        shareToken: null,
      });
      if (!allowed) {
        results.push({ buildId, tasks: [] });
        continue;
      }
      const scoped = await getWorkflowItemsByAttachmentKey(
        ctx,
        build.userId,
        [entityKey("build", buildId)],
        buildId
      );
      results.push({
        buildId,
        tasks: await Promise.all(
          scoped.items
            .filter((item) => item.kind === "task")
            .map((item) => mapLegacyTaskShape(ctx, item, build.userId))
        ),
      });
    }
    return results;
  },
});

export const listForPlanner = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const items = await getWorkflowItemsForUser(ctx, args.userId);
    const tasks = items.filter((item) => item.kind === "task");
    return await Promise.all(
      tasks.map(async (item) => {
        const legacy = await mapLegacyTaskShape(ctx, item, args.userId);
        const conventionAttachment = (await getWorkflowAttachmentsForUser(ctx, args.userId)).find(
          (attachment) =>
            attachment.workflowItemId === item._id && attachment.entityType === "convention"
        );
        return {
          _id: legacy._id,
          label: legacy.label,
          checked: legacy.checked,
          buildId: legacy.buildId,
          buildName: legacy.buildName ?? "Workflow",
          conventionId: conventionAttachment?.entityId as Id<"conventions"> | undefined,
          dueDate: legacy.dueDate,
          sortOrder: legacy.sortOrder,
          status: item.status,
          title: item.title,
          priority: item.priority ?? 0,
        };
      })
    );
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
      const id = await ctx.db.insert(
        "workflowItems",
        withCreateMeta({
          userId: args.userId,
          title: label,
          kind: "task",
          category: "craft",
          status: "not_started",
          ancestorIds: [],
          sortOrder: args.sortOrder ?? 0,
          scopeKind: "build_specific",
          sourceKind: "manual",
          dueDate,
          legacyBuildTaskId: undefined,
        })
      );
      await ctx.db.insert(
        "workflowAttachments",
        withCreateMeta({
          userId: args.userId,
          workflowItemId: id,
          entityType: "build",
          entityId: args.buildId,
          entityKey: entityKey("build", args.buildId),
          role: "primary",
        })
      );
      if (resolvedNodeId) {
        await ctx.db.insert(
          "workflowAttachments",
          withCreateMeta({
            userId: args.userId,
            workflowItemId: id,
            entityType: "cosplayNode",
            entityId: resolvedNodeId,
            entityKey: entityKey("cosplayNode", resolvedNodeId),
            role: "progress_source",
            buildContextId: args.buildId,
          })
        );
      }
      const created = await ctx.db.get(id);
      return created ? await mapLegacyTaskShape(ctx, created, args.userId) : null;
    }

    if (!resolvedNodeId) {
      throw new Error("Either buildId or cosplayNodeId is required");
    }
    const node = await ctx.db.get(resolvedNodeId);
    if (!node || node.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const id = await ctx.db.insert(
      "workflowItems",
      withCreateMeta({
        userId: args.userId,
        title: label,
        kind: "task",
        category: "craft",
        status: "not_started",
        ancestorIds: [],
        sortOrder: args.sortOrder ?? 0,
        scopeKind: "shared",
        sourceKind: "manual",
        dueDate,
        legacyBuildTaskId: undefined,
      })
    );
    await ctx.db.insert(
      "workflowAttachments",
      withCreateMeta({
        userId: args.userId,
        workflowItemId: id,
        entityType: "cosplayNode",
        entityId: resolvedNodeId,
        entityKey: entityKey("cosplayNode", resolvedNodeId),
        role: "primary",
      })
    );
    const created = await ctx.db.get(id);
    return created ? await mapLegacyTaskShape(ctx, created, args.userId) : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("workflowItems"),
    userId: v.string(),
    label: v.optional(v.string()),
    cosplayNodeId: v.optional(v.union(legacyNodeIdValidator, v.null())),
    closetItemId: v.optional(v.union(legacyNodeIdValidator, v.null())),
    sortOrder: v.optional(v.number()),
    checked: v.optional(v.boolean()),
    dueDate: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Task not found");
    const attachments = await ctx.db
      .query("workflowAttachments")
      .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", args.id))
      .collect();
    const buildAttachment = attachments.find((attachment) => attachment.entityType === "build");
    if (item.userId !== args.userId) {
      if (!buildAttachment) throw new Error("Not authorized");
      const allowed = await canUserEditBuild(
        ctx,
        buildAttachment.entityId as Id<"builds">,
        args.userId
      );
      if (!allowed) throw new Error("Not authorized");
    }

    const patch: Record<string, unknown> = {};
    if (args.label !== undefined)
      patch.title = sanitizeAndLimit(args.label, MAX_LENGTH.label, "Label");
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
    if (args.checked !== undefined) patch.status = args.checked ? "done" : "not_started";
    if (args.dueDate !== undefined) {
      patch.dueDate =
        args.dueDate === null ? undefined : validateDateString(args.dueDate, "Due date");
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(args.id, withUpdateMeta(item, patch));

    if (args.cosplayNodeId !== undefined || args.closetItemId !== undefined) {
      const resolvedNodeId =
        args.cosplayNodeId === null || args.closetItemId === null
          ? null
          : await resolveCosplayNodeId(
              ctx,
              args.cosplayNodeId === undefined ? (args.closetItemId ?? null) : args.cosplayNodeId
            );
      const existingNodeAttachments = attachments.filter(
        (attachment) => attachment.entityType === "cosplayNode"
      );
      for (const attachment of existingNodeAttachments) await ctx.db.delete(attachment._id);
      if (resolvedNodeId) {
        await ctx.db.insert(
          "workflowAttachments",
          withCreateMeta({
            userId: args.userId,
            workflowItemId: args.id,
            entityType: "cosplayNode",
            entityId: resolvedNodeId,
            entityKey: entityKey("cosplayNode", resolvedNodeId),
            role: "progress_source",
            buildContextId: buildAttachment?.entityId as Id<"builds"> | undefined,
          })
        );
      }
    }

    const updated = await ctx.db.get(args.id);
    return updated ? await mapLegacyTaskShape(ctx, updated, item.userId) : null;
  },
});

export const remove = mutation({
  args: { id: v.id("workflowItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Task not found");
    const attachments = await ctx.db
      .query("workflowAttachments")
      .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", args.id))
      .collect();
    const buildAttachment = attachments.find((attachment) => attachment.entityType === "build");
    if (item.userId !== args.userId) {
      if (!buildAttachment) throw new Error("Not authorized");
      const allowed = await canUserEditBuild(
        ctx,
        buildAttachment.entityId as Id<"builds">,
        args.userId
      );
      if (!allowed) throw new Error("Not authorized");
    }
    for (const attachment of attachments) await ctx.db.delete(attachment._id);
    await ctx.db.delete(args.id);
  },
});
