import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { deriveNodeSummary } from "./cosplayNodes";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeOptionalUrl,
  sanitizeString,
} from "./lib/validation";

const CLOSET_ITEM_STATUSES = ["planned", "in_progress", "complete"] as const;

const sortByValidator = v.optional(
  v.union(v.literal("name"), v.literal("category"), v.literal("cost"), v.literal("status"))
);
const orderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));
const legacyIdValidator = v.union(v.id("cosplayNodes"), v.id("closetItems"));

type CosplayNodeDoc = Doc<"cosplayNodes">;

function legacyStatusRank(status: string | undefined) {
  if (status === "complete") return 2;
  if (status === "in_progress") return 1;
  return 0;
}

function legacyStatusFromNode(
  node: Pick<CosplayNodeDoc, "buildStatus" | "materialStatus">,
  overallBucket: "incomplete" | "in_progress" | "complete"
): (typeof CLOSET_ITEM_STATUSES)[number] {
  if (overallBucket === "complete") return "complete";
  if (
    overallBucket === "in_progress" ||
    node.buildStatus === "wip" ||
    node.materialStatus === "in_use"
  ) {
    return "in_progress";
  }
  return "planned";
}

function legacyStatusPatch(
  status: string | undefined,
  nodeType: "element" | "material"
): Pick<
  CosplayNodeDoc,
  "purchaseStatus" | "buildStatus" | "materialStatus" | "manualOverallBucket"
> {
  const normalized =
    status && CLOSET_ITEM_STATUSES.includes(status as (typeof CLOSET_ITEM_STATUSES)[number])
      ? (sanitizeString(status) as (typeof CLOSET_ITEM_STATUSES)[number])
      : undefined;

  if (normalized === "complete") {
    return {
      purchaseStatus: nodeType === "element" ? "bought" : undefined,
      buildStatus: nodeType === "element" ? "built" : undefined,
      materialStatus: nodeType === "material" ? "complete" : undefined,
      manualOverallBucket: "complete",
    };
  }

  if (normalized === "in_progress") {
    return {
      purchaseStatus: nodeType === "element" ? undefined : undefined,
      buildStatus: nodeType === "element" ? "wip" : undefined,
      materialStatus: nodeType === "material" ? "in_use" : undefined,
      manualOverallBucket: undefined,
    };
  }

  return {
    purchaseStatus: nodeType === "element" ? "to_buy" : undefined,
    buildStatus: nodeType === "element" ? "not_started" : undefined,
    materialStatus: nodeType === "material" ? "to_buy" : undefined,
    manualOverallBucket: undefined,
  };
}

async function resolveNode(
  ctx: QueryCtx | MutationCtx,
  id: Id<"cosplayNodes"> | Id<"closetItems">
) {
  const current = await ctx.db.get(id as Id<"cosplayNodes">);
  if (current && "nodeType" in current) {
    return current as CosplayNodeDoc;
  }
  return (
    (await ctx.db
      .query("cosplayNodes")
      .withIndex("by_legacyClosetItemId", (q) =>
        q.eq("legacyClosetItemId", id as Id<"closetItems">)
      )
      .unique()) ?? null
  );
}

async function resolveLegacyClosetItem(
  ctx: QueryCtx | MutationCtx,
  id: Id<"closetItems">
) {
  const legacy = await ctx.db.get(id);
  if (legacy && !("nodeType" in legacy)) {
    return legacy;
  }
  return null;
}

async function mapNodeToLegacy(
  ctx: QueryCtx | MutationCtx,
  node: CosplayNodeDoc
) {
  const summary = await deriveNodeSummary(ctx, node._id);
  return {
    ...node,
    costCents: summary.directCostCents,
    status: legacyStatusFromNode(node, summary.overallBucket),
    itemLink: node.sourceUrl,
    overallBucket: summary.overallBucket,
    progressPercent: summary.progressPercent,
    totalCostCents: summary.totalCostCents,
  };
}

async function unlinkAndDeleteNode(
  ctx: MutationCtx,
  userId: string,
  node: CosplayNodeDoc
) {
  const buildLinks = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", node._id))
    .collect();
  for (const link of buildLinks) {
    await ctx.db.delete(link._id);
  }

  const buildStates = await ctx.db
    .query("buildNodeStates")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", node._id))
    .collect();
  for (const state of buildStates) {
    await ctx.db.delete(state._id);
  }

  const childLinks = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", node._id))
    .collect();
  for (const link of childLinks) {
    await ctx.db.delete(link._id);
  }

  const parentLinks = await ctx.db
    .query("cosplayNodeLinks")
    .withIndex("by_childNodeId", (q) => q.eq("childNodeId", node._id))
    .collect();
  for (const link of parentLinks) {
    await ctx.db.delete(link._id);
  }

  const tasks = await ctx.db
    .query("buildTasks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", node._id))
    .collect();
  for (const task of tasks) {
    await ctx.db.patch(task._id, { cosplayNodeId: undefined });
  }

  const packingItems = await ctx.db
    .query("packingListItems")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", node._id))
    .collect();
  for (const item of packingItems) {
    await ctx.db.patch(item._id, { cosplayNodeId: undefined });
  }

  await subtractUsageForStorageId(ctx, userId, node.imageStorageId);
  await ctx.db.delete(node._id);
}

export const list = query({
  args: {
    userId: v.string(),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: sortByValidator,
    order: orderValidator,
  },
  handler: async (ctx, args) => {
    const order = args.order ?? "asc";
    const sortBy = args.sortBy ?? "name";
    const categoryFilter = args.category?.trim().length ? args.category.trim() : undefined;
    const searchTrimmed = args.search?.trim().toLowerCase();

    let nodes = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    if (nodes.length === 0) {
      let legacyItems = await ctx.db
        .query("closetItems")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      if (categoryFilter) {
        legacyItems = legacyItems.filter((item) => item.category === categoryFilter);
      }
      if (searchTrimmed) {
        legacyItems = legacyItems.filter(
          (item) =>
            item.name.toLowerCase().includes(searchTrimmed) ||
            (item.notes ?? "").toLowerCase().includes(searchTrimmed) ||
            item.tags.some((tag) => tag.toLowerCase().includes(searchTrimmed))
        );
      }
      return [...legacyItems].sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case "category":
            cmp = (a.category ?? "").localeCompare(b.category ?? "");
            break;
          case "cost":
            cmp = (a.costCents ?? -1) - (b.costCents ?? -1);
            break;
          case "status":
            cmp = legacyStatusRank(a.status) - legacyStatusRank(b.status);
            break;
          case "name":
          default:
            cmp = a.name.localeCompare(b.name);
            break;
        }
        if (cmp === 0) cmp = a.name.localeCompare(b.name);
        return order === "desc" ? -cmp : cmp;
      });
    }

    if (categoryFilter) {
      nodes = nodes.filter((node) => node.category === categoryFilter);
    }

    if (searchTrimmed) {
      nodes = nodes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchTrimmed) ||
          (node.notes ?? "").toLowerCase().includes(searchTrimmed) ||
          node.tags.some((tag) => tag.toLowerCase().includes(searchTrimmed))
      );
    }

    const items = await Promise.all(nodes.map((node) => mapNodeToLegacy(ctx, node)));
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "category":
          cmp = (a.category ?? "").localeCompare(b.category ?? "");
          break;
        case "cost":
          cmp = (a.costCents ?? -1) - (b.costCents ?? -1);
          break;
        case "status":
          cmp = legacyStatusRank(a.status) - legacyStatusRank(b.status);
          break;
        case "name":
        default:
          cmp = a.name.localeCompare(b.name);
          break;
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return order === "desc" ? -cmp : cmp;
    });

    return sorted;
  },
});

export const get = query({
  args: { id: legacyIdValidator },
  handler: async (ctx, args) => {
    const node = await resolveNode(ctx, args.id);
    if (node) return await mapNodeToLegacy(ctx, node);
    const legacy = await resolveLegacyClosetItem(ctx, args.id as Id<"closetItems">);
    if (!legacy) return null;
    return legacy;
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
    itemLink: v.optional(v.string()),
    costCents: v.optional(v.number()),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.id("buildTasks")),
  },
  handler: async (ctx, args) => {
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
    }

    const name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
    const category = sanitizeAndLimit(args.category, MAX_LENGTH.category, "Category");
    const notes = sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes");
    const itemLink = sanitizeOptionalUrl(args.itemLink);
    const tags = args.tags
      .map((tag, index) => sanitizeAndLimit(tag, MAX_LENGTH.tag, `Tag ${index + 1}`))
      .filter(Boolean);
    const nodeType = category === "material" ? "material" : "element";
    const statusPatch = legacyStatusPatch(args.status, nodeType);

    const id = await ctx.db.insert("cosplayNodes", {
      userId: args.userId,
      nodeType,
      name,
      category,
      tags,
      notes,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      sourceUrl: itemLink,
      pricingMode: "total",
      directCostCents: args.costCents,
      ...statusPatch,
    });

    const node = await ctx.db.get(id);
    if (!node) return null;
    return await mapNodeToLegacy(ctx, node);
  },
});

export const update = mutation({
  args: {
    id: legacyIdValidator,
    userId: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    itemLink: v.optional(v.union(v.string(), v.null())),
    costCents: v.optional(v.union(v.number(), v.null())),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.union(v.id("buildTasks"), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const node = await resolveNode(ctx, id);
    if (!node || node.userId !== userId) {
      throw new Error("Not found or not authorized");
    }

    const newStorageId = fields.imageStorageId;
    const oldStorageId = node.imageStorageId;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, userId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, userId, newStorageId);
    }

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) {
      patch.name = sanitizeAndLimit(fields.name, MAX_LENGTH.name, "Name");
    }
    if (fields.category !== undefined) {
      const category =
        fields.category === null
          ? undefined
          : sanitizeAndLimit(fields.category, MAX_LENGTH.category, "Category");
      patch.category = category;
      if (category === "material") {
        patch.nodeType = "material";
      } else if (category) {
        patch.nodeType = "element";
      }
    }
    if (fields.notes !== undefined) {
      patch.notes = sanitizeOptional(fields.notes, MAX_LENGTH.notes, "Notes");
    }
    if (fields.tags !== undefined) {
      patch.tags = fields.tags
        .map((tag, index) => sanitizeAndLimit(tag, MAX_LENGTH.tag, `Tag ${index + 1}`))
        .filter(Boolean);
    }
    if (fields.imageUrl !== undefined) patch.imageUrl = fields.imageUrl;
    if (fields.imageStorageId !== undefined) patch.imageStorageId = fields.imageStorageId;
    if (fields.itemLink !== undefined) {
      patch.sourceUrl =
        fields.itemLink === null ? undefined : sanitizeOptionalUrl(fields.itemLink ?? undefined);
    }
    if (fields.costCents !== undefined) {
      patch.directCostCents = fields.costCents === null ? undefined : fields.costCents;
      patch.pricingMode = "total";
    }
    if (fields.status !== undefined) {
      Object.assign(
        patch,
        legacyStatusPatch(fields.status, (patch.nodeType as "element" | "material") ?? node.nodeType)
      );
    }

    await ctx.db.patch(node._id, patch);
    const updated = await ctx.db.get(node._id);
    if (!updated) return null;
    return await mapNodeToLegacy(ctx, updated);
  },
});

export const remove = mutation({
  args: { id: legacyIdValidator, userId: v.string() },
  handler: async (ctx, args) => {
    const node = await resolveNode(ctx, args.id);
    if (!node || node.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    await unlinkAndDeleteNode(ctx, args.userId, node);
  },
});

export const removeMany = mutation({
  args: {
    ids: v.array(legacyIdValidator),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const node = await resolveNode(ctx, id);
      if (!node || node.userId !== args.userId) continue;
      await unlinkAndDeleteNode(ctx, args.userId, node);
    }
  },
});
