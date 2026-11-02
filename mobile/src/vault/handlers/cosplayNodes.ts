import type { VaultDoc } from "../store";
import type {
  LocalMutationCtx,
  LocalMutationHandler,
  LocalQueryCtx,
  LocalQueryHandler,
} from "../types";
import {
  deriveElementOverallBucket,
  deriveMaterialOverallBucket,
  deriveProgressPercent,
  isAllowedLink,
  normalizeDirectCostCents,
  OVERALL_BUCKETS,
} from "./lib/cosplayGraph";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { readAncestorIds } from "./lib/parentChain";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeOptionalUrl,
} from "./lib/validation";
import { getWorkflowItemsByAttachmentKey } from "./lib/workflowDomain";
import { removeGeneratedWorkflowForNode, syncGeneratedWorkflowForNode } from "./workflow";

/**
 * Local port of the personal-data parts of `convex/cosplayNodes.ts` (elements and materials).
 *
 * Same validation, derived summaries, cascades and return shapes as the server. Dropped because the
 * vault has a single owner and never talks to cloud storage: identity/collaborator access checks
 * (the owner may always read/write), storage-usage accounting, and the public-viewer gate on
 * `listBuildVisualNodes`.
 */

type ReadCtx = Pick<LocalQueryCtx, "db" | "userId">;

export type NodeDoc = VaultDoc & {
  version?: number;
  fieldUpdatedAt?: Record<string, number>;
  userId: string;
  nodeType: string;
  name: string;
  category?: string;
  tags: string[];
  notes?: string;
  imageUrl?: string;
  imageStorageId?: string;
  buildId?: string;
  parentNodeId?: string;
  sortOrder?: number;
  pricingMode?: string;
  directCostCents?: number;
  unitCostCents?: number;
  quantity?: number;
  purchaseStatus?: string;
  buildStatus?: string;
  materialStatus?: string;
  manualOverallBucket?: string;
};

const NODE_TYPES = ["element", "material"] as const;
const ELEMENT_PURCHASE_STATUSES = ["to_buy", "bought"] as const;
const ELEMENT_BUILD_STATUSES = ["not_started", "wip", "built"] as const;
const MATERIAL_STATUSES = ["to_buy", "bought", "in_use", "complete"] as const;
const PRICING_MODES = ["total", "per_unit"] as const;

type NodeType = (typeof NODE_TYPES)[number];

function isNodeType(value: unknown): value is NodeType {
  return NODE_TYPES.includes(value as NodeType);
}

function asOptionalValidatedString<T extends readonly string[]>(
  value: string | undefined | null,
  validValues: T
): T[number] | undefined {
  if (!value) return undefined;
  return validValues.includes(value as T[number]) ? (value as T[number]) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function strOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getNode(ctx: ReadCtx, id: unknown): NodeDoc | null {
  if (typeof id !== "string") return null;
  const doc = ctx.db.get(id);
  return doc && "nodeType" in doc ? (doc as NodeDoc) : null;
}

/** Child nodes nested via `parentNodeId`, ordered by `sortOrder`. */
export function getChildNodes(ctx: ReadCtx, cosplayNodeId: string): NodeDoc[] {
  const children = ctx.db
    .query("cosplayNodes")
    .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", cosplayNodeId))
    .collect() as NodeDoc[];
  return [...children].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export type NodeSummary = {
  overallBucket: (typeof OVERALL_BUCKETS)[number];
  progressPercent: number;
  directCostCents: number;
  totalCostCents: number;
  childCount: number;
  hasIncompleteDescendants: boolean;
};

export function deriveNodeSummary(
  ctx: ReadCtx,
  cosplayNodeId: string,
  buildId?: string,
  visited = new Set<string>()
): NodeSummary {
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

  const node = getNode(ctx, cosplayNodeId);
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

  const childNodes = getChildNodes(ctx, cosplayNodeId);
  const childSummaries = childNodes.map((child) =>
    deriveNodeSummary(ctx, child._id, buildId, visited)
  );

  const scopedWorkflow = getWorkflowItemsByAttachmentKey(
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

type NodeFieldInput = {
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
};

function sanitizeNodeFields(fields: NodeFieldInput) {
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

function nodeFieldInput(args: Record<string, unknown>): NodeFieldInput {
  return {
    name: str(args.name),
    category: str(args.category),
    notes: str(args.notes),
    sourceUrl: strOrNull(args.sourceUrl),
    pricingMode: str(args.pricingMode),
    directCostCents: num(args.directCostCents),
    unitCostCents: num(args.unitCostCents),
    quantity: num(args.quantity),
    unit: strOrNull(args.unit),
    purchaseStatus: strOrNull(args.purchaseStatus),
    buildStatus: strOrNull(args.buildStatus),
    materialStatus: strOrNull(args.materialStatus),
    manualOverallBucket: strOrNull(args.manualOverallBucket),
    buildInstructions: str(args.buildInstructions),
    consumable: typeof args.consumable === "boolean" ? args.consumable : undefined,
    finishedPhotoUrls: Array.isArray(args.finishedPhotoUrls)
      ? args.finishedPhotoUrls.filter((u): u is string => typeof u === "string")
      : undefined,
  };
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag, index) => sanitizeAndLimit(String(tag), MAX_LENGTH.tag, `Tag ${index + 1}`))
    .filter(Boolean);
}

/** Shared implementation for build visual outline / board lists. */
export function computeBuildVisualNodesList(ctx: ReadCtx, buildId: string) {
  const buildNodes = ctx.db
    .query("cosplayNodes")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect() as NodeDoc[];
  const rootLinks = buildNodes
    .filter((node) => node.parentNodeId === undefined)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((node) => ({ cosplayNodeId: node._id }));

  const visualNodes = new Map<
    string,
    {
      _id: string;
      name: string;
      imageUrl?: string | null;
      imageStorageId?: string | null;
      nodeType: NodeType;
      progressPercent: number;
      childCount: number;
      hasIncompleteDescendants: boolean;
      isRoot: boolean;
      depth: number;
      sortOrder: number;
    }
  >();

  const visit = (
    cosplayNodeId: string,
    depth: number,
    isRoot: boolean,
    sortOrder: number,
    seen = new Set<string>()
  ) => {
    if (seen.has(cosplayNodeId)) return;
    seen.add(cosplayNodeId);

    const node = getNode(ctx, cosplayNodeId);
    if (!node) return;

    const summary = deriveNodeSummary(ctx, cosplayNodeId, buildId);
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

    const childNodes = getChildNodes(ctx, cosplayNodeId);
    for (let index = 0; index < childNodes.length; index += 1) {
      visit(childNodes[index]._id, depth + 1, false, sortOrder * 100 + index + 1, seen);
    }
  };

  for (let index = 0; index < rootLinks.length; index += 1) {
    visit(rootLinks[index].cosplayNodeId, 0, true, index);
  }

  return Array.from(visualNodes.values()).sort((a, b) => {
    if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Detach references to a node about to be deleted. Build membership lives on the node itself
 * (deleted with it), so this only clears foreign references from buildTasks / packingListItems.
 */
function removeRootLinkReferences(ctx: LocalMutationCtx, cosplayNodeId: string) {
  removeGeneratedWorkflowForNode(ctx, cosplayNodeId);
  const tasks = ctx.db
    .query("buildTasks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const task of tasks) {
    ctx.db.patch(task._id, { cosplayNodeId: undefined });
  }

  const packingItems = ctx.db
    .query("packingListItems")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const item of packingItems) {
    ctx.db.patch(item._id, { cosplayNodeId: undefined });
  }
}

function maybeCascadeOwnedMaterialChildren(
  ctx: LocalMutationCtx,
  userId: string,
  parentNodeId: string,
  cascade: boolean
) {
  const children = getChildNodes(ctx, parentNodeId);
  for (const child of children) {
    ctx.db.patch(child._id, { parentNodeId: undefined, sortOrder: undefined });
    if (child.userId !== userId) continue;
    if (!cascade) continue;
    // The child had a single parent (just cleared). It survives only if it is a build root.
    const isBuildRoot = child.buildId !== undefined;
    if (!isBuildRoot) {
      removeRootLinkReferences(ctx, child._id);
      maybeCascadeOwnedMaterialChildren(ctx, userId, child._id, true);
      ctx.db.delete(child._id);
    }
  }
}

function syncGeneratedWorkflow(ctx: LocalMutationCtx, node: NodeDoc) {
  syncGeneratedWorkflowForNode(ctx, {
    userId: ctx.userId,
    cosplayNodeId: node._id,
    nodeName: node.name,
    category: node.category,
    purchaseStatus: node.purchaseStatus,
    buildStatus: node.buildStatus,
    materialStatus: node.materialStatus,
  });
}

function withSummary(ctx: ReadCtx, node: NodeDoc, buildId?: string) {
  return { ...node, ...deriveNodeSummary(ctx, node._id, buildId) };
}

export const queries: Record<string, LocalQueryHandler> = {
  "cosplayNodes:list": (ctx, args) => {
    const order = args.order === "desc" ? "desc" : "asc";
    const sortBy = str(args.sortBy) ?? "name";
    const requestedNodeType = isNodeType(args.nodeType) ? args.nodeType : undefined;
    const category = str(args.category);
    const categoryFilter = category?.trim().length ? category.trim() : undefined;
    const buildId = str(args.buildId);
    let nodes = (
      requestedNodeType
        ? ctx.db
            .query("cosplayNodes")
            .withIndex("by_userId_nodeType", (q) =>
              q.eq("userId", ctx.userId).eq("nodeType", requestedNodeType)
            )
            .collect()
        : ctx.db
            .query("cosplayNodes")
            .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
            .collect()
    ) as NodeDoc[];

    if (args.rootsOnly) {
      nodes = nodes.filter((node) => node.parentNodeId === undefined);
    }
    if (categoryFilter) {
      nodes = nodes.filter((node) => node.category === categoryFilter);
    }
    const searchTrimmed = str(args.search)?.trim().toLowerCase();
    if (searchTrimmed) {
      nodes = nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchTrimmed) ||
          (node.notes ?? "").toLowerCase().includes(searchTrimmed) ||
          (node.category ?? "").toLowerCase().includes(searchTrimmed) ||
          (node.tags ?? []).some((tag) => tag.toLowerCase().includes(searchTrimmed))
      );
    }

    const summarized = nodes.map((node) => withSummary(ctx, node, buildId));
    const overallBucketFilter = asOptionalValidatedString(str(args.overallBucket), OVERALL_BUCKETS);
    const filtered = overallBucketFilter
      ? summarized.filter((node) => node.overallBucket === overallBucketFilter)
      : summarized;

    return filtered.sort((a, b) => {
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
  },

  "cosplayNodes:get": (ctx, args) => {
    const node = getNode(ctx, args.id);
    if (!node) return null;
    const buildId = str(args.buildId);
    const summary = deriveNodeSummary(ctx, node._id, buildId);
    const children = getChildNodes(ctx, node._id).map((child) => ({
      ...child,
      ...deriveNodeSummary(ctx, child._id, buildId),
      linkId: child._id,
      linkMode: "owned" as const,
      sortOrder: child.sortOrder ?? 0,
    }));
    const parentDoc = node.parentNodeId ? getNode(ctx, node.parentNodeId) : null;
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
    return { ...node, ...summary, children, parents };
  },

  "cosplayNodes:listChildren": (ctx, args) => {
    const parent = getNode(ctx, args.parentNodeId);
    if (!parent) return [];
    const buildId = str(args.buildId);
    return getChildNodes(ctx, parent._id).map((child) => ({
      ...child,
      ...deriveNodeSummary(ctx, child._id, buildId),
      linkId: child._id,
      linkMode: "owned" as const,
      sortOrder: child.sortOrder ?? 0,
    }));
  },

  "cosplayNodes:listBuildVisualNodes": (ctx, args) => {
    const buildId = str(args.buildId);
    if (!buildId) return [];
    const build = ctx.db.get(buildId);
    if (!build) return [];
    return computeBuildVisualNodesList(ctx, buildId);
  },
};

export const mutations: Record<string, LocalMutationHandler> = {
  "cosplayNodes:create": (ctx, args) => {
    if (!isNodeType(args.nodeType)) throw new Error("Invalid cosplay node type");
    const sanitized = sanitizeNodeFields(nodeFieldInput(args));
    const id = ctx.db.insert(
      "cosplayNodes",
      withCreateMeta(
        {
          userId: ctx.userId,
          nodeType: args.nodeType,
          name: sanitizeAndLimit(str(args.name) ?? "", MAX_LENGTH.name, "Name"),
          category: sanitized.category,
          tags: sanitizeTags(args.tags),
          notes: sanitized.notes,
          imageUrl: str(args.imageUrl),
          imageStorageId: str(args.imageStorageId),
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
        },
        ctx.now
      )
    );
    const created = getNode(ctx, id);
    if (created) syncGeneratedWorkflow(ctx, created);
    return created;
  },

  "cosplayNodes:update": (ctx, args) => {
    const existing = getNode(ctx, args.id);
    if (!existing || existing.userId !== ctx.userId) {
      throw new Error("Not found or not authorized");
    }

    const patch: Record<string, unknown> = {};
    if (args.nodeType !== undefined) {
      if (!isNodeType(args.nodeType)) throw new Error("Invalid cosplay node type");
      patch.nodeType = args.nodeType;
    }
    const input = nodeFieldInput(args);
    const sanitized = sanitizeNodeFields({
      name: input.name,
      category: args.category === null ? undefined : input.category,
      notes: args.notes === null ? undefined : input.notes,
      sourceUrl: input.sourceUrl ?? undefined,
      pricingMode: input.pricingMode,
      directCostCents: input.directCostCents,
      unitCostCents: input.unitCostCents,
      quantity: input.quantity,
      unit: input.unit ?? undefined,
      purchaseStatus: input.purchaseStatus ?? undefined,
      buildStatus: input.buildStatus ?? undefined,
      materialStatus: input.materialStatus ?? undefined,
      manualOverallBucket: input.manualOverallBucket ?? undefined,
      buildInstructions: str(args.buildInstructions),
      consumable: input.consumable,
      finishedPhotoUrls: input.finishedPhotoUrls,
    });
    Object.assign(patch, sanitized);
    for (const key of [
      "category",
      "notes",
      "sourceUrl",
      "pricingMode",
      "directCostCents",
      "unitCostCents",
      "quantity",
      "unit",
      "purchaseStatus",
      "buildStatus",
      "materialStatus",
      "manualOverallBucket",
      "buildInstructions",
    ] as const) {
      if (args[key] === null) patch[key] = undefined;
    }

    if (args.imageUrl !== undefined) patch.imageUrl = sanitizeOptionalUrl(str(args.imageUrl));
    if (args.imageStorageId !== undefined) {
      patch.imageStorageId = args.imageStorageId === null ? undefined : args.imageStorageId;
    }
    if (args.tags !== undefined) patch.tags = sanitizeTags(args.tags);

    ctx.db.patch(existing._id, withUpdateMeta(existing, patch, ctx.now));
    const updated = getNode(ctx, existing._id);
    if (updated) syncGeneratedWorkflow(ctx, updated);
    return updated;
  },

  "cosplayNodes:remove": (ctx, args) => {
    const node = getNode(ctx, args.id);
    if (!node || node.userId !== ctx.userId) {
      throw new Error("Not found or not authorized");
    }
    removeRootLinkReferences(ctx, node._id);
    maybeCascadeOwnedMaterialChildren(ctx, ctx.userId, node._id, args.cascade === true);
    ctx.db.delete(node._id);
    return null;
  },

  "cosplayNodes:removeMany": (ctx, args) => {
    const ids = Array.isArray(args.ids) ? args.ids : [];
    for (const id of ids) {
      const node = getNode(ctx, id);
      if (!node || node.userId !== ctx.userId) continue;
      removeRootLinkReferences(ctx, node._id);
      maybeCascadeOwnedMaterialChildren(ctx, ctx.userId, node._id, args.cascade === true);
      ctx.db.delete(node._id);
    }
    return null;
  },

  "cosplayNodes:convertType": (ctx, args) => {
    const node = getNode(ctx, args.id);
    if (!node || node.userId !== ctx.userId) {
      throw new Error("Not found or not authorized");
    }
    if (!isNodeType(args.nodeType)) throw new Error("Invalid cosplay node type");
    if (args.nodeType === "element") {
      const children = getChildNodes(ctx, node._id);
      if (children.some((child) => child.nodeType === "material")) {
        throw new Error("Elements cannot become parents of materials");
      }
    }
    ctx.db.patch(
      node._id,
      withUpdateMeta(
        node,
        {
          nodeType: args.nodeType,
          purchaseStatus: args.nodeType === "material" ? undefined : node.purchaseStatus,
          buildStatus: args.nodeType === "material" ? undefined : node.buildStatus,
          materialStatus: args.nodeType === "element" ? undefined : node.materialStatus,
        },
        ctx.now
      )
    );
    const updated = getNode(ctx, node._id);
    if (updated) syncGeneratedWorkflow(ctx, updated);
    return updated;
  },

  "cosplayNodes:addChildLink": (ctx, args) => {
    const parent = getNode(ctx, args.parentNodeId);
    const child = getNode(ctx, args.childNodeId);
    if (!parent || !child || parent.userId !== ctx.userId || child.userId !== ctx.userId) {
      throw new Error("Parent or child not found");
    }
    if (!isAllowedLink(parent.nodeType as NodeType, child.nodeType as NodeType)) {
      throw new Error("That relationship is not allowed");
    }
    if (readAncestorIds(ctx.db, parent._id, "parentNodeId").includes(child._id)) {
      throw new Error("That link would create a cycle");
    }
    const existingChildren = getChildNodes(ctx, parent._id);
    const sortOrder = num(args.sortOrder) ?? existingChildren.length;
    ctx.db.patch(
      child._id,
      withUpdateMeta(child, { parentNodeId: parent._id, sortOrder }, ctx.now)
    );
    return getNode(ctx, child._id);
  },

  "cosplayNodes:removeChildLink": (ctx, args) => {
    const child = getNode(ctx, args.id);
    if (!child || child.userId !== ctx.userId) {
      throw new Error("Link not found");
    }
    ctx.db.patch(child._id, withUpdateMeta(child, { parentNodeId: undefined }, ctx.now));
    return null;
  },

  "cosplayNodes:reorderChildren": (ctx, args) => {
    const parent = getNode(ctx, args.parentNodeId);
    if (!parent || parent.userId !== ctx.userId) {
      throw new Error("Parent not found");
    }
    const ordered = Array.isArray(args.orderedLinkIds) ? args.orderedLinkIds : [];
    for (let index = 0; index < ordered.length; index += 1) {
      const child = getNode(ctx, ordered[index]);
      if (!child || child.parentNodeId !== parent._id || child.userId !== ctx.userId) continue;
      ctx.db.patch(child._id, withUpdateMeta(child, { sortOrder: index }, ctx.now));
    }
    return null;
  },
};
