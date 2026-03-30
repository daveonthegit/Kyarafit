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
import { syncGeneratedWorkflowForNode } from "./workflow";
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
const LINK_MODES = ["owned", "reference"] as const;
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

async function getBuildNodeState(
  ctx: QueryCtx | MutationCtx,
  buildId: Id<"builds"> | undefined,
  cosplayNodeId: Id<"cosplayNodes">
) {
  if (!buildId) return null;
  return (
    (await ctx.db
      .query("buildNodeStates")
      .withIndex("by_buildId_cosplayNodeId", (q) =>
        q.eq("buildId", buildId).eq("cosplayNodeId", cosplayNodeId)
      )
      .unique()) ?? null
  );
}

async function getChildLinks(ctx: QueryCtx | MutationCtx, cosplayNodeId: Id<"cosplayNodes">) {
  const links = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_parentNodeId_sortOrder", (q) => q.eq("parentNodeId", cosplayNodeId))
    .collect();
  return [...links].sort((a, b) => a.sortOrder - b.sortOrder);
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

  const state = await getBuildNodeState(ctx, buildId, cosplayNodeId);
  const childLinks = await getChildLinks(ctx, cosplayNodeId);
  const childSummaries = await Promise.all(
    childLinks.map((link) => deriveNodeSummary(ctx, link.childNodeId, buildId, visited))
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

  const effectivePricingMode = state?.pricingMode ?? node.pricingMode;
  const directCostCents = normalizeDirectCostCents({
    pricingMode: effectivePricingMode,
    directCostCents: state?.directCostCents ?? node.directCostCents,
    unitCostCents: state?.unitCostCents ?? node.unitCostCents,
    quantity: state?.quantity ?? node.quantity,
  });

  const overallBucket =
    node.nodeType === "material"
      ? deriveMaterialOverallBucket({
          manualOverallBucket: asOptionalValidatedString(
            state?.manualOverallBucket ?? node.manualOverallBucket,
            OVERALL_BUCKETS
          ),
          materialStatus: asOptionalValidatedString(
            state?.materialStatus ?? node.materialStatus,
            MATERIAL_STATUSES
          ),
          childBuckets,
          taskCount: workflowTasks.length,
          completedTaskCount,
        })
      : deriveElementOverallBucket({
          manualOverallBucket: asOptionalValidatedString(
            state?.manualOverallBucket ?? node.manualOverallBucket,
            OVERALL_BUCKETS
          ),
          purchaseStatus: asOptionalValidatedString(
            state?.purchaseStatus ?? node.purchaseStatus,
            ELEMENT_PURCHASE_STATUSES
          ),
          buildStatus: asOptionalValidatedString(
            state?.buildStatus ?? node.buildStatus,
            ELEMENT_BUILD_STATUSES
          ),
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
    childCount: childLinks.length,
    hasIncompleteDescendants,
  };
}

async function getAllowedChildren(ctx: QueryCtx | MutationCtx, nodeId: Id<"cosplayNodes">) {
  const links = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", nodeId))
    .collect();
  return links.map((link) => link.childNodeId as string);
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

    const [summary, childLinks, parentLinks] = await Promise.all([
      deriveNodeSummary(ctx, args.id, args.buildId),
      getChildLinks(ctx, args.id),
      ctx.db
        .query("cosplayNodeLinks")
        .withIndex("by_childNodeId", (q) => q.eq("childNodeId", args.id))
        .collect(),
    ]);

    const children = await Promise.all(
      childLinks.map(async (link) => {
        const child = await ctx.db.get(link.childNodeId);
        if (!child) return null;
        const childSummary = await deriveNodeSummary(ctx, child._id, args.buildId);
        return {
          ...child,
          ...childSummary,
          linkId: link._id,
          linkMode: link.linkMode,
          sortOrder: link.sortOrder,
        };
      })
    );
    const parents = await Promise.all(
      parentLinks.map(async (link) => {
        const parent = await ctx.db.get(link.parentNodeId);
        return parent
          ? { _id: parent._id, name: parent.name, nodeType: parent.nodeType, linkId: link._id }
          : null;
      })
    );

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
    const links = await getChildLinks(ctx, args.parentNodeId);
    return (
      await Promise.all(
        links.map(async (link) => {
          const child = await ctx.db.get(link.childNodeId);
          if (!child) return null;
          return {
            ...child,
            ...(await deriveNodeSummary(ctx, child._id, args.buildId)),
            linkId: link._id,
            linkMode: link.linkMode,
            sortOrder: link.sortOrder,
          };
        })
      )
    ).filter((child): child is NonNullable<typeof child> => child !== null);
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
    const id = await ctx.db.insert("cosplayNodes", {
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
    });
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
    imageStorageId: v.optional(v.id("_storage")),
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
    const newStorageId = args.imageStorageId;
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

    if (fields.imageUrl !== undefined) patch.imageUrl = fields.imageUrl ?? undefined;
    if (fields.imageStorageId !== undefined) patch.imageStorageId = fields.imageStorageId;
    if (tags !== undefined) {
      patch.tags = tags
        .map((tag, index) => sanitizeAndLimit(tag, MAX_LENGTH.tag, `Tag ${index + 1}`))
        .filter(Boolean);
    }

    await ctx.db.patch(id, patch);
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

async function removeRootLinkReferences(ctx: MutationCtx, cosplayNodeId: Id<"cosplayNodes">) {
  const buildLinks = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const link of buildLinks) {
    await ctx.db.delete(link._id);
  }

  const buildStates = await ctx.db
    .query("buildNodeStates")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const state of buildStates) {
    await ctx.db.delete(state._id);
  }

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
  const childLinks = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", parentNodeId))
    .collect();

  for (const link of childLinks) {
    const child = await ctx.db.get(link.childNodeId);
    await ctx.db.delete(link._id);
    if (!child || child.userId !== userId) continue;
    if (!cascade) continue;
    if (child.nodeType !== "material" && link.linkMode !== "owned") continue;

    const remainingParents = await ctx.db
      .query("cosplayNodeLinks")
      .withIndex("by_childNodeId", (q) => q.eq("childNodeId", child._id))
      .collect();
    const remainingRoots = await ctx.db
      .query("buildCosplayLinks")
      .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", child._id))
      .collect();
    if (remainingParents.length === 0 && remainingRoots.length === 0) {
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

    const parentLinks = await ctx.db
      .query("cosplayNodeLinks")
      .withIndex("by_childNodeId", (q) => q.eq("childNodeId", args.id))
      .collect();
    for (const link of parentLinks) {
      await ctx.db.delete(link._id);
    }

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
      const parentLinks = await ctx.db
        .query("cosplayNodeLinks")
        .withIndex("by_childNodeId", (q) => q.eq("childNodeId", id))
        .collect();
      for (const link of parentLinks) {
        await ctx.db.delete(link._id);
      }
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
      const childLinks = await getChildLinks(ctx, args.id);
      const children = await Promise.all(childLinks.map((link) => ctx.db.get(link.childNodeId)));
      if (children.some((child) => child?.nodeType === "material")) {
        throw new Error("Elements cannot become parents of materials");
      }
    }

    await ctx.db.patch(args.id, {
      nodeType: args.nodeType,
      purchaseStatus: args.nodeType === "material" ? undefined : node.purchaseStatus,
      buildStatus: args.nodeType === "material" ? undefined : node.buildStatus,
      materialStatus: args.nodeType === "element" ? undefined : node.materialStatus,
    });
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

    const existingLink = await ctx.db
      .query("cosplayNodeLinks")
      .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", args.parentNodeId))
      .collect();
    const sortOrder = args.sortOrder ?? existingLink.length;
    const linkMode = asOptionalValidatedString(args.linkMode, LINK_MODES) ?? "reference";
    const id = await ctx.db.insert("cosplayNodeLinks", {
      userId: args.userId,
      parentNodeId: args.parentNodeId,
      childNodeId: args.childNodeId,
      linkMode,
      sortOrder,
    });
    return await ctx.db.get(id);
  },
});

export const removeChildLink = mutation({
  args: {
    id: v.id("cosplayNodeLinks"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (!link || link.userId !== args.userId) {
      throw new Error("Link not found");
    }
    await ctx.db.delete(args.id);
  },
});

export const reorderChildren = mutation({
  args: {
    parentNodeId: v.id("cosplayNodes"),
    userId: v.string(),
    orderedLinkIds: v.array(v.id("cosplayNodeLinks")),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentNodeId);
    if (!parent || parent.userId !== args.userId) {
      throw new Error("Parent not found");
    }

    for (let index = 0; index < args.orderedLinkIds.length; index += 1) {
      const linkId = args.orderedLinkIds[index];
      const link = await ctx.db.get(linkId);
      if (!link || link.parentNodeId !== args.parentNodeId || link.userId !== args.userId) continue;
      await ctx.db.patch(linkId, { sortOrder: index });
    }
  },
});

export const upsertBuildNodeState = mutation({
  args: {
    buildId: v.id("builds"),
    cosplayNodeId: v.id("cosplayNodes"),
    userId: v.string(),
    purchaseStatus: v.optional(v.union(v.string(), v.null())),
    buildStatus: v.optional(v.union(v.string(), v.null())),
    materialStatus: v.optional(v.union(v.string(), v.null())),
    manualOverallBucket: v.optional(v.union(v.string(), v.null())),
    pricingMode: v.optional(v.union(v.string(), v.null())),
    directCostCents: v.optional(v.union(v.number(), v.null())),
    unitCostCents: v.optional(v.union(v.number(), v.null())),
    quantity: v.optional(v.union(v.number(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    purchasedAt: v.optional(v.union(v.string(), v.null())),
    startedAt: v.optional(v.union(v.string(), v.null())),
    completedAt: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.cosplayNodeId);
    if (!node || node.userId !== args.userId) {
      throw new Error("Node not found or not authorized");
    }

    const existing = await ctx.db
      .query("buildNodeStates")
      .withIndex("by_buildId_cosplayNodeId", (q) =>
        q.eq("buildId", args.buildId).eq("cosplayNodeId", args.cosplayNodeId)
      )
      .unique();
    const patch = {
      purchaseStatus:
        args.purchaseStatus === undefined
          ? existing?.purchaseStatus
          : args.purchaseStatus === null
            ? undefined
            : asOptionalValidatedString(args.purchaseStatus, ELEMENT_PURCHASE_STATUSES),
      buildStatus:
        args.buildStatus === undefined
          ? existing?.buildStatus
          : args.buildStatus === null
            ? undefined
            : asOptionalValidatedString(args.buildStatus, ELEMENT_BUILD_STATUSES),
      materialStatus:
        args.materialStatus === undefined
          ? existing?.materialStatus
          : args.materialStatus === null
            ? undefined
            : asOptionalValidatedString(args.materialStatus, MATERIAL_STATUSES),
      manualOverallBucket:
        args.manualOverallBucket === undefined
          ? existing?.manualOverallBucket
          : args.manualOverallBucket === null
            ? undefined
            : asOptionalValidatedString(args.manualOverallBucket, OVERALL_BUCKETS),
      pricingMode:
        args.pricingMode === undefined
          ? existing?.pricingMode
          : args.pricingMode === null
            ? undefined
            : asOptionalValidatedString(args.pricingMode, PRICING_MODES),
      directCostCents: args.directCostCents === null ? undefined : args.directCostCents,
      unitCostCents: args.unitCostCents === null ? undefined : args.unitCostCents,
      quantity: args.quantity === null ? undefined : args.quantity,
      unit:
        args.unit === undefined
          ? existing?.unit
          : args.unit === null
            ? undefined
            : sanitizeString(args.unit),
      purchasedAt:
        args.purchasedAt === undefined
          ? existing?.purchasedAt
          : args.purchasedAt === null
            ? undefined
            : validateDateString(args.purchasedAt, "Purchased date"),
      startedAt:
        args.startedAt === undefined
          ? existing?.startedAt
          : args.startedAt === null
            ? undefined
            : validateDateString(args.startedAt, "Started date"),
      completedAt:
        args.completedAt === undefined
          ? existing?.completedAt
          : args.completedAt === null
            ? undefined
            : validateDateString(args.completedAt, "Completed date"),
    };

    let updatedState;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      updatedState = await ctx.db.get(existing._id);
    } else {
      const id = await ctx.db.insert("buildNodeStates", {
        userId: args.userId,
        buildId: args.buildId,
        cosplayNodeId: args.cosplayNodeId,
        ...patch,
      });
      updatedState = await ctx.db.get(id);
    }
    await syncGeneratedWorkflowForNode(ctx, {
      userId: args.userId,
      cosplayNodeId: args.cosplayNodeId,
      buildId: args.buildId,
      nodeName: node.name,
      category: node.category,
      purchaseStatus: updatedState?.purchaseStatus ?? node.purchaseStatus,
      buildStatus: updatedState?.buildStatus ?? node.buildStatus,
      materialStatus: updatedState?.materialStatus ?? node.materialStatus,
    });
    return updatedState;
  },
});
