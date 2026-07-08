import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

export const WORKFLOW_MIGRATION_SEQUENCE = ["backfillWorkflowItemsFromBuildTasks"] as const;

const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
  migrationsLocationPrefix: "migrations:",
});

export { migrations };

export const run = migrations.runner();

export const runWorkflowMigration = migrations.runner([
  internal.migrations.backfillWorkflowItemsFromBuildTasks,
]);

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

/**
 * READ-ONLY report on cosplayNodes build-scoping. Run in a deployment with:
 *   npx convex run migrations:reportCosplayNodeScoping
 * It writes nothing. Build membership now lives on the node's own `buildId` field (Step 2c), so the
 * report is derived entirely from cosplayNodes.
 */
export const reportCosplayNodeScoping = internalQuery({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("cosplayNodes").collect();
    const nodesAlreadyBuildScoped = nodes.filter((n) => n.buildId !== undefined).length;
    const nodesLibraryOnly = nodes.filter((n) => n.buildId === undefined).length;

    return {
      totalNodes: nodes.length,
      nodesAlreadyBuildScoped,
      nodesLibraryOnly, // attached to no build
    };
  },
});
