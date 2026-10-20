import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./lib/guardedMutation";
import { requireIdentity } from "./lib/authz";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { prepareBackfillRow, validateBackfillBatch } from "./lib/backfillValidation";
import { deleteOwnedBuild } from "./builds";
import { deleteOwnedConvention } from "./conventions";

/**
 * Explicit publication of vault rows (DATA_AND_SYNC.md §6.4).
 *
 * Personal data lives in the device vault and, for Kyarafit Cloud, its row replica
 * (`convex/replica.ts`). The Convex domain tables are PUBLISHED PROJECTIONS of that data: a row is
 * written here only when its owner takes an explicit social action that needs a server copy
 * (inviting a collaborator, adding a build or convention to a group). Nothing flows back from these
 * tables into the vault, so they are never a second editable copy of personal rows.
 *
 * Publishing is free for every tier (social actions are not paid features). Content is validated
 * with the same per-table shapes as the legacy upgrade backfill; social settings already on the
 * server copy (visibility, share token, group) are managed by their own APIs and never overwritten
 * by a re-publish.
 */

type Publishable = "builds" | "conventions";
type PublishedRow = { _id: string; userId?: string; deletedAt?: number } & Record<string, unknown>;
interface LooseDb {
  get(id: string): Promise<PublishedRow | null>;
  query(table: Publishable): {
    withIndex(
      index: "by_userId_clientId",
      range: (q: {
        eq(field: string, value: unknown): { eq(field: string, value: unknown): unknown };
      }) => unknown
    ): { unique(): Promise<PublishedRow | null> };
  };
  insert(table: Publishable, value: Record<string, unknown>): Promise<string>;
  patch(id: string, value: Record<string, unknown>): Promise<void>;
}

export const publish = mutation({
  args: {
    table: v.union(v.literal("builds"), v.literal("conventions")),
    /** The vault row id (`local:…`, or a legacy server id for rows first pulled from the cloud). */
    clientId: v.string(),
    doc: v.record(v.string(), v.any()),
  },
  handler: async (ctx, { table, clientId, doc }): Promise<{ id: string }> => {
    const userId = await requireIdentity(ctx);
    const [row] = validateBackfillBatch(table, [{ ...doc, clientId }]);
    if (!row) throw new Error("Nothing to publish");
    const { clientId: _clientId, ...fields } = await prepareBackfillRow(ctx, table, row, userId);
    const db = ctx.db as unknown as LooseDb;

    // A legacy row's vault id IS its server id; otherwise the projection is keyed by clientId.
    const serverId = ctx.db.normalizeId(table, clientId);
    const existing =
      (serverId ? await db.get(serverId) : null) ??
      (await db
        .query(table)
        .withIndex("by_userId_clientId", (q) => q.eq("userId", userId).eq("clientId", clientId))
        .unique());
    if (existing) {
      if (existing.userId !== userId) throw new Error("Not found or not authorized");
      if (existing.deletedAt !== undefined) throw new Error("This copy was removed");
      // Social settings belong to the published copy, not to the vault.
      delete fields.visibility;
      const optional = table === "builds"
        ? ["character", "notes", "imageUrl", "imageStorageId", "imageRef", "imageFocalX", "imageFocalY", "budgetCents", "targetDate", "manualProgressPercent"]
        : ["location", "imageUrl", "imageStorageId", "imageRef", "archived"];
      for (const field of optional) if (!(field in fields)) fields[field] = undefined;
      await db.patch(
        existing._id,
        withUpdateMeta(
          existing as { version?: number; fieldUpdatedAt?: Record<string, number> },
          fields
        )
      );
      return { id: existing._id };
    }
    const id = await db.insert(table, withCreateMeta({ ...fields, clientId, userId }));
    return { id: id as Id<Publishable> };
  },
});

/**
 * Remove a published copy whose vault row was deleted. Idempotent: a copy that is already gone (or
 * was never this account's) reports `removed: false` instead of failing, so a device can retry a
 * queued removal safely.
 */
export const unpublish = mutation({
  args: {
    table: v.union(v.literal("builds"), v.literal("conventions")),
    clientId: v.string(),
  },
  handler: async (ctx, { table, clientId }): Promise<{ removed: boolean }> => {
    const userId = await requireIdentity(ctx);
    return { removed: await removePublishedProjection(ctx, userId, table, clientId) };
  },
});

export async function removePublishedProjection(
  ctx: MutationCtx, userId: string, table: string, clientId: string
): Promise<boolean> {
  if (table === "builds") {
    const id = ctx.db.normalizeId("builds", clientId);
    const build = (id ? await ctx.db.get(id) : null) ?? await ctx.db.query("builds")
      .withIndex("by_userId_clientId", q => q.eq("userId", userId).eq("clientId", clientId)).unique();
    if (!build || build.userId !== userId || build.deletedAt !== undefined) return false;
    await deleteOwnedBuild(ctx, userId, build);
    return true;
  }
  if (table === "conventions") {
    const id = ctx.db.normalizeId("conventions", clientId);
    const convention = (id ? await ctx.db.get(id) : null) ?? await ctx.db.query("conventions")
      .withIndex("by_userId_clientId", q => q.eq("userId", userId).eq("clientId", clientId)).unique();
    if (!convention || convention.userId !== userId || convention.deletedAt !== undefined) return false;
    await deleteOwnedConvention(ctx, userId, convention);
    return true;
  }
  return false;
}
