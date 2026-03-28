import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

export const COSPLAY_ELEMENTS_MIGRATION_SEQUENCE = [
  "backfillCosplayNodesFromClosetItems",
  "backfillCosplayNodeLinksFromClosetItems",
  "backfillBuildCosplayLinksFromBuildItemLinks",
  "backfillBuildTaskCosplayRefs",
  "backfillPackingListCosplayRefs",
] as const;

export const WORKFLOW_MIGRATION_SEQUENCE = [
  "backfillWorkflowItemsFromBuildTasks",
  "backfillWorkflowCompletionAnchors",
] as const;

function mapLegacyStatusToNodeFields(
  status: string | undefined,
  nodeType: "element" | "material"
) {
  if (status === "complete") {
    return {
      purchaseStatus: nodeType === "element" ? ("bought" as const) : undefined,
      buildStatus: nodeType === "element" ? ("built" as const) : undefined,
      materialStatus: nodeType === "material" ? ("complete" as const) : undefined,
      manualOverallBucket: "complete" as const,
    };
  }

  if (status === "in_progress") {
    return {
      purchaseStatus: undefined,
      buildStatus: nodeType === "element" ? ("wip" as const) : undefined,
      materialStatus: nodeType === "material" ? ("in_use" as const) : undefined,
      manualOverallBucket: undefined,
    };
  }

  return {
    purchaseStatus: nodeType === "element" ? ("to_buy" as const) : undefined,
    buildStatus: nodeType === "element" ? ("not_started" as const) : undefined,
    materialStatus: nodeType === "material" ? ("to_buy" as const) : undefined,
    manualOverallBucket: undefined,
  };
}

function getLegacyNodeType(category: string | undefined): "element" | "material" {
  return category === "material" ? "material" : "element";
}

async function getCosplayNodeIdByLegacyId(
  ctx: Parameters<
    Parameters<typeof migrations.define<"closetItems">>[0]["migrateOne"]
  >[0],
  legacyClosetItemId: Id<"closetItems">
) {
  const node = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_legacyClosetItemId", (q) => q.eq("legacyClosetItemId", legacyClosetItemId))
    .unique();
  return node?._id;
}

const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
  migrationsLocationPrefix: "migrations:",
});

export { migrations };

export const run = migrations.runner();
export const runCosplayElementsMigration = migrations.runner([
  internal.migrations.backfillCosplayNodesFromClosetItems,
  internal.migrations.backfillCosplayNodeLinksFromClosetItems,
  internal.migrations.backfillBuildCosplayLinksFromBuildItemLinks,
  internal.migrations.backfillBuildTaskCosplayRefs,
  internal.migrations.backfillPackingListCosplayRefs,
]);

export const runWorkflowMigration = migrations.runner([
  internal.migrations.backfillWorkflowItemsFromBuildTasks,
  internal.migrations.backfillWorkflowCompletionAnchors,
]);

export const backfillCosplayNodesFromClosetItems = migrations.define({
  table: "closetItems",
  migrateOne: async (ctx, item) => {
    const nodeType = getLegacyNodeType(item.category);
    const statusPatch = mapLegacyStatusToNodeFields(item.status, nodeType);
    const existingNode = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_legacyClosetItemId", (q) => q.eq("legacyClosetItemId", item._id))
      .unique();

    if (existingNode) {
      await ctx.db.patch(existingNode._id, {
        userId: item.userId,
        nodeType,
        name: item.name,
        category: item.category,
        tags: item.tags,
        notes: item.notes,
        imageUrl: item.imageUrl,
        imageStorageId: item.imageStorageId,
        sourceUrl: item.itemLink,
        pricingMode: "total",
        directCostCents: item.costCents,
        ...statusPatch,
      });
      return;
    }

    await ctx.db.insert("cosplayNodes", {
      userId: item.userId,
      legacyClosetItemId: item._id,
      nodeType,
      name: item.name,
      category: item.category,
      tags: item.tags,
      notes: item.notes,
      imageUrl: item.imageUrl,
      imageStorageId: item.imageStorageId,
      sourceUrl: item.itemLink,
      pricingMode: "total",
      directCostCents: item.costCents,
      ...statusPatch,
    });
  },
});

export const backfillCosplayNodeLinksFromClosetItems = migrations.define({
  table: "closetItems",
  migrateOne: async (ctx, item) => {
    if (!item.parentItemId || item.parentItemId === item._id) {
      return;
    }

    const childNodeId = await getCosplayNodeIdByLegacyId(ctx, item._id);
    const parentNodeId = await getCosplayNodeIdByLegacyId(ctx, item.parentItemId);
    if (!childNodeId || !parentNodeId) {
      return;
    }

    const [childNode, parentNode] = await Promise.all([
      ctx.db.get(childNodeId),
      ctx.db.get(parentNodeId),
    ]);
    if (!childNode || !parentNode) {
      return;
    }

    if (parentNode.nodeType === "element" && childNode.nodeType === "material") {
      return;
    }

    const existingLinks = await ctx.db
      .query("cosplayNodeLinks")
      .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", parentNodeId))
      .collect();
    if (existingLinks.some((link) => link.childNodeId === childNodeId)) {
      return;
    }

    await ctx.db.insert("cosplayNodeLinks", {
      userId: item.userId,
      parentNodeId,
      childNodeId,
      sortOrder: existingLinks.length,
      linkMode: "owned",
    });
  },
});

export const backfillBuildCosplayLinksFromBuildItemLinks = migrations.define({
  table: "buildItemLinks",
  migrateOne: async (ctx, link) => {
    const cosplayNodeId = await getCosplayNodeIdByLegacyId(ctx, link.closetItemId);
    if (!cosplayNodeId) {
      return;
    }

    const existingBuildLinks = await ctx.db
      .query("buildCosplayLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", link.buildId))
      .collect();
    if (!existingBuildLinks.some((row) => row.cosplayNodeId === cosplayNodeId)) {
      await ctx.db.insert("buildCosplayLinks", {
        userId: link.userId,
        buildId: link.buildId,
        cosplayNodeId,
        sortOrder: existingBuildLinks.length,
      });
    }

    const existingState = await ctx.db
      .query("buildNodeStates")
      .withIndex("by_buildId_cosplayNodeId", (q) =>
        q.eq("buildId", link.buildId).eq("cosplayNodeId", cosplayNodeId)
      )
      .unique();
    if (existingState) {
      return;
    }

    const legacyItem = await ctx.db.get(link.closetItemId);
    if (!legacyItem?.status) {
      return;
    }

    await ctx.db.insert("buildNodeStates", {
      userId: link.userId,
      buildId: link.buildId,
      cosplayNodeId,
      pricingMode: "total",
      directCostCents: legacyItem.costCents,
      ...mapLegacyStatusToNodeFields(
        legacyItem.status,
        getLegacyNodeType(legacyItem.category)
      ),
    });
  },
});

export const backfillBuildTaskCosplayRefs = migrations.define({
  table: "buildTasks",
  migrateOne: async (ctx, task) => {
    if (!task.closetItemId || task.cosplayNodeId) {
      return;
    }

    const cosplayNodeId = await getCosplayNodeIdByLegacyId(ctx, task.closetItemId);
    if (!cosplayNodeId) {
      return;
    }

    await ctx.db.patch(task._id, {
      cosplayNodeId,
      closetItemId: undefined,
    });
  },
});

export const backfillPackingListCosplayRefs = migrations.define({
  table: "packingListItems",
  migrateOne: async (ctx, item) => {
    if (!item.closetItemId || item.cosplayNodeId) {
      return;
    }

    const cosplayNodeId = await getCosplayNodeIdByLegacyId(ctx, item.closetItemId);
    if (!cosplayNodeId) {
      return;
    }

    await ctx.db.patch(item._id, {
      cosplayNodeId,
      closetItemId: undefined,
    });
  },
});

export const backfillWorkflowItemsFromBuildTasks = migrations.define({
  table: "buildTasks",
  migrateOne: async (ctx, task) => {
    const existing = await ctx.db
      .query("workflowItems")
      .withIndex("by_legacyBuildTaskId", (q) => q.eq("legacyBuildTaskId", task._id))
      .unique();
    let workflowItemId = existing?._id;
    if (!workflowItemId) {
      workflowItemId = await ctx.db.insert("workflowItems", {
        userId: task.userId,
        title: task.label,
        kind: "task",
        category: task.packingListItemId ? "pack" : "craft",
        status: task.checked ? "done" : "not_started",
        ancestorIds: [],
        sortOrder: task.sortOrder,
        scopeKind: task.buildId ? "build_specific" : "shared",
        sourceKind: task.packingListItemId ? "packing" : "manual",
        dueDate: task.dueDate,
        legacyBuildTaskId: task._id,
      });
    }

    const attachments = await ctx.db
      .query("workflowAttachments")
      .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", workflowItemId))
      .collect();
    const attachmentKeys = new Set(attachments.map((attachment) => attachment.entityKey));

    if (task.buildId && !attachmentKeys.has(`build:${task.buildId}`)) {
      await ctx.db.insert("workflowAttachments", {
        userId: task.userId,
        workflowItemId,
        entityType: "build",
        entityId: task.buildId,
        entityKey: `build:${task.buildId}`,
        role: "primary",
      });
    }
    if (task.cosplayNodeId && !attachmentKeys.has(`cosplayNode:${task.cosplayNodeId}`)) {
      await ctx.db.insert("workflowAttachments", {
        userId: task.userId,
        workflowItemId,
        entityType: "cosplayNode",
        entityId: task.cosplayNodeId,
        entityKey: `cosplayNode:${task.cosplayNodeId}`,
        role: "progress_source",
        buildContextId: task.buildId,
      });
    }
    if (task.packingListItemId && !attachmentKeys.has(`packingItem:${task.packingListItemId}`)) {
      await ctx.db.insert("workflowAttachments", {
        userId: task.userId,
        workflowItemId,
        entityType: "packingItem",
        entityId: task.packingListItemId,
        entityKey: `packingItem:${task.packingListItemId}`,
        role: "packing_entry",
      });
      await ctx.db.patch(task.packingListItemId, {
        workflowItemId,
        entryKind: "generated",
        sourceKind: "workflow",
      });
    }
  },
});

export const backfillWorkflowCompletionAnchors = migrations.define({
  table: "closetItems",
  migrateOne: async (ctx, item) => {
    if (!item.completionTaskId) return;
    const workflowItem = await ctx.db
      .query("workflowItems")
      .withIndex("by_legacyBuildTaskId", (q) => q.eq("legacyBuildTaskId", item.completionTaskId))
      .unique();
    if (!workflowItem) return;

    const cosplayNode = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_legacyClosetItemId", (q) => q.eq("legacyClosetItemId", item._id))
      .unique();
    if (!cosplayNode) return;

    const existing = await ctx.db
      .query("workflowAttachments")
      .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", workflowItem._id))
      .collect();
    const hasCompletionAnchor = existing.some(
      (attachment) =>
        attachment.entityType === "cosplayNode" &&
        attachment.entityId === cosplayNode._id &&
        attachment.role === "completion_anchor"
    );
    if (!hasCompletionAnchor) {
      await ctx.db.insert("workflowAttachments", {
        userId: item.userId,
        workflowItemId: workflowItem._id,
        entityType: "cosplayNode",
        entityId: cosplayNode._id,
        entityKey: `cosplayNode:${cosplayNode._id}`,
        role: "completion_anchor",
      });
    }
  },
});
