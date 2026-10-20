import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./lib/guardedMutation";
import { requireIdentity } from "./lib/authz";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { prepareBackfillRow, validateBackfillBatch } from "./lib/backfillValidation";

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
