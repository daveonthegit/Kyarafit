import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import {
  deriveElementOverallBucket,
  deriveMaterialOverallBucket,
  deriveProgressPercent,
  isAllowedLink,
  normalizeDirectCostCents,
  OVERALL_BUCKETS,
  wouldCreateCycle,
} from "./lib/cosplayGraph";
import { getWorkflowItemsByAttachmentKey } from "./lib/workflowDomain";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { syncGeneratedWorkflowForNode } from "./workflow";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeOptionalUrl,
  sanitizeString,
  validateDateString,
} from "./lib/validation";

const NODE_TYPES = ["element", "material"] as const;
const ELEMENT_PURCHASE_STATUSES = ["to_buy", "bought"] as const;
const ELEMENT_BUILD_STATUSES = ["not_started", "wip", "built"] as const;
const MATERIAL_STATUSES = ["to_buy", "bought", "in_use", "complete"] as const;
const PRICING_MODES = ["total", "per_unit"] as const;

type NodeType = (typeof NODE_TYPES)[number];

function isNodeType(value: string | undefined): value is NodeType {
  return NODE_TYPES.includes(value as NodeType);
}

function asOptionalValidatedString<T extends readonly string[]>(
  value: string | undefined | null,
  validValues: T
): T[number] | undefined {
  if (!value) return undefined;
  return validValues.includes(value as T[number]) ? (value as T[number]) : undefined;
}

/**
 * Child nodes of a node, nested via the node's own `parentNodeId` (Step 2c model), ordered by
 * `sortOrder`. Replaces the old join-table nesting.
 */
async function getChildNodes(ctx: QueryCtx | MutationCtx, cosplayNodeId: Id<"cosplayNodes">) {
  const children = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", cosplayNodeId))
    .collect();
  return [...children].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function deriveNodeSummary(
  ctx: QueryCtx | MutationCtx,
  cosplayNodeId: Id<"cosplayNodes">,
  buildId?: Id<"builds">,
  visited = new Set<string>()
): Promise<{
  overallBucket: (typeof OVERALL_BUCKETS)[number];
  progressPercent: number;
  directCostCents: number;
  totalCostCents: number;
  childCount: number;
  hasIncompleteDescendants: boolean;
}> {
  if (visited.has(cosplayNodeId)) {
    return {
      overallBucket: "complete",
      progressPercent: 100,
      directCostCents: 0,
      totalCostCents: 0,
      childCount: 0,
      hasIncompleteDescendants: false,
    };
  }
  visited.add(cosplayNodeId);

  const node = await ctx.db.get(cosplayNodeId);
  if (!node) {
    return {
      overallBucket: "incomplete",
      progressPercent: 0,
      directCostCents: 0,
      totalCostCents: 0,
      childCount: 0,
      hasIncompleteDescendants: false,
    };
  }

  // Step 2c: per-build state IS the node's own fields now (the backfill merged per-build state into
  // each build-scoped node). `buildId` is still used to scope workflow task counts.
  const childNodes = await getChildNodes(ctx, cosplayNodeId);
  const childSummaries = await Promise.all(
    childNodes.map((child) => deriveNodeSummary(ctx, child._id, buildId, visited))
  );

  const scopedWorkflow = await getWorkflowItemsByAttachmentKey(
    ctx,
    node.userId,
    [`cosplayNode:${cosplayNodeId}`],
    buildId
  );
  const workflowTasks = scopedWorkflow.items.filter((item) => item.kind === "task");
  const completedTaskCount = workflowTasks.filter((task) => task.status === "done").length;
  const childBuckets = childSummaries.map((summary) => summary.overallBucket);

  const directCostCents = normalizeDirectCostCents({
    pricingMode: node.pricingMode,
    directCostCents: node.directCostCents,
    unitCostCents: node.unitCostCents,
    quantity: node.quantity,
  });

  const overallBucket =
    node.nodeType === "material"
      ? deriveMaterialOverallBucket({
          manualOverallBucket: asOptionalValidatedString(node.manualOverallBucket, OVERALL_BUCKETS),
          materialStatus: asOptionalValidatedString(node.materialStatus, MATERIAL_STATUSES),
          childBuckets,
          taskCount: workflowTasks.length,
          completedTaskCount,
        })
      : deriveElementOverallBucket({
          manualOverallBucket: asOptionalValidatedString(node.manualOverallBucket, OVERALL_BUCKETS),
          purchaseStatus: asOptionalValidatedString(node.purchaseStatus, ELEMENT_PURCHASE_STATUSES),
          buildStatus: asOptionalValidatedString(node.buildStatus, ELEMENT_BUILD_STATUSES),
          childBuckets,
          taskCount: workflowTasks.length,
          completedTaskCount,
        });

  const progressPercent = deriveProgressPercent({
    ownBucket: overallBucket,
    childBuckets,
    taskCount: workflowTasks.length,
    completedTaskCount,
  });

  const descendantCost = childSummaries.reduce((sum, summary) => sum + summary.totalCostCents, 0);
  const hasIncompleteDescendants = childSummaries.some(
    (summary) => summary.overallBucket !== "complete" || summary.hasIncompleteDescendants
  );

  return {
    overallBucket,
    progressPercent,
    directCostCents,
    totalCostCents: directCostCents + descendantCost,
    childCount: childNodes.length,
    hasIncompleteDescendants,
  };
}

async function getAllowedChildren(ctx: QueryCtx | MutationCtx, nodeId: Id<"cosplayNodes">) {
  const children = await getChildNodes(ctx, nodeId);
  return children.map((child) => child._id as string);
}

function sanitizeNodeFields(fields: {
  name?: string;
  category?: string;
  notes?: string;
  sourceUrl?: string | null;
  pricingMode?: string;
  directCostCents?: number;
  unitCostCents?: number;
  quantity?: number;
  unit?: string | null;
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  manualOverallBucket?: string | null;
  buildInstructions?: string;
  consumable?: boolean;
  finishedPhotoUrls?: string[];
}) {
  return {
    ...(fields.name !== undefined && {
      name: sanitizeAndLimit(fields.name, MAX_LENGTH.name, "Name"),
    }),
    ...(fields.category !== undefined && {
      category: sanitizeOptional(fields.category, MAX_LENGTH.category, "Category"),
    }),
    ...(fields.notes !== undefined && {
      notes: sanitizeOptional(fields.notes, MAX_LENGTH.notes, "Notes"),
    }),
    ...(fields.sourceUrl !== undefined && {
      sourceUrl: sanitizeOptionalUrl(fields.sourceUrl ?? undefined),
    }),
    ...(fields.pricingMode !== undefined && {
      pricingMode: asOptionalValidatedString(fields.pricingMode, PRICING_MODES),
    }),
    ...(fields.directCostCents !== undefined && { directCostCents: fields.directCostCents }),
    ...(fields.unitCostCents !== undefined && { unitCostCents: fields.unitCostCents }),
    ...(fields.quantity !== undefined && { quantity: fields.quantity }),
    ...(fields.unit !== undefined && {
      unit:
        fields.unit === null
          ? undefined
          : sanitizeOptional(fields.unit, MAX_LENGTH.category, "Unit"),
    }),
    ...(fields.purchaseStatus !== undefined && {
      purchaseStatus:
        fields.purchaseStatus === null
          ? undefined
          : asOptionalValidatedString(fields.purchaseStatus, ELEMENT_PURCHASE_STATUSES),
    }),
    ...(fields.buildStatus !== undefined && {
      buildStatus:
        fields.buildStatus === null
          ? undefined
          : asOptionalValidatedString(fields.buildStatus, ELEMENT_BUILD_STATUSES),
    }),
    ...(fields.materialStatus !== undefined && {
      materialStatus:
        fields.materialStatus === null
          ? undefined
          : asOptionalValidatedString(fields.materialStatus, MATERIAL_STATUSES),
    }),
    ...(fields.manualOverallBucket !== undefined && {
      manualOverallBucket:
        fields.manualOverallBucket === null
          ? undefined
          : asOptionalValidatedString(fields.manualOverallBucket, OVERALL_BUCKETS),
    }),
    ...(fields.buildInstructions !== undefined && {
      buildInstructions: sanitizeOptional(
        fields.buildInstructions,
        MAX_LENGTH.notes,
        "Build instructions"
      ),
    }),
    ...(fields.consumable !== undefined && { consumable: fields.consumable }),
    ...(fields.finishedPhotoUrls !== undefined && { finishedPhotoUrls: fields.finishedPhotoUrls }),
  };
}

export const list = query({
  args: {
    userId: v.string(),
    nodeType: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    overallBucket: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal("name"),
        v.literal("category"),
        v.literal("cost"),
        v.literal("progress"),
        v.literal("bucket")
      )
    ),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    buildId: v.optional(v.id("builds")),
    /** When true, exclude nodes that are children of another node (tree roots only). */
    rootsOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const order = args.order ?? "asc";
    const sortBy = args.sortBy ?? "name";
    const requestedNodeType = isNodeType(args.nodeType) ? args.nodeType : undefined;
    const categoryFilter = args.category?.trim().length ? args.category.trim() : undefined;
    let nodes = await (requestedNodeType
      ? ctx.db
          .query("cosplayNodes")
          .withIndex("by_userId_nodeType", (q) =>
            q.eq("userId", args.userId).eq("nodeType", requestedNodeType)
          )
          .collect()
      : ctx.db
          .query("cosplayNodes")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect());

    if (args.rootsOnly) {
      // Step 2c: a node is a child iff it has a parentNodeId; roots have none.
      nodes = nodes.filter((node) => node.parentNodeId === undefined);
    }

    if (categoryFilter) {
      nodes = nodes.filter((node) => node.category === categoryFilter);
    }

    const searchTrimmed = args.search?.trim().toLowerCase();
    if (searchTrimmed) {
      nodes = nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchTrimmed) ||
          (node.notes ?? "").toLowerCase().includes(searchTrimmed) ||
          (node.category ?? "").toLowerCase().includes(searchTrimmed) ||
          node.tags.some((tag) => tag.toLowerCase().includes(searchTrimmed))
      );
    }

    const withSummary = await Promise.all(
      nodes.map(async (node) => ({
        ...node,
        ...(await deriveNodeSummary(ctx, node._id, args.buildId)),
      }))
    );

    const overallBucketFilter = asOptionalValidatedString(args.overallBucket, OVERALL_BUCKETS);
    let filtered = overallBucketFilter
      ? withSummary.filter((node) => node.overallBucket === overallBucketFilter)
      : withSummary;

    filtered = filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "category":
          comparison = (a.category ?? "").localeCompare(b.category ?? "");
          break;
        case "cost":
          comparison = a.totalCostCents - b.totalCostCents;
          break;
        case "progress":
          comparison = a.progressPercent - b.progressPercent;
          break;
        case "bucket":
          comparison =
            OVERALL_BUCKETS.indexOf(a.overallBucket) - OVERALL_BUCKETS.indexOf(b.overallBucket);
          break;
        case "name":
        default:
          comparison = a.name.localeCompare(b.name);
          break;
      }
      if (comparison === 0) comparison = a.name.localeCompare(b.name);
      return order === "desc" ? -comparison : comparison;
    });

    return filtered;
  },
});

export const get = query({
  args: { id: v.id("cosplayNodes"), buildId: v.optional(v.id("builds")) },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.id);
    if (!node) return null;

    const [summary, childNodes] = await Promise.all([
      deriveNodeSummary(ctx, args.id, args.buildId),
      getChildNodes(ctx, args.id),
    ]);

    // Step 2c: nesting lives on the node. A child's `linkId` (used by removeChildLink /
    // reorderChildren) is now the child node's own id; `linkMode` is always "owned".
    const children = await Promise.all(
      childNodes.map(async (child) => {
        const childSummary = await deriveNodeSummary(ctx, child._id, args.buildId);
        return {
          ...child,
          ...childSummary,
          linkId: child._id,
          linkMode: "owned" as const,
          sortOrder: child.sortOrder ?? 0,
        };
      })
    );
    // A node has at most one parent now (single `parentNodeId`). Its "link" is its own id.
    const parentDoc = node.parentNodeId ? await ctx.db.get(node.parentNodeId) : null;
    const parents = parentDoc
      ? [
          {
            _id: parentDoc._id,
            name: parentDoc.name,
            nodeType: parentDoc.nodeType,
            linkId: node._id,
          },
        ]
      : [];

    return {
      ...node,
      ...summary,
      children: children.filter((child): child is NonNullable<typeof child> => child !== null),
      parents: parents.filter((parent): parent is NonNullable<typeof parent> => parent !== null),
    };
  },
});

export const listChildren = query({
  args: { parentNodeId: v.id("cosplayNodes"), buildId: v.optional(v.id("builds")) },
  handler: async (ctx, args) => {
    const children = await getChildNodes(ctx, args.parentNodeId);
    return await Promise.all(
      children.map(async (child) => ({
        ...child,
        ...(await deriveNodeSummary(ctx, child._id, args.buildId)),
        linkId: child._id,
        linkMode: "owned" as const,
        sortOrder: child.sortOrder ?? 0,
      }))
    );
  },
});

/** Shared implementation for build visual outline / board lists. */
export async function computeBuildVisualNodesList(ctx: QueryCtx, buildId: Id<"builds">) {
  // Step 2c: a build's root nodes are its own nodes with no parent, sourced from `buildId`.
  const buildNodes = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const rootLinks = buildNodes
    .filter((node) => node.parentNodeId === undefined)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((node) => ({ cosplayNodeId: node._id }));

  const visualNodes = new Map<
    string,
    {
      _id: Id<"cosplayNodes">;
      name: string;
      imageUrl?: string | null;
      imageStorageId?: Id<"_storage"> | null;
      nodeType: NodeType;
      progressPercent: number;
      childCount: number;
      hasIncompleteDescendants: boolean;
      isRoot: boolean;
      depth: number;
      sortOrder: number;
    }
  >();

  const visit = async (
    cosplayNodeId: Id<"cosplayNodes">,
    depth: number,
    isRoot: boolean,
    sortOrder: number,
    seen = new Set<string>()
  ) => {
    if (seen.has(cosplayNodeId)) return;
    seen.add(cosplayNodeId);

    const node = await ctx.db.get(cosplayNodeId);
    if (!node) return;

    const summary = await deriveNodeSummary(ctx, cosplayNodeId, buildId);
    const existing = visualNodes.get(cosplayNodeId);
    visualNodes.set(cosplayNodeId, {
      _id: node._id,
      name: node.name,
      imageUrl: node.imageUrl,
      imageStorageId: node.imageStorageId,
      nodeType: node.nodeType as NodeType,
      progressPercent: summary.progressPercent,
      childCount: summary.childCount,
      hasIncompleteDescendants: summary.hasIncompleteDescendants,
      isRoot: existing?.isRoot ?? isRoot,
      depth: existing ? Math.min(existing.depth, depth) : depth,
      sortOrder: existing ? Math.min(existing.sortOrder, sortOrder) : sortOrder,
    });

    const childNodes = await getChildNodes(ctx, cosplayNodeId);
    for (let index = 0; index < childNodes.length; index += 1) {
      await visit(childNodes[index]._id, depth + 1, false, sortOrder * 100 + index + 1, seen);
    }
  };

  for (let index = 0; index < rootLinks.length; index += 1) {
    await visit(rootLinks[index].cosplayNodeId, 0, true, index);
  }

  return Array.from(visualNodes.values()).sort((a, b) => {
    if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });
}

export const listBuildVisualNodes = query({
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
    return await computeBuildVisualNodesList(ctx, args.buildId);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    nodeType: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    pricingMode: v.optional(v.string()),
    directCostCents: v.optional(v.number()),
    unitCostCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    purchaseStatus: v.optional(v.string()),
    buildStatus: v.optional(v.string()),
    materialStatus: v.optional(v.string()),
    manualOverallBucket: v.optional(v.string()),
    buildInstructions: v.optional(v.string()),
    finishedPhotoUrls: v.optional(v.array(v.string())),
    consumable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!isNodeType(args.nodeType)) throw new Error("Invalid cosplay node type");
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
    }
    const sanitized = sanitizeNodeFields(args);
    const tags = args.tags
      .map((tag, index) => sanitizeAndLimit(tag, MAX_LENGTH.tag, `Tag ${index + 1}`))
      .filter(Boolean);
    const id = await ctx.db.insert(
      "cosplayNodes",
      withCreateMeta({
        userId: args.userId,
        nodeType: args.nodeType,
        name: sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name"),
        category: sanitized.category,
        tags,
        notes: sanitized.notes,
        imageUrl: args.imageUrl,
        imageStorageId: args.imageStorageId,
        sourceUrl: sanitized.sourceUrl,
        pricingMode: sanitized.pricingMode,
        directCostCents: sanitized.directCostCents,
        unitCostCents: sanitized.unitCostCents,
        quantity: sanitized.quantity,
        unit: sanitized.unit,
        purchaseStatus: sanitized.purchaseStatus,
        buildStatus: sanitized.buildStatus,
        materialStatus: sanitized.materialStatus,
        manualOverallBucket: sanitized.manualOverallBucket,
        buildInstructions: sanitized.buildInstructions,
        finishedPhotoUrls: sanitized.finishedPhotoUrls,
        consumable: sanitized.consumable,
      })
    );
    const created = await ctx.db.get(id);
    if (created) {
      await syncGeneratedWorkflowForNode(ctx, {
        userId: args.userId,
        cosplayNodeId: id,
        nodeName: created.name,
        category: created.category,
        purchaseStatus: created.purchaseStatus,
        buildStatus: created.buildStatus,
        materialStatus: created.materialStatus,
      });
    }
    return created;
  },
});

export const update = mutation({
  args: {
    id: v.id("cosplayNodes"),
    userId: v.string(),
    nodeType: v.optional(v.string()),
    name: v.optional(v.string()),
    category: v.optional(v.union(v.string(), v.null())),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.union(v.string(), v.null())),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    sourceUrl: v.optional(v.union(v.string(), v.null())),
    pricingMode: v.optional(v.union(v.string(), v.null())),
    directCostCents: v.optional(v.union(v.number(), v.null())),
    unitCostCents: v.optional(v.union(v.number(), v.null())),
    quantity: v.optional(v.union(v.number(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    purchaseStatus: v.optional(v.union(v.string(), v.null())),
    buildStatus: v.optional(v.union(v.string(), v.null())),
    materialStatus: v.optional(v.union(v.string(), v.null())),
    manualOverallBucket: v.optional(v.union(v.string(), v.null())),
    buildInstructions: v.optional(v.union(v.string(), v.null())),
    finishedPhotoUrls: v.optional(v.array(v.string())),
    consumable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, userId, tags, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Not found or not authorized");
    }

    const oldStorageId = existing.imageStorageId;
    const newStorageId = args.imageStorageId ?? undefined;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, userId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, userId, newStorageId);
    }

    const patch: Record<string, unknown> = {};
    if (fields.nodeType !== undefined) {
      if (!isNodeType(fields.nodeType)) throw new Error("Invalid cosplay node type");
      patch.nodeType = fields.nodeType;
    }
    const sanitized = sanitizeNodeFields({
      name: fields.name,
      category: fields.category ?? undefined,
      notes: fields.notes ?? undefined,
      sourceUrl: fields.sourceUrl ?? undefined,
      pricingMode: fields.pricingMode ?? undefined,
      directCostCents: fields.directCostCents ?? undefined,
      unitCostCents: fields.unitCostCents ?? undefined,
      quantity: fields.quantity ?? undefined,
      unit: fields.unit ?? undefined,
      purchaseStatus: fields.purchaseStatus ?? undefined,
      buildStatus: fields.buildStatus ?? undefined,
      materialStatus: fields.materialStatus ?? undefined,
      manualOverallBucket: fields.manualOverallBucket ?? undefined,
      buildInstructions: fields.buildInstructions ?? undefined,
      consumable: fields.consumable,
      finishedPhotoUrls: fields.finishedPhotoUrls,
    });
    Object.assign(patch, sanitized);

    if (fields.imageUrl !== undefined)
      patch.imageUrl = sanitizeOptionalUrl(fields.imageUrl ?? undefined);
    if (fields.imageStorageId !== undefined)
      patch.imageStorageId = fields.imageStorageId === null ? undefined : fields.imageStorageId;
    if (tags !== undefined) {
      patch.tags = tags
        .map((tag, index) => sanitizeAndLimit(tag, MAX_LENGTH.tag, `Tag ${index + 1}`))
        .filter(Boolean);
    }

    await ctx.db.patch(id, withUpdateMeta(existing, patch));
    const updated = await ctx.db.get(id);
    if (updated) {
      await syncGeneratedWorkflowForNode(ctx, {
        userId,
        cosplayNodeId: id,
        nodeName: updated.name,
        category: updated.category,
        purchaseStatus: updated.purchaseStatus,
        buildStatus: updated.buildStatus,
        materialStatus: updated.materialStatus,
      });
    }
    return updated;
  },
});

/**
 * Detach references to a node that is about to be deleted. Step 2c: build membership and per-build
 * state now live on the node itself (deleted with it), so this only clears foreign references from
 * buildTasks / packingListItems.
 */
async function removeRootLinkReferences(ctx: MutationCtx, cosplayNodeId: Id<"cosplayNodes">) {
  const tasks = await ctx.db
    .query("buildTasks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const task of tasks) {
    await ctx.db.patch(task._id, { cosplayNodeId: undefined });
  }

  const packingItems = await ctx.db
    .query("packingListItems")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const item of packingItems) {
    await ctx.db.patch(item._id, { cosplayNodeId: undefined });
  }
}

async function maybeCascadeOwnedMaterialChildren(
  ctx: MutationCtx,
  userId: string,
  parentNodeId: Id<"cosplayNodes">,
  cascade: boolean
) {
  const children = await getChildNodes(ctx, parentNodeId);

  for (const child of children) {
    // Detach the child from its (soon-deleted) parent. Nesting is single-parent now, so clearing
    // parentNodeId is the equivalent of deleting the old parent->child cosplayNodeLink.
    await ctx.db.patch(child._id, { parentNodeId: undefined, sortOrder: undefined });
    if (!child || child.userId !== userId) continue;
    if (!cascade) continue;
    // Links are always "owned" now; preserve the "material OR owned" gate (always true).

    // The child had a single parent (just cleared). It survives only if it is a build root.
    const isBuildRoot = child.buildId !== undefined;
    if (!isBuildRoot) {
      await removeRootLinkReferences(ctx, child._id);
      await subtractUsageForStorageId(ctx, userId, child.imageStorageId);
      await maybeCascadeOwnedMaterialChildren(ctx, userId, child._id, true);
      await ctx.db.delete(child._id);
    }
  }
}

export const remove = mutation({
  args: {
    id: v.id("cosplayNodes"),
    userId: v.string(),
    cascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.id);
    if (!node || node.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }

    await removeRootLinkReferences(ctx, args.id);
    await maybeCascadeOwnedMaterialChildren(ctx, args.userId, args.id, args.cascade ?? false);
    await subtractUsageForStorageId(ctx, args.userId, node.imageStorageId);
    await ctx.db.delete(args.id);
  },
});

export const removeMany = mutation({
  args: {
    ids: v.array(v.id("cosplayNodes")),
    userId: v.string(),
    cascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const node = await ctx.db.get(id);
      if (!node || node.userId !== args.userId) continue;
      await removeRootLinkReferences(ctx, id);
      await maybeCascadeOwnedMaterialChildren(ctx, args.userId, id, args.cascade ?? false);
      await subtractUsageForStorageId(ctx, args.userId, node.imageStorageId);
      await ctx.db.delete(id);
    }
  },
});

export const convertType = mutation({
  args: {
    id: v.id("cosplayNodes"),
    userId: v.string(),
    nodeType: v.string(),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.id);
    if (!node || node.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    if (!isNodeType(args.nodeType)) throw new Error("Invalid cosplay node type");

    if (args.nodeType === "element") {
      const children = await getChildNodes(ctx, args.id);
      if (children.some((child) => child.nodeType === "material")) {
        throw new Error("Elements cannot become parents of materials");
      }
    }

    await ctx.db.patch(
      args.id,
      withUpdateMeta(node, {
        nodeType: args.nodeType,
        purchaseStatus: args.nodeType === "material" ? undefined : node.purchaseStatus,
        buildStatus: args.nodeType === "material" ? undefined : node.buildStatus,
        materialStatus: args.nodeType === "element" ? undefined : node.materialStatus,
      })
    );
    return await ctx.db.get(args.id);
  },
});

export const addChildLink = mutation({
  args: {
    userId: v.string(),
    parentNodeId: v.id("cosplayNodes"),
    childNodeId: v.id("cosplayNodes"),
    linkMode: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [parent, child] = await Promise.all([
      ctx.db.get(args.parentNodeId),
      ctx.db.get(args.childNodeId),
    ]);
    if (!parent || !child || parent.userId !== args.userId || child.userId !== args.userId) {
      throw new Error("Parent or child not found");
    }
    if (!isAllowedLink(parent.nodeType as NodeType, child.nodeType as NodeType)) {
      throw new Error("That relationship is not allowed");
    }
    const cycle = await wouldCreateCycle(
      args.parentNodeId,
      args.childNodeId,
      async (nodeId) => await getAllowedChildren(ctx, nodeId as Id<"cosplayNodes">)
    );
    if (cycle) throw new Error("That link would create a cycle");

    // Step 2c: nesting lives on the child node. "Linking" a child = set its parentNodeId + sortOrder.
    // `linkMode` is accepted for API compatibility but no longer stored (all nesting is "owned").
    const existingChildren = await getChildNodes(ctx, args.parentNodeId);
    const sortOrder = args.sortOrder ?? existingChildren.length;
    await ctx.db.patch(
      args.childNodeId,
      withUpdateMeta(child, { parentNodeId: args.parentNodeId, sortOrder })
    );
    return await ctx.db.get(args.childNodeId);
  },
});

export const removeChildLink = mutation({
  args: {
    // Step 2c: the "link id" is the child node's own id; removing it clears the child's parentNodeId.
    id: v.id("cosplayNodes"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id);
    if (!child || child.userId !== args.userId) {
      throw new Error("Link not found");
    }
    await ctx.db.patch(args.id, withUpdateMeta(child, { parentNodeId: undefined }));
  },
});

export const reorderChildren = mutation({
  args: {
    parentNodeId: v.id("cosplayNodes"),
    userId: v.string(),
    // Step 2c: ordered child node ids (each child carries its own sortOrder).
    orderedLinkIds: v.array(v.id("cosplayNodes")),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentNodeId);
    if (!parent || parent.userId !== args.userId) {
      throw new Error("Parent not found");
    }

    for (let index = 0; index < args.orderedLinkIds.length; index += 1) {
      const childId = args.orderedLinkIds[index];
      const child = await ctx.db.get(childId);
      if (!child || child.parentNodeId !== args.parentNodeId || child.userId !== args.userId)
        continue;
      await ctx.db.patch(childId, withUpdateMeta(child, { sortOrder: index }));
    }
  },
});
