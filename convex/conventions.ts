import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { ensurePackingWorkflowItem, removeWorkflowItemCascade } from "./workflow";
import { idempotentRecord, idempotentReplay, runIdempotent } from "./lib/idempotency";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  validateDateString,
} from "./lib/validation";
import { optionalIdentity, requireIdentity } from "./lib/authz";

async function getPackingWorkflowStatus(
  ctx: QueryCtx | MutationCtx,
  item: Doc<"packingListItems">
) {
  if (!item.workflowItemId) return item.checked;
  const workflowItem = await ctx.db.get(item.workflowItemId);
  if (!workflowItem) return item.checked;
  return workflowItem.status === "done";
}

/**
 * The acting user's conventions. These rows carry name, location and dates — where
 * a named person will physically be, on which dates — so they are owner-only.
 * `userId` is retained for deployed clients but ignored.
 */
export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    return await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();
  },
});

/**
 * One convention. Takes no actor argument, so the owner check is written out;
 * it previously returned any convention document to anyone. Conventions have no
 * public surface, so the rule is owner-only.
 */
export const get = query({
  args: { id: v.id("conventions") },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return null;
    const convention = await ctx.db.get(args.id);
    if (!convention || convention.userId !== actorId) return null;
    return convention;
  },
});

/** Returns the soonest convention (name + startDate) that has this build in a day plan, or null. For hero "Planned for X". */
export const getEventForBuild = query({
  args: {
    buildId: v.id("builds"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return null;
    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();
    const notArchived = conventions.filter((c) => c.archived !== true);
    const withPlans: Array<{ name: string; startDate: string }> = [];
    for (const c of notArchived) {
      const plans = await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_conventionId", (q) => q.eq("conventionId", c._id))
        .collect();
      const hasBuild = plans.some((p) => p.buildId === args.buildId);
      if (hasBuild) withPlans.push({ name: c.name, startDate: c.startDate });
    }
    if (withPlans.length === 0) return null;
    withPlans.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return withPlans[0];
  },
});

/** Returns upcoming conventions (endDate >= today, not archived) with outfit count, sorted by startDate. */
export const listUpcomingWithPlanCounts = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const today = new Date().toISOString().slice(0, 10);
    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();
    const upcoming = conventions
      .filter((c) => c.archived !== true && c.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const limited = args.limit ? upcoming.slice(0, args.limit) : upcoming;
    const result = await Promise.all(
      limited.map(async (c) => {
        const plans = await ctx.db
          .query("conventionDayPlans")
          .withIndex("by_conventionId", (q) => q.eq("conventionId", c._id))
          .collect();
        const outfitCount = new Set(plans.filter((p) => p.buildId != null).map((p) => p.buildId))
          .size;
        return { convention: c, outfitCount };
      })
    );
    return result;
  },
});

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    startDate: v.string(),
    endDate: v.string(),
    /** Offline replay dedupe key (optional); see convex/lib/idempotency.ts. */
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    return runIdempotent(ctx, args.idempotencyKey, actorId, "conventions.create", async () => {
      if (args.imageStorageId) {
        await checkLimitAndAddUsage(ctx, actorId, args.imageStorageId);
      }
      const name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
      const location = sanitizeOptional(args.location, MAX_LENGTH.location, "Location");
      const startDate = validateDateString(args.startDate, "Start date");
      const endDate = validateDateString(args.endDate, "End date");
      const id = await ctx.db.insert(
        "conventions",
        withCreateMeta({
          userId: actorId,
          name,
          location,
          imageUrl: args.imageUrl,
          imageStorageId: args.imageStorageId,
          startDate,
          endDate,
        })
      );
      return await ctx.db.get(id);
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("conventions"),
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const { id, userId: _userId, idempotencyKey, ...fields } = args;
    const replay = await idempotentReplay(ctx, idempotencyKey, "conventions.update");
    if (replay.hit) return replay.result as Doc<"conventions"> | null;
    const convention = await ctx.db.get(id);
    if (!convention || convention.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    const newStorageId = fields.imageStorageId ?? undefined;
    const oldStorageId = convention.imageStorageId;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, actorId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, actorId, newStorageId);
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (k === "name") patch.name = sanitizeAndLimit(val as string, MAX_LENGTH.name, "Name");
      else if (k === "location")
        patch.location = sanitizeOptional(val as string, MAX_LENGTH.location, "Location");
      else if (k === "startDate") patch.startDate = validateDateString(val as string, "Start date");
      else if (k === "endDate") patch.endDate = validateDateString(val as string, "End date");
      else if (k === "imageUrl")
        patch.imageUrl = sanitizeOptional(val as string | undefined, MAX_LENGTH.url, "Image URL");
      else if (k === "imageStorageId") patch.imageStorageId = val === null ? undefined : val;
      else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, withUpdateMeta(convention, patch));
    }
    return idempotentRecord(
      ctx,
      idempotencyKey,
      actorId,
      await ctx.db.get(id),
      "conventions.update"
    );
  },
});

export const archiveMany = mutation({
  args: {
    ids: v.array(v.id("conventions")),
    userId: v.optional(v.string()),
    archived: v.boolean(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const replay = await idempotentReplay(ctx, args.idempotencyKey, "conventions.archiveMany");
    if (replay.hit) return;
    for (const id of args.ids) {
      const convention = await ctx.db.get(id);
      if (!convention || convention.userId !== actorId) continue;
      await ctx.db.patch(id, withUpdateMeta(convention, { archived: args.archived }));
    }
    await idempotentRecord(ctx, args.idempotencyKey, actorId, undefined, "conventions.archiveMany");
  },
});

export const removeMany = mutation({
  args: { ids: v.array(v.id("conventions")), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    for (const id of args.ids) {
      const convention = await ctx.db.get(id);
      if (!convention || convention.userId !== actorId) continue;
      await subtractUsageForStorageId(ctx, actorId, convention.imageStorageId);
      const plans = await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_conventionId", (q) => q.eq("conventionId", id))
        .collect();
      for (const p of plans) await ctx.db.delete(p._id);
      const packingItems = await ctx.db
        .query("packingListItems")
        .withIndex("by_conventionId", (q) => q.eq("conventionId", id))
        .collect();
      for (const pi of packingItems) {
        if (pi.workflowItemId) await removeWorkflowItemCascade(ctx, pi.workflowItemId);
        else await ctx.db.delete(pi._id);
      }
      await ctx.db.delete(id);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("conventions"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const convention = await ctx.db.get(args.id);
    if (!convention || convention.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    await subtractUsageForStorageId(ctx, actorId, convention.imageStorageId);
    // Cascade: delete day plans and packing items
    const plans = await ctx.db
      .query("conventionDayPlans")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.id))
      .collect();
    for (const p of plans) await ctx.db.delete(p._id);

    const packingItems = await ctx.db
      .query("packingListItems")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.id))
      .collect();
    for (const pi of packingItems) {
      if (pi.workflowItemId) await removeWorkflowItemCascade(ctx, pi.workflowItemId);
      else await ctx.db.delete(pi._id);
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * A convention's day-by-day plan. Takes no actor argument, so the owner check on
 * the parent convention is written out; it previously returned any plan to anyone.
 */
export const getPlan = query({
  args: { conventionId: v.id("conventions") },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const convention = await ctx.db.get(args.conventionId);
    if (!convention || convention.userId !== actorId) return [];
    return await ctx.db
      .query("conventionDayPlans")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();
  },
});

export const replacePlan = mutation({
  args: {
    userId: v.optional(v.string()),
    conventionId: v.id("conventions"),
    plan: v.array(
      v.object({
        date: v.string(),
        buildId: v.optional(v.id("builds")),
        notes: v.optional(v.string()),
      })
    ),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const replay = await idempotentReplay(ctx, args.idempotencyKey, "conventions.replacePlan");
    if (replay.hit) return replay.result as (Doc<"conventionDayPlans"> | null)[];
    const convention = await ctx.db.get(args.conventionId);
    if (!convention || convention.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    // Delete existing plans
    const existing = await ctx.db
      .query("conventionDayPlans")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();
    for (const p of existing) await ctx.db.delete(p._id);

    // Insert new plans
    const results = [];
    for (let i = 0; i < args.plan.length; i++) {
      const entry = args.plan[i];
      const date = validateDateString(entry.date, `Plan ${i + 1} date`);
      const notes = sanitizeOptional(entry.notes, MAX_LENGTH.notes, `Plan ${i + 1} notes`);
      const id = await ctx.db.insert(
        "conventionDayPlans",
        withCreateMeta({
          userId: actorId,
          conventionId: args.conventionId,
          date,
          buildId: entry.buildId,
          notes,
        })
      );
      results.push(await ctx.db.get(id));
    }
    return idempotentRecord(ctx, args.idempotencyKey, actorId, results, "conventions.replacePlan");
  },
});

/**
 * A convention's packing list. Takes no actor argument, so the owner check on the
 * parent convention is written out; it previously returned any packing list to anyone.
 */
export const getPacking = query({
  args: { conventionId: v.id("conventions") },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const convention = await ctx.db.get(args.conventionId);
    if (!convention || convention.userId !== actorId) return [];
    const items = await ctx.db
      .query("packingListItems")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();
    return await Promise.all(
      items.map(async (item) => ({
        ...item,
        checked: await getPackingWorkflowStatus(ctx, item),
      }))
    );
  },
});

export const updatePackingItem = mutation({
  args: {
    id: v.id("packingListItems"),
    userId: v.optional(v.string()),
    checked: v.optional(v.boolean()),
    label: v.optional(v.string()),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const { id, userId: _userId, ...fields } = args;
    const item = await ctx.db.get(id);
    if (!item || item.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (k === "label") patch.label = sanitizeAndLimit(val as string, MAX_LENGTH.label, "Label");
      else if (k === "date")
        patch.date = val === "" ? undefined : validateDateString(val as string, "Date");
      else if (k === "notes")
        patch.notes = sanitizeOptional(val as string, MAX_LENGTH.notes, "Notes");
      else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, withUpdateMeta(item, patch));
    }
    const updated = await ctx.db.get(id);
    if (updated) {
      await ensurePackingWorkflowItem(ctx, {
        userId: actorId,
        packingListItemId: updated._id,
        conventionId: updated.conventionId,
        buildId: updated.buildId,
        cosplayNodeId: updated.cosplayNodeId,
        label: updated.label,
        notes: updated.notes,
        dueDate: updated.date,
        checked: args.checked ?? updated.checked,
        manual: updated.entryKind === "manual" || (!updated.cosplayNodeId && !updated.buildId),
      });
      if (args.checked !== undefined && updated.workflowItemId) {
        await ctx.db.patch(updated.workflowItemId, {
          status: args.checked ? "done" : "not_started",
        });
      }
      return {
        ...updated,
        checked: args.checked ?? (await getPackingWorkflowStatus(ctx, updated)),
      };
    }
    return updated;
  },
});

export const addManualPackingItem = mutation({
  args: {
    userId: v.optional(v.string()),
    conventionId: v.id("conventions"),
    label: v.string(),
    date: v.optional(v.string()),
    notes: v.optional(v.string()),
    buildId: v.optional(v.id("builds")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const replay = await idempotentReplay(
      ctx,
      args.idempotencyKey,
      "conventions.addManualPackingItem"
    );
    if (replay.hit) return replay.result as Doc<"packingListItems"> | null;
    const convention = await ctx.db.get(args.conventionId);
    if (!convention || convention.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    const label = sanitizeAndLimit(args.label, MAX_LENGTH.label, "Label");
    const date = args.date ? validateDateString(args.date, "Date") : undefined;
    const notes = sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes");
    const id = await ctx.db.insert(
      "packingListItems",
      withCreateMeta({
        userId: actorId,
        conventionId: args.conventionId,
        label,
        date,
        notes,
        buildId: args.buildId,
        checked: false,
        entryKind: "manual",
        sourceKind: "manual",
        sortOrder: 0,
      })
    );
    await ensurePackingWorkflowItem(ctx, {
      userId: actorId,
      packingListItemId: id,
      conventionId: args.conventionId,
      buildId: args.buildId,
      label,
      notes,
      dueDate: date,
      checked: false,
      manual: true,
    });
    return idempotentRecord(
      ctx,
      args.idempotencyKey,
      actorId,
      await ctx.db.get(id),
      "conventions.addManualPackingItem"
    );
  },
});

export const deletePackingItem = mutation({
  args: {
    id: v.id("packingListItems"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }
    if (item.workflowItemId) {
      await removeWorkflowItemCascade(ctx, item.workflowItemId);
      return;
    }
    await ctx.db.delete(args.id);
  },
});

/** Returns conventions with their day plans and packing items — used by mobile sync. */
export const listWithDetails = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();

    return await Promise.all(
      conventions.map(async (c) => {
        const plans = await ctx.db
          .query("conventionDayPlans")
          .withIndex("by_conventionId", (q) => q.eq("conventionId", c._id))
          .collect();
        const packingRaw = await ctx.db
          .query("packingListItems")
          .withIndex("by_conventionId", (q) => q.eq("conventionId", c._id))
          .collect();
        const packing = await Promise.all(
          packingRaw.map(async (item) => ({
            ...item,
            checked: await getPackingWorkflowStatus(ctx, item),
          }))
        );
        return { ...c, plans, packing };
      })
    );
  },
});

export const regeneratePacking = mutation({
  args: {
    userId: v.optional(v.string()),
    conventionId: v.id("conventions"),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const convention = await ctx.db.get(args.conventionId);
    if (!convention || convention.userId !== actorId) {
      throw new Error("Not found or not authorized");
    }

    // Delete only auto-generated items (from builds); keep manual items.
    const existing = await ctx.db
      .query("packingListItems")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();
    for (const item of existing) {
      if (item.entryKind !== "manual") {
        if (item.workflowItemId) {
          await removeWorkflowItemCascade(ctx, item.workflowItemId);
        } else {
          await ctx.db.delete(item._id);
        }
      }
    }

    // Get day plans to generate packing items from linked builds
    const plans = await ctx.db
      .query("conventionDayPlans")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();

    const newItems = [];
    const addedBuildNodes = new Set<string>();

    for (const plan of plans) {
      if (!plan.buildId) continue;
      const buildId = plan.buildId;

      // Step 2c: a build's root nodes are its own cosplayNodes with no parent, sourced from `buildId`.
      const buildNodes = await ctx.db
        .query("cosplayNodes")
        .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
        .collect();
      const links = buildNodes
        .filter((node) => node.parentNodeId === undefined)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((node) => ({ cosplayNodeId: node._id }));

      for (const link of links) {
        const key = `${buildId}:${link.cosplayNodeId}`;
        if (addedBuildNodes.has(key)) continue;
        addedBuildNodes.add(key);

        const node = await ctx.db.get(link.cosplayNodeId);
        if (!node) continue;
        const packingItemId: Doc<"packingListItems">["_id"] = await ctx.db.insert(
          "packingListItems",
          withCreateMeta({
            userId: actorId,
            conventionId: args.conventionId,
            date: plan.date,
            buildId: plan.buildId,
            cosplayNodeId: link.cosplayNodeId,
            label: node.name,
            checked: false,
            entryKind: "generated",
            sourceKind: "workflow",
            sortOrder: newItems.length,
          })
        );
        await ensurePackingWorkflowItem(ctx, {
          userId: actorId,
          packingListItemId: packingItemId,
          conventionId: args.conventionId,
          buildId: plan.buildId,
          cosplayNodeId: link.cosplayNodeId,
          label: `Pack ${node.name}`,
          notes: undefined,
          dueDate: plan.date,
          checked: false,
          manual: false,
        });
        newItems.push(await ctx.db.get(packingItemId));
      }
    }
    return newItems;
  },
});
