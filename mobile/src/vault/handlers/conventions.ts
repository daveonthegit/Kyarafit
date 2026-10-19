import type { VaultDoc } from "../store";
import type {
  LocalMutationCtx,
  LocalMutationHandler,
  LocalQueryCtx,
  LocalQueryHandler,
} from "../types";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  validateDateString,
} from "./lib/validation";
import { ensurePackingWorkflowItem, removeWorkflowItemCascade } from "./workflow";

/**
 * Local port of `convex/conventions.ts`: conventions, their day plans and packing lists.
 *
 * The vault belongs to a single account, so the server's owner checks reduce to "the row exists";
 * idempotency-ledger replay and cloud storage accounting are server-only concerns and are dropped.
 * Return shapes match the server so screens render either source unchanged.
 */

type Ctx = LocalQueryCtx | LocalMutationCtx;

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isConvention(doc: VaultDoc | null): doc is VaultDoc {
  return doc != null && typeof doc.startDate === "string" && typeof doc.endDate === "string";
}

function isPackingItem(doc: VaultDoc | null): doc is VaultDoc {
  return doc != null && typeof doc.conventionId === "string" && typeof doc.label === "string";
}

function getPackingWorkflowStatus(ctx: Ctx, item: VaultDoc): boolean {
  const workflowItemId = str(item.workflowItemId);
  if (!workflowItemId) return item.checked === true;
  const workflowItem = ctx.db.get(workflowItemId);
  if (!workflowItem) return item.checked === true;
  return workflowItem.status === "done";
}

function listConventions(ctx: Ctx): VaultDoc[] {
  return ctx.db
    .query("conventions")
    .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
    .collect();
}

function plansFor(ctx: Ctx, conventionId: string): VaultDoc[] {
  return ctx.db
    .query("conventionDayPlans")
    .withIndex("by_conventionId", (q) => q.eq("conventionId", conventionId))
    .collect();
}

function packingFor(ctx: Ctx, conventionId: string): VaultDoc[] {
  return ctx.db
    .query("packingListItems")
    .withIndex("by_conventionId", (q) => q.eq("conventionId", conventionId))
    .collect();
}

function requireConvention(ctx: Ctx, id: unknown): VaultDoc {
  const convention = typeof id === "string" ? ctx.db.get(id) : null;
  if (!isConvention(convention)) throw new Error("Not found or not authorized");
  return convention;
}

/** Day plans and packing items go with their convention (workflow-backed items cascade). */
function removeConventionCascade(ctx: LocalMutationCtx, id: string): void {
  for (const plan of plansFor(ctx, id)) ctx.db.delete(plan._id);
  for (const item of packingFor(ctx, id)) {
    const workflowItemId = str(item.workflowItemId);
    if (workflowItemId && ctx.db.get(workflowItemId)) {
      removeWorkflowItemCascade(ctx, workflowItemId);
    }
    // The cascade removes the packing item through its attachment; delete it directly otherwise.
    if (ctx.db.get(item._id)) ctx.db.delete(item._id);
  }
  ctx.db.delete(id);
}

export const queries: Record<string, LocalQueryHandler> = {
  "conventions:list": (ctx) => listConventions(ctx),

  "conventions:get": (ctx, args) => {
    const convention = typeof args.id === "string" ? ctx.db.get(args.id) : null;
    return isConvention(convention) ? convention : null;
  },

  "conventions:getEventForBuild": (ctx, args) => {
    const notArchived = listConventions(ctx).filter((c) => c.archived !== true);
    const withPlans: { name: string; startDate: string }[] = [];
    for (const c of notArchived) {
      const hasBuild = plansFor(ctx, c._id).some((p) => p.buildId === args.buildId);
      if (hasBuild) withPlans.push({ name: String(c.name), startDate: String(c.startDate) });
    }
    if (withPlans.length === 0) return null;
    withPlans.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return withPlans[0];
  },

  "conventions:listUpcomingWithPlanCounts": (ctx, args) => {
    const today = new Date(ctx.now).toISOString().slice(0, 10);
    const upcoming = listConventions(ctx)
      .filter((c) => c.archived !== true && String(c.endDate) >= today)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    const limit = typeof args.limit === "number" ? args.limit : undefined;
    const limited = limit ? upcoming.slice(0, limit) : upcoming;
    return limited.map((c) => {
      const plans = plansFor(ctx, c._id);
      const outfitCount = new Set(plans.filter((p) => p.buildId != null).map((p) => p.buildId))
        .size;
      return { convention: c, outfitCount };
    });
  },

  "conventions:getPlan": (ctx, args) => {
    const convention = typeof args.conventionId === "string" ? ctx.db.get(args.conventionId) : null;
    if (!isConvention(convention)) return [];
    return plansFor(ctx, convention._id);
  },

  "conventions:getPacking": (ctx, args) => {
    const convention = typeof args.conventionId === "string" ? ctx.db.get(args.conventionId) : null;
    if (!isConvention(convention)) return [];
    return packingFor(ctx, convention._id).map((item) => ({
      ...item,
      checked: getPackingWorkflowStatus(ctx, item),
    }));
  },

  "conventions:listWithDetails": (ctx) =>
    listConventions(ctx).map((c) => ({
      ...c,
      plans: plansFor(ctx, c._id),
      packing: packingFor(ctx, c._id).map((item) => ({
        ...item,
        checked: getPackingWorkflowStatus(ctx, item),
      })),
    })),
};

export const mutations: Record<string, LocalMutationHandler> = {
  "conventions:create": (ctx, args) => {
    const name = sanitizeAndLimit(str(args.name), MAX_LENGTH.name, "Name");
    const location = sanitizeOptional(str(args.location), MAX_LENGTH.location, "Location");
    const startDate = validateDateString(String(args.startDate ?? ""), "Start date");
    const endDate = validateDateString(String(args.endDate ?? ""), "End date");
    const id = ctx.db.insert(
      "conventions",
      withCreateMeta(
        {
          userId: ctx.userId,
          name,
          location,
          imageUrl: str(args.imageUrl),
          imageStorageId: str(args.imageStorageId),
          startDate,
          endDate,
        },
        ctx.now
      )
    );
    return ctx.db.get(id);
  },

  "conventions:update": (ctx, args) => {
    const {
      id,
      userId: _userId,
      idempotencyKey: _key,
      ...fields
    } = args as Record<string, unknown> & { id?: unknown };
    const convention = requireConvention(ctx, id);
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (k === "name") patch.name = sanitizeAndLimit(val as string, MAX_LENGTH.name, "Name");
      else if (k === "location")
        patch.location = sanitizeOptional(val as string, MAX_LENGTH.location, "Location");
      else if (k === "startDate") patch.startDate = validateDateString(val as string, "Start date");
      else if (k === "endDate") patch.endDate = validateDateString(val as string, "End date");
      else if (k === "imageUrl")
        patch.imageUrl = sanitizeOptional(
          (val ?? undefined) as string | undefined,
          MAX_LENGTH.url,
          "Image URL"
        );
      else if (k === "imageStorageId") patch.imageStorageId = val === null ? undefined : val;
      else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      ctx.db.patch(
        convention._id,
        withUpdateMeta(
          convention as { version?: number; fieldUpdatedAt?: Record<string, number> },
          patch,
          ctx.now
        )
      );
    }
    return ctx.db.get(convention._id);
  },

  "conventions:archiveMany": (ctx, args) => {
    const ids = Array.isArray(args.ids) ? args.ids : [];
    for (const id of ids) {
      const convention = typeof id === "string" ? ctx.db.get(id) : null;
      if (!isConvention(convention)) continue;
      ctx.db.patch(
        convention._id,
        withUpdateMeta(
          convention as { version?: number; fieldUpdatedAt?: Record<string, number> },
          { archived: args.archived === true },
          ctx.now
        )
      );
    }
    return null;
  },

  "conventions:removeMany": (ctx, args) => {
    const ids = Array.isArray(args.ids) ? args.ids : [];
    for (const id of ids) {
      const convention = typeof id === "string" ? ctx.db.get(id) : null;
      if (!isConvention(convention)) continue;
      removeConventionCascade(ctx, convention._id);
    }
    return null;
  },

  "conventions:remove": (ctx, args) => {
    const convention = requireConvention(ctx, args.id);
    removeConventionCascade(ctx, convention._id);
    return null;
  },

  "conventions:replacePlan": (ctx, args) => {
    const convention = requireConvention(ctx, args.conventionId);
    const plan = Array.isArray(args.plan) ? (args.plan as Record<string, unknown>[]) : [];
    for (const p of plansFor(ctx, convention._id)) ctx.db.delete(p._id);
    const results: (VaultDoc | null)[] = [];
    for (let i = 0; i < plan.length; i++) {
      const entry = plan[i] ?? {};
      const date = validateDateString(String(entry.date ?? ""), `Plan ${i + 1} date`);
      const notes = sanitizeOptional(str(entry.notes), MAX_LENGTH.notes, `Plan ${i + 1} notes`);
      const id = ctx.db.insert(
        "conventionDayPlans",
        withCreateMeta(
          {
            userId: ctx.userId,
            conventionId: convention._id,
            date,
            buildId: str(entry.buildId),
            notes,
          },
          ctx.now
        )
      );
      results.push(ctx.db.get(id));
    }
    return results;
  },

  "conventions:updatePackingItem": (ctx, args) => {
    const item = typeof args.id === "string" ? ctx.db.get(args.id) : null;
    if (!isPackingItem(item)) throw new Error("Not found or not authorized");
    const { id: _id, userId: _userId, idempotencyKey: _key, ...fields } = args;
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
      ctx.db.patch(
        item._id,
        withUpdateMeta(
          item as { version?: number; fieldUpdatedAt?: Record<string, number> },
          patch,
          ctx.now
        )
      );
    }
    const checkedArg = typeof args.checked === "boolean" ? args.checked : undefined;
    const updated = ctx.db.get(item._id);
    if (!updated) return updated;
    ensurePackingWorkflowItem(ctx, {
      userId: ctx.userId,
      packingListItemId: updated._id,
      conventionId: String(updated.conventionId),
      buildId: str(updated.buildId),
      cosplayNodeId: str(updated.cosplayNodeId),
      label: String(updated.label),
      notes: str(updated.notes),
      dueDate: str(updated.date),
      checked: checkedArg ?? updated.checked === true,
      manual: updated.entryKind === "manual" || (!updated.cosplayNodeId && !updated.buildId),
    });
    const after = ctx.db.get(item._id) ?? updated;
    const workflowItemId = str(after.workflowItemId);
    if (checkedArg !== undefined && workflowItemId && ctx.db.get(workflowItemId)) {
      ctx.db.patch(workflowItemId, { status: checkedArg ? "done" : "not_started" });
    }
    return { ...after, checked: checkedArg ?? getPackingWorkflowStatus(ctx, after) };
  },

  "conventions:addManualPackingItem": (ctx, args) => {
    const convention = requireConvention(ctx, args.conventionId);
    const label = sanitizeAndLimit(str(args.label), MAX_LENGTH.label, "Label");
    const date = args.date ? validateDateString(String(args.date), "Date") : undefined;
    const notes = sanitizeOptional(str(args.notes), MAX_LENGTH.notes, "Notes");
    const buildId = str(args.buildId);
    const id = ctx.db.insert(
      "packingListItems",
      withCreateMeta(
        {
          userId: ctx.userId,
          conventionId: convention._id,
          label,
          date,
          notes,
          buildId,
          checked: false,
          entryKind: "manual",
          sourceKind: "manual",
          sortOrder: 0,
        },
        ctx.now
      )
    );
    ensurePackingWorkflowItem(ctx, {
      userId: ctx.userId,
      packingListItemId: id,
      conventionId: convention._id,
      buildId,
      label,
      notes,
      dueDate: date,
      checked: false,
      manual: true,
    });
    return ctx.db.get(id);
  },

  "conventions:deletePackingItem": (ctx, args) => {
    const item = typeof args.id === "string" ? ctx.db.get(args.id) : null;
    if (!isPackingItem(item)) throw new Error("Not found or not authorized");
    const workflowItemId = str(item.workflowItemId);
    if (workflowItemId && ctx.db.get(workflowItemId)) {
      removeWorkflowItemCascade(ctx, workflowItemId);
      if (ctx.db.get(item._id)) ctx.db.delete(item._id);
      return null;
    }
    ctx.db.delete(item._id);
    return null;
  },

  "conventions:regeneratePacking": (ctx, args) => {
    const convention = requireConvention(ctx, args.conventionId);
    const conventionId = convention._id;

    // Delete only auto-generated items (from builds); keep manual items.
    for (const item of packingFor(ctx, conventionId)) {
      if (item.entryKind === "manual") continue;
      const workflowItemId = str(item.workflowItemId);
      if (workflowItemId && ctx.db.get(workflowItemId)) {
        removeWorkflowItemCascade(ctx, workflowItemId);
      }
      if (ctx.db.get(item._id)) ctx.db.delete(item._id);
    }

    const newItems: (VaultDoc | null)[] = [];
    const addedBuildNodes = new Set<string>();

    for (const plan of plansFor(ctx, conventionId)) {
      const buildId = str(plan.buildId);
      if (!buildId) continue;
      // A build's root nodes are its own cosplayNodes with no parent, ordered by sortOrder.
      const links = ctx.db
        .query("cosplayNodes")
        .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
        .collect()
        .filter((node) => node.parentNodeId === undefined)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
        .map((node) => ({ cosplayNodeId: node._id }));

      for (const link of links) {
        const key = `${buildId}:${link.cosplayNodeId}`;
        if (addedBuildNodes.has(key)) continue;
        addedBuildNodes.add(key);

        const node = ctx.db.get(link.cosplayNodeId);
        if (!node) continue;
        const date = str(plan.date);
        const packingItemId = ctx.db.insert(
          "packingListItems",
          withCreateMeta(
            {
              userId: ctx.userId,
              conventionId,
              date,
              buildId,
              cosplayNodeId: link.cosplayNodeId,
              label: String(node.name),
              checked: false,
              entryKind: "generated",
              sourceKind: "workflow",
              sortOrder: newItems.length,
            },
            ctx.now
          )
        );
        ensurePackingWorkflowItem(ctx, {
          userId: ctx.userId,
          packingListItemId: packingItemId,
          conventionId,
          buildId,
          cosplayNodeId: link.cosplayNodeId,
          label: `Pack ${String(node.name)}`,
          notes: undefined,
          dueDate: date,
          checked: false,
          manual: false,
        });
        newItems.push(ctx.db.get(packingItemId));
      }
    }
    return newItems;
  },
};
