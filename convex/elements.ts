import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { idempotentReplay, idempotentRecord } from "./lib/idempotency";
import { wouldCreateElementCycle } from "@kyarafit/design-system/domain/elements";
import {
  MAX_LENGTH,
  clampNumber,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeOptionalUrl,
} from "./lib/validation";
import { imageRefValidator } from "./lib/imageRef";

/**
 * Canonical Element model (DATA_AND_SYNC.md §3.1, PRODUCT_SPEC.md §4.2 — REQ-040/041/042/044).
 *
 * Elements are build-scoped (`buildId`) and form a hierarchy via `parentElementId`. There is no
 * shared cross-build graph: reuse across builds is duplicate-to-build (REQ-042). Every mutation is
 * ownership-checked (`userId` owns the element/build), validated, index-driven (never `filter()`),
 * maintains sync metadata (REQ-D40), and prevents parent cycles (REQ-044).
 */

const PRICING_MODES = ["per_unit", "total"] as const;

/** Direct child element ids of `parentId`, ordered. Backing for cycle detection + `listChildren`. */
async function childElementIds(
  ctx: QueryCtx | MutationCtx,
  parentId: Id<"elements">
): Promise<Id<"elements">[]> {
  const rows = await ctx.db
    .query("elements")
    .withIndex("by_parentElementId", (q) => q.eq("parentElementId", parentId))
    .collect();
  return rows.filter((r) => r.deletedAt == null).map((r) => r._id);
}

function sortElements(rows: Doc<"elements">[]): Doc<"elements">[] {
  return [...rows].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a._creationTime - b._creationTime
  );
}

/** Sanitize the user-editable element fields shared by `create` and `update`. */
function sanitizeTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  const cleaned = tags
    .map((t) => sanitizeOptional(t, MAX_LENGTH.tag, "Tag"))
    .filter((t): t is string => t != null);
  return cleaned;
}

function sanitizePricingMode(mode: string | undefined): string | undefined {
  if (mode == null) return undefined;
  return PRICING_MODES.includes(mode as (typeof PRICING_MODES)[number]) ? mode : undefined;
}

export const listByBuild = query({
  args: { buildId: v.id("builds"), userId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) return [];
    const rows = await ctx.db
      .query("elements")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return sortElements(rows.filter((r) => r.deletedAt == null));
  },
});

export const get = query({
  args: { id: v.id("elements"), userId: v.string() },
  handler: async (ctx, args) => {
    const element = await ctx.db.get(args.id);
    if (!element || element.userId !== args.userId || element.deletedAt != null) return null;
    return element;
  },
});

export const listChildren = query({
  args: { parentElementId: v.id("elements"), userId: v.string() },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentElementId);
    if (!parent || parent.userId !== args.userId) return [];
    const rows = await ctx.db
      .query("elements")
      .withIndex("by_parentElementId", (q) => q.eq("parentElementId", args.parentElementId))
      .collect();
    return sortElements(rows.filter((r) => r.deletedAt == null));
  },
});

/** Next sortOrder for a new element appended under `parentElementId` (or build root) of `buildId`. */
async function nextSortOrder(
  ctx: MutationCtx,
  buildId: Id<"builds">,
  parentElementId: Id<"elements"> | undefined
): Promise<number> {
  const siblings = parentElementId
    ? await ctx.db
        .query("elements")
        .withIndex("by_parentElementId", (q) => q.eq("parentElementId", parentElementId))
        .collect()
    : (
        await ctx.db
          .query("elements")
          .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
          .collect()
      ).filter((r) => r.parentElementId == null);
  const live = siblings.filter((r) => r.deletedAt == null);
  return live.length ? Math.max(...live.map((r) => r.sortOrder ?? 0)) + 1 : 0;
}

export const create = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    parentElementId: v.optional(v.id("elements")),
    name: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    imageRef: v.optional(imageRefValidator),
    pricingMode: v.optional(v.string()),
    directCostCents: v.optional(v.number()),
    unitCostCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    purchaseStatus: v.optional(v.string()),
    buildStatus: v.optional(v.string()),
    materialStatus: v.optional(v.string()),
    manualOverallBucket: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"elements"> | null;

    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Build not found or not authorized");
    }

    if (args.parentElementId) {
      const parent = await ctx.db.get(args.parentElementId);
      if (!parent || parent.userId !== args.userId) {
        throw new Error("Parent element not found or not authorized");
      }
      if (parent.buildId !== args.buildId) {
        throw new Error("Parent element belongs to a different build");
      }
    }

    const sortOrder =
      args.sortOrder ?? (await nextSortOrder(ctx, args.buildId, args.parentElementId));

    const id = await ctx.db.insert(
      "elements",
      withCreateMeta({
        userId: args.userId,
        buildId: args.buildId,
        parentElementId: args.parentElementId,
        name: sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name"),
        category: sanitizeOptional(args.category, MAX_LENGTH.category, "Category"),
        tags: sanitizeTags(args.tags),
        notes: sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes"),
        sourceUrl: sanitizeOptionalUrl(args.sourceUrl),
        imageRef: args.imageRef,
        pricingMode: sanitizePricingMode(args.pricingMode),
        directCostCents: clampNumber(args.directCostCents, 0, 1_000_000_000, "Direct cost"),
        unitCostCents: clampNumber(args.unitCostCents, 0, 1_000_000_000, "Unit cost"),
        quantity: clampNumber(args.quantity, 0, 1_000_000, "Quantity"),
        unit: sanitizeOptional(args.unit, MAX_LENGTH.category, "Unit"),
        purchaseStatus: sanitizeOptional(args.purchaseStatus, MAX_LENGTH.status, "Purchase status"),
        buildStatus: sanitizeOptional(args.buildStatus, MAX_LENGTH.status, "Build status"),
        materialStatus: sanitizeOptional(args.materialStatus, MAX_LENGTH.status, "Material status"),
        manualOverallBucket: sanitizeOptional(
          args.manualOverallBucket,
          MAX_LENGTH.status,
          "Overall bucket"
        ),
        sortOrder,
      })
    );
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(id));
  },
});

export const update = mutation({
  args: {
    id: v.id("elements"),
    userId: v.string(),
    parentElementId: v.optional(v.union(v.id("elements"), v.null())),
    name: v.optional(v.string()),
    category: v.optional(v.union(v.string(), v.null())),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.union(v.string(), v.null())),
    sourceUrl: v.optional(v.union(v.string(), v.null())),
    imageRef: v.optional(v.union(imageRefValidator, v.null())),
    pricingMode: v.optional(v.union(v.string(), v.null())),
    directCostCents: v.optional(v.union(v.number(), v.null())),
    unitCostCents: v.optional(v.union(v.number(), v.null())),
    quantity: v.optional(v.union(v.number(), v.null())),
    unit: v.optional(v.union(v.string(), v.null())),
    purchaseStatus: v.optional(v.union(v.string(), v.null())),
    buildStatus: v.optional(v.union(v.string(), v.null())),
    materialStatus: v.optional(v.union(v.string(), v.null())),
    manualOverallBucket: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.optional(v.number()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"elements"> | null;

    const element = await ctx.db.get(args.id);
    if (!element || element.userId !== args.userId) {
      throw new Error("Element not found or not authorized");
    }

    const patch: Record<string, unknown> = {};

    if (args.parentElementId !== undefined) {
      if (args.parentElementId === null) {
        patch.parentElementId = undefined;
      } else {
        const parent = await ctx.db.get(args.parentElementId);
        if (!parent || parent.userId !== args.userId) {
          throw new Error("Parent element not found or not authorized");
        }
        if (parent.buildId !== element.buildId) {
          throw new Error("Parent element belongs to a different build");
        }
        // Cycle iff the proposed parent is the element itself or one of its descendants. The helper
        // walks descendants of its 2nd arg looking for its 1st, so pass (proposedParent, movedElement).
        const cycle = await wouldCreateElementCycle(
          args.parentElementId as string,
          args.id as string,
          async (idStr) =>
            childElementIds(ctx, idStr as Id<"elements">).then((ids) => ids as string[])
        );
        if (cycle) throw new Error("Cannot set parent: would create a cycle");
        patch.parentElementId = args.parentElementId;
      }
    }

    if (args.name !== undefined) patch.name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
    if (args.category !== undefined)
      patch.category =
        args.category === null
          ? undefined
          : sanitizeOptional(args.category, MAX_LENGTH.category, "Category");
    if (args.tags !== undefined) patch.tags = sanitizeTags(args.tags);
    if (args.notes !== undefined)
      patch.notes =
        args.notes === null ? undefined : sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes");
    if (args.sourceUrl !== undefined)
      patch.sourceUrl = args.sourceUrl === null ? undefined : sanitizeOptionalUrl(args.sourceUrl);
    if (args.imageRef !== undefined)
      patch.imageRef = args.imageRef === null ? undefined : args.imageRef;
    if (args.pricingMode !== undefined)
      patch.pricingMode =
        args.pricingMode === null ? undefined : sanitizePricingMode(args.pricingMode);
    if (args.directCostCents !== undefined)
      patch.directCostCents =
        args.directCostCents === null
          ? undefined
          : clampNumber(args.directCostCents, 0, 1_000_000_000, "Direct cost");
    if (args.unitCostCents !== undefined)
      patch.unitCostCents =
        args.unitCostCents === null
          ? undefined
          : clampNumber(args.unitCostCents, 0, 1_000_000_000, "Unit cost");
    if (args.quantity !== undefined)
      patch.quantity =
        args.quantity === null ? undefined : clampNumber(args.quantity, 0, 1_000_000, "Quantity");
    if (args.unit !== undefined)
      patch.unit =
        args.unit === null ? undefined : sanitizeOptional(args.unit, MAX_LENGTH.category, "Unit");
    if (args.purchaseStatus !== undefined)
      patch.purchaseStatus =
        args.purchaseStatus === null
          ? undefined
          : sanitizeOptional(args.purchaseStatus, MAX_LENGTH.status, "Purchase status");
    if (args.buildStatus !== undefined)
      patch.buildStatus =
        args.buildStatus === null
          ? undefined
          : sanitizeOptional(args.buildStatus, MAX_LENGTH.status, "Build status");
    if (args.materialStatus !== undefined)
      patch.materialStatus =
        args.materialStatus === null
          ? undefined
          : sanitizeOptional(args.materialStatus, MAX_LENGTH.status, "Material status");
    if (args.manualOverallBucket !== undefined)
      patch.manualOverallBucket =
        args.manualOverallBucket === null
          ? undefined
          : sanitizeOptional(args.manualOverallBucket, MAX_LENGTH.status, "Overall bucket");
    if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, withUpdateMeta(element, patch));
    }
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(args.id));
  },
});

/** Delete an element and all of its descendants (the build-scoped subtree). Ownership-checked. */
export const remove = mutation({
  args: { id: v.id("elements"), userId: v.string() },
  handler: async (ctx, args) => {
    const element = await ctx.db.get(args.id);
    if (!element || element.userId !== args.userId) {
      throw new Error("Element not found or not authorized");
    }
    const stack: Id<"elements">[] = [args.id];
    const toDelete: Id<"elements">[] = [];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop() as Id<"elements">;
      if (seen.has(current)) continue;
      seen.add(current);
      toDelete.push(current);
      const children = await ctx.db
        .query("elements")
        .withIndex("by_parentElementId", (q) => q.eq("parentElementId", current))
        .collect();
      for (const child of children) stack.push(child._id);
    }
    for (const id of toDelete) await ctx.db.delete(id);
  },
});

/**
 * Duplicate an element into another build as an INDEPENDENT copy (REQ-042): new identity (fresh
 * insert), targets `targetBuildId`, placed at the build root (parent cleared). Mirrors the pure
 * `duplicateElementForBuild` contract. Both source element and target build must be owned by `userId`.
 */
export const duplicateToBuild = mutation({
  args: {
    userId: v.string(),
    sourceElementId: v.id("elements"),
    targetBuildId: v.id("builds"),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"elements"> | null;

    const source = await ctx.db.get(args.sourceElementId);
    if (!source || source.userId !== args.userId) {
      throw new Error("Source element not found or not authorized");
    }
    const targetBuild = await ctx.db.get(args.targetBuildId);
    if (!targetBuild || targetBuild.userId !== args.userId) {
      throw new Error("Target build not found or not authorized");
    }

    const sortOrder = await nextSortOrder(ctx, args.targetBuildId, undefined);
    const newId = await ctx.db.insert(
      "elements",
      withCreateMeta({
        userId: args.userId,
        buildId: args.targetBuildId,
        // parentElementId intentionally cleared: copy lands at the target build root (REQ-042).
        name: source.name,
        category: source.category,
        tags: source.tags,
        notes: source.notes,
        sourceUrl: source.sourceUrl,
        imageRef: source.imageRef,
        pricingMode: source.pricingMode,
        directCostCents: source.directCostCents,
        unitCostCents: source.unitCostCents,
        quantity: source.quantity,
        unit: source.unit,
        purchaseStatus: source.purchaseStatus,
        buildStatus: source.buildStatus,
        materialStatus: source.materialStatus,
        manualOverallBucket: source.manualOverallBucket,
        sortOrder,
      })
    );
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(newId));
  },
});

/** Re-order sibling elements (within a build root or a parent) by assigning contiguous sortOrder. */
export const reorder = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    parentElementId: v.optional(v.id("elements")),
    orderedIds: v.array(v.id("elements")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Build not found or not authorized");
    }
    const siblings = (
      args.parentElementId
        ? await ctx.db
            .query("elements")
            .withIndex("by_parentElementId", (q) => q.eq("parentElementId", args.parentElementId))
            .collect()
        : (
            await ctx.db
              .query("elements")
              .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
              .collect()
          ).filter((r) => r.parentElementId == null)
    ).filter((r) => r.deletedAt == null && r.buildId === args.buildId);

    const byId = new Map(siblings.map((r) => [r._id, r]));
    const orderedSet = new Set(args.orderedIds);
    const appended = siblings.filter((r) => !orderedSet.has(r._id));
    const fullOrder = [
      ...args.orderedIds.filter((id) => byId.has(id)),
      ...appended.map((r) => r._id),
    ];
    for (let i = 0; i < fullOrder.length; i++) {
      const row = byId.get(fullOrder[i]);
      if (!row) continue;
      await ctx.db.patch(fullOrder[i], withUpdateMeta(row, { sortOrder: i }));
    }
    return fullOrder.length;
  },
});
