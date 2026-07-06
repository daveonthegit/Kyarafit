import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";

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

export const COSPLAY_NODE_BUILD_SCOPE_MIGRATION_SEQUENCE = [
  "backfillCosplayNodeBuildScope",
] as const;

function mapLegacyStatusToNodeFields(status: string | undefined, nodeType: "element" | "material") {
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
  ctx: Parameters<Parameters<typeof migrations.define<"closetItems">>[0]["migrateOne"]>[0],
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

export const runCosplayNodeBuildScopeMigration = migrations.runner([
  internal.migrations.backfillCosplayNodeBuildScope,
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
      ...mapLegacyStatusToNodeFields(legacyItem.status, getLegacyNodeType(legacyItem.category)),
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

/**
 * ---------------------------------------------------------------------------
 * cosplayNodes build-scoping backfill (Step 2b — ADDITIVE ONLY).
 * ---------------------------------------------------------------------------
 * Makes `cosplayNodes` build-scoped by setting the direct `buildId` / `parentNodeId` / `sortOrder`
 * fields, WITHOUT touching the legacy join tables. Reads still go through buildCosplayLinks /
 * buildNodeStates / cosplayNodeLinks until the separate rewiring step (2c). This backfill:
 *   - SETS fields on existing nodes (in place),
 *   - INSERTS duplicate nodes for nodes shared across multiple builds,
 * and never deletes/patches-away existing rows or drops any table.
 *
 * Run it in a real deployment with:
 *   npx convex run migrations:runCosplayNodeBuildScopeMigration
 * or the single migration directly:
 *   npx convex run migrations:backfillCosplayNodeBuildScope '{"fn":"migrations:backfillCosplayNodeBuildScope"}'
 *
 * SEMANTICS (lossless "duplicate-per-build", library preserved):
 *   A node's build membership comes from `buildCosplayLinks` (many-to-many). A build-attached node
 *   is treated as the root of a SUBTREE (its transitive children via cosplayNodeLinks); the whole
 *   subtree belongs to the build(s) the root is attached to.
 *   - Root attached to exactly ONE build: set `buildId` on the root AND every descendant in place,
 *     merge that build's `buildNodeStates` into each node's own status/cost fields (state wins when
 *     defined), set the root's `sortOrder` from the buildCosplayLink and each descendant's from its
 *     cosplayNodeLink.
 *   - Root attached to MULTIPLE builds: the ORIGINAL subtree stays with the FIRST build (lowest
 *     sortOrder, then buildId); for EACH additional build INSERT a full independent copy of the
 *     subtree (root + descendants) scoped to that build, with remapped `parentNodeId`, per-build
 *     merged state, and fresh sync identity (withCreateMeta + a deterministic marker clientId).
 *   - Library-only node (no build attachment, not part of a build subtree): `buildId` left null;
 *     never deleted/moved. It stays a library node.
 *
 * parentNodeId CHOICE: we set parentNodeId from cosplayNodeLinks for ALL nodes (library and
 * build-scoped alike), staying WITHIN the same build/copy — a build subtree ROOT becomes top-level
 * (parentNodeId undefined) and descendants point at their scoped/copied parent; library nodes point
 * at their (library) parent. We never create cross-build parent links. NOTE: because a build's
 * subtree belongs to that build, descendants of a build-attached node DO receive the build's
 * `buildId` even though they have no direct buildCosplayLink — this is the only reading consistent
 * with the required "each build gets an independent copy of the subtree" duplication for extra
 * builds, and is additive (never removes a library node).
 *
 * IDEMPOTENT / re-runnable:
 *   - In-place scoping only patches a node when its `buildId` is not already the target build, so a
 *     re-run is a no-op for already-scoped nodes/subtrees.
 *   - Duplicate inserts are guarded by a deterministic marker clientId `bnbs:{rootId}:{buildId}`
 *     looked up via by_userId_clientId before inserting, so re-running never creates a second copy.
 */

type CosplayMigrateCtx = Parameters<
  Parameters<typeof migrations.define<"cosplayNodes">>[0]["migrateOne"]
>[0];

/** Per-build override fields on buildNodeStates that win over a node's library defaults (when set). */
type NodeStateOverride = Partial<
  Pick<
    Doc<"cosplayNodes">,
    | "purchaseStatus"
    | "buildStatus"
    | "materialStatus"
    | "manualOverallBucket"
    | "pricingMode"
    | "directCostCents"
    | "unitCostCents"
    | "quantity"
    | "unit"
  >
>;

/** Content fields copied verbatim when duplicating a node (excludes identity/meta/link fields). */
type NodeContent = Pick<
  Doc<"cosplayNodes">,
  | "nodeType"
  | "name"
  | "category"
  | "tags"
  | "notes"
  | "imageUrl"
  | "imageStorageId"
  | "sourceUrl"
  | "pricingMode"
  | "directCostCents"
  | "unitCostCents"
  | "quantity"
  | "unit"
  | "purchaseStatus"
  | "buildStatus"
  | "materialStatus"
  | "manualOverallBucket"
  | "buildInstructions"
  | "finishedPhotoUrls"
  | "consumable"
>;

function buildScopeMarkerClientId(rootId: Id<"cosplayNodes">, buildId: Id<"builds">): string {
  return `bnbs:${rootId}:${buildId}`;
}

/** Copy a node's content fields verbatim (identity/meta/link fields are set explicitly elsewhere). */
function nodeContent(node: Doc<"cosplayNodes">): NodeContent {
  return {
    nodeType: node.nodeType,
    name: node.name,
    category: node.category,
    tags: node.tags,
    notes: node.notes,
    imageUrl: node.imageUrl,
    imageStorageId: node.imageStorageId,
    sourceUrl: node.sourceUrl,
    pricingMode: node.pricingMode,
    directCostCents: node.directCostCents,
    unitCostCents: node.unitCostCents,
    quantity: node.quantity,
    unit: node.unit,
    purchaseStatus: node.purchaseStatus,
    buildStatus: node.buildStatus,
    materialStatus: node.materialStatus,
    manualOverallBucket: node.manualOverallBucket,
    buildInstructions: node.buildInstructions,
    finishedPhotoUrls: node.finishedPhotoUrls,
    consumable: node.consumable,
  };
}

/** Only the buildNodeStates override fields that are actually set (so we never clobber with undefined). */
function stateOverrides(state: Doc<"buildNodeStates"> | null | undefined): NodeStateOverride {
  const patch: NodeStateOverride = {};
  if (!state) return patch;
  if (state.purchaseStatus !== undefined) patch.purchaseStatus = state.purchaseStatus;
  if (state.buildStatus !== undefined) patch.buildStatus = state.buildStatus;
  if (state.materialStatus !== undefined) patch.materialStatus = state.materialStatus;
  if (state.manualOverallBucket !== undefined)
    patch.manualOverallBucket = state.manualOverallBucket;
  if (state.pricingMode !== undefined) patch.pricingMode = state.pricingMode;
  if (state.directCostCents !== undefined) patch.directCostCents = state.directCostCents;
  if (state.unitCostCents !== undefined) patch.unitCostCents = state.unitCostCents;
  if (state.quantity !== undefined) patch.quantity = state.quantity;
  if (state.unit !== undefined) patch.unit = state.unit;
  return patch;
}

/** buildNodeStates row for a (build, node) pair, if any. */
async function getBuildNodeState(
  ctx: CosplayMigrateCtx,
  buildId: Id<"builds">,
  cosplayNodeId: Id<"cosplayNodes">
) {
  return ctx.db
    .query("buildNodeStates")
    .withIndex("by_buildId_cosplayNodeId", (q) =>
      q.eq("buildId", buildId).eq("cosplayNodeId", cosplayNodeId)
    )
    .unique();
}

/** Distinct builds a node is directly attached to, sorted by (sortOrder, buildId). Deduped by build. */
async function getSortedBuildsForNode(ctx: CosplayMigrateCtx, cosplayNodeId: Id<"cosplayNodes">) {
  const links = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  const byBuild = new Map<string, { buildId: Id<"builds">; sortOrder: number }>();
  for (const link of links) {
    const key = link.buildId as string;
    const existing = byBuild.get(key);
    if (!existing || link.sortOrder < existing.sortOrder) {
      byBuild.set(key, { buildId: link.buildId, sortOrder: link.sortOrder });
    }
  }
  return [...byBuild.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.buildId as string).localeCompare(b.buildId as string)
  );
}

type SubtreeEntry = {
  node: Doc<"cosplayNodes">;
  /** Original parent within the subtree (undefined for the root). */
  parentId?: Id<"cosplayNodes">;
  /** sortOrder from the cosplayNodeLink connecting parent->node (undefined for the root). */
  linkSortOrder?: number;
};

/**
 * Collect the subtree rooted at `root` in stable order (root first, then children by link sortOrder),
 * following cosplayNodeLinks parent->child. Cycle-safe via a visited set.
 */
async function collectSubtree(
  ctx: CosplayMigrateCtx,
  root: Doc<"cosplayNodes">
): Promise<SubtreeEntry[]> {
  const entries: SubtreeEntry[] = [{ node: root }];
  const visited = new Set<string>([root._id as string]);
  const queue: Doc<"cosplayNodes">[] = [root];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    const childLinks = await ctx.db
      .query("cosplayNodeLinks")
      .withIndex("by_parentNodeId_sortOrder", (q) => q.eq("parentNodeId", parent._id))
      .collect();
    childLinks.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const link of childLinks) {
      if (visited.has(link.childNodeId as string)) continue;
      const child = await ctx.db.get(link.childNodeId);
      if (!child) continue;
      visited.add(child._id as string);
      entries.push({ node: child, parentId: parent._id, linkSortOrder: link.sortOrder });
      queue.push(child);
    }
  }
  return entries;
}

/** The single parent link for a node (lowest sortOrder if several), used for library-node nesting. */
async function getPrimaryParentLink(ctx: CosplayMigrateCtx, childNodeId: Id<"cosplayNodes">) {
  const links = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_childNodeId", (q) => q.eq("childNodeId", childNodeId))
    .collect();
  if (links.length === 0) return null;
  return links.sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

export const backfillCosplayNodeBuildScope = migrations.define({
  table: "cosplayNodes",
  migrateOne: async (ctx, node) => {
    const buildsForNode = await getSortedBuildsForNode(ctx, node._id);

    // --- Not directly attached to any build: library node or a not-yet-scoped subtree descendant.
    if (buildsForNode.length === 0) {
      // A copy or an already-scoped descendant: leave build fields alone (owned by its root).
      if (node.buildId !== undefined) return;
      // Library node: set parentNodeId (+ sortOrder) from its cosplayNodeLink nesting, if any.
      const parentLink = await getPrimaryParentLink(ctx, node._id);
      if (parentLink && node.parentNodeId !== parentLink.parentNodeId) {
        await ctx.db.patch(
          node._id,
          withUpdateMeta(node, {
            parentNodeId: parentLink.parentNodeId,
            sortOrder: parentLink.sortOrder,
          })
        );
      }
      return;
    }

    // --- Build-attached node: it is the root of a subtree scoped to its build(s).
    const subtree = await collectSubtree(ctx, node);
    const firstBuild = buildsForNode[0];

    // 1) Scope the ORIGINAL subtree to the FIRST build, in place (idempotent: skip if already set).
    for (const entry of subtree) {
      const isRoot = entry.node._id === node._id;
      if (entry.node.buildId === firstBuild.buildId) continue; // already scoped by a prior run
      const state = await getBuildNodeState(ctx, firstBuild.buildId, entry.node._id);
      await ctx.db.patch(
        entry.node._id,
        withUpdateMeta(entry.node, {
          buildId: firstBuild.buildId,
          parentNodeId: isRoot ? undefined : entry.parentId,
          sortOrder: isRoot ? firstBuild.sortOrder : entry.linkSortOrder,
          ...stateOverrides(state),
        })
      );
    }

    // 2) For each ADDITIONAL build, INSERT an independent copy of the whole subtree.
    for (let i = 1; i < buildsForNode.length; i += 1) {
      const target = buildsForNode[i];
      const markerClientId = buildScopeMarkerClientId(node._id, target.buildId);
      const existingCopy = await ctx.db
        .query("cosplayNodes")
        .withIndex("by_userId_clientId", (q) =>
          q.eq("userId", node.userId).eq("clientId", markerClientId)
        )
        .unique();
      if (existingCopy) continue; // this build's copy already exists — idempotent skip

      const idMap = new Map<string, Id<"cosplayNodes">>();
      for (const entry of subtree) {
        const isRoot = entry.node._id === node._id;
        const state = await getBuildNodeState(ctx, target.buildId, entry.node._id);
        const parentCopyId =
          isRoot || !entry.parentId ? undefined : idMap.get(entry.parentId as string);
        const newId = await ctx.db.insert(
          "cosplayNodes",
          withCreateMeta({
            userId: node.userId,
            ...nodeContent(entry.node),
            buildId: target.buildId,
            parentNodeId: parentCopyId,
            sortOrder: isRoot ? target.sortOrder : entry.linkSortOrder,
            ...stateOverrides(state),
            // Deterministic marker so re-runs detect this copy instead of duplicating it.
            clientId: buildScopeMarkerClientId(entry.node._id, target.buildId),
          })
        );
        idMap.set(entry.node._id as string, newId);
      }
    }
  },
});

/**
 * READ-ONLY dry-run for the cosplayNodes build-scoping migration. Run in a deployment with:
 *   npx convex run migrations:reportCosplayNodeScoping
 * It writes nothing. Use it to decide the backfill strategy (duplicate-per-build vs one-build-per-node)
 * and how many library-only nodes exist, before running the destructive backfill.
 */
export const reportCosplayNodeScoping = internalQuery({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("cosplayNodes").collect();
    const buildLinks = await ctx.db.query("buildCosplayLinks").collect();
    const nodeStates = await ctx.db.query("buildNodeStates").collect();
    const nodeLinks = await ctx.db.query("cosplayNodeLinks").collect();
    const itemLinks = await ctx.db.query("buildItemLinks").collect();

    // Distinct builds each node is attached to (many-to-many via buildCosplayLinks).
    const buildsPerNode = new Map<string, Set<string>>();
    for (const link of buildLinks) {
      const key = link.cosplayNodeId as string;
      const set = buildsPerNode.get(key) ?? new Set<string>();
      set.add(link.buildId as string);
      buildsPerNode.set(key, set);
    }

    let nodesInOneBuild = 0;
    let nodesSharedAcrossBuilds = 0;
    let maxBuildsForAnyNode = 0;
    for (const set of buildsPerNode.values()) {
      if (set.size === 1) nodesInOneBuild += 1;
      else if (set.size > 1) nodesSharedAcrossBuilds += 1;
      if (set.size > maxBuildsForAnyNode) maxBuildsForAnyNode = set.size;
    }
    const nodesWithZeroBuilds = nodes.filter((n) => !buildsPerNode.has(n._id as string)).length;

    // Nodes that already carry a direct buildId (i.e. backfill already ran, at least partially).
    const nodesAlreadyBuildScoped = nodes.filter((n) => n.buildId !== undefined).length;

    return {
      totalNodes: nodes.length,
      nodesInOneBuild,
      nodesSharedAcrossBuilds, // >0 means "duplicate-per-build" is needed to avoid data loss
      maxBuildsForAnyNode,
      nodesLibraryOnly: nodesWithZeroBuilds, // attached to no build
      nodesAlreadyBuildScoped,
      counts: {
        buildCosplayLinks: buildLinks.length,
        buildNodeStates: nodeStates.length, // per-build overrides to merge into scoped nodes
        cosplayNodeLinks: nodeLinks.length, // nesting to convert to parentNodeId
        buildItemLinks: itemLinks.length, // legacy closetItems links (closetItems being removed)
      },
    };
  },
});
