import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { withCreateMeta } from "./lib/syncMeta";
import { selectBackfillRows } from "@kyarafit/design-system/domain/tierTransition";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";

/**
 * Tier-transition backend (DATA_AND_SYNC.md §10, REQ-D95/D96/D97).
 *
 * - Upgrade backfill (this file): when a user becomes paid, the client pushes its local-first rows up
 *   to the cloud, deduped across devices by `clientId` so a row already synced from another device is
 *   never duplicated.
 * - Downgrade retention (see `purgeDowngradedCloudData`): after grace + retention, the CLOUD copies of
 *   a downgraded user's local-first data are purged — never local on-device data.
 *
 * THE CLOUD-MIRROR / LOCAL BOUNDARY: everything here operates on Convex tables, which are the CLOUD
 * mirror. The client's on-device store is a SEPARATE database (wa-sqlite / SQLite) that Convex code
 * cannot reach. That boundary is what structurally guarantees "local data is never deleted by tier
 * logic" (REQ-D96) — there is no code path from here to the device.
 */

/**
 * The user-owned, local-first tables that make up the CLOUD MIRROR. This is the exact set that
 * `sync.listChangedSince` pulls, that upgrade backfill pushes into, and that the downgrade-retention
 * cron may purge. Every one of these has a `by_userId` index.
 */
export const LOCAL_FIRST_TABLES = [
  "closetItems",
  "cosplayNodes",
  "builds",
  "buildTasks",
  "workflowItems",
  "workflowAttachments",
  "workflowDependencies",
  "conventions",
  "conventionDayPlans",
  "packingListItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
] as const;

export type LocalFirstTable = (typeof LOCAL_FIRST_TABLES)[number];

function isLocalFirstTable(table: string): table is LocalFirstTable {
  return (LOCAL_FIRST_TABLES as readonly string[]).includes(table);
}

/**
 * Loose view of the writer for the generic, table-name-parameterized reads/writes below. Every
 * local-first table shares the `by_userId` index + sync-metadata shape, so a single generic path is
 * both correct and far less error-prone than 13 hand-written branches. Casts are localized here.
 */
type AnyRow = Record<string, unknown> & { _id: string; clientId?: string };
interface LooseDb {
  query: (table: string) => {
    withIndex: (
      index: string,
      range: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
    ) => { collect: () => Promise<AnyRow[]> };
  };
  insert: (table: string, value: Record<string, unknown>) => Promise<string>;
  delete: (id: string) => Promise<void>;
}

function looseDb(ctx: MutationCtx | QueryCtx): LooseDb {
  return ctx.db as unknown as LooseDb;
}

/** All CLOUD rows a user owns in one local-first table (by the `by_userId` index). */
async function userRowsInTable(
  ctx: MutationCtx | QueryCtx,
  table: LocalFirstTable,
  userId: string
): Promise<AnyRow[]> {
  return looseDb(ctx)
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

async function resolvePaidUserId(ctx: MutationCtx | QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("You must be signed in to back up your data.");
  }
  const userId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", userId))
    .unique();
  // REQ-D95: backfill is a paid, cloud feature — only runs for a user who is (newly) paid.
  if (!isPaidConvexTier(user?.tier)) {
    throw new Error("Cloud backup requires an upgrade.");
  }
  return userId;
}

/**
 * REQ-D95 — upgrade backfill. Push a chunk of the caller's local-first rows for one table into the
 * cloud, deduped across devices by `clientId`. Idempotent: a row whose `clientId` is already present
 * in the cloud (from this or another device) is skipped, so re-running never creates a second copy.
 *
 * Returns a per-chunk progress signal the client can accumulate into an overall done/total bar:
 * `{ inserted, skipped, total, cloudCount }` where `cloudCount` is the number of rows this table now
 * holds in the cloud for the user.
 *
 * Rows must be schema-shaped for `table` (the same shape the client's normal create mutations send);
 * `userId` is always forced to the authenticated caller. Rows without a `clientId` are left to the
 * normal sync push (they can't be safely deduped across devices) and counted as skipped.
 */
export const backfillRows = mutation({
  args: {
    table: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    if (!isLocalFirstTable(args.table)) {
      throw new Error(`Unknown local-first table: ${args.table}`);
    }
    const table = args.table;
    const userId = await resolvePaidUserId(ctx);

    const existing = await userRowsInTable(ctx, table, userId);
    const serverClientIds = existing
      .map((row) => row.clientId)
      .filter((id): id is string => typeof id === "string");

    const candidates = args.rows.filter(
      (row): row is Record<string, unknown> & { clientId: string } =>
        typeof (row as { clientId?: unknown }).clientId === "string"
    );
    const toInsert = selectBackfillRows(candidates, serverClientIds);

    const now = Date.now();
    for (const row of toInsert) {
      // Strip system fields; force ownership to the authenticated caller; stamp sync metadata.
      const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...rest } = row;
      void _ignoredId;
      void _ignoredCreationTime;
      await looseDb(ctx).insert(table, withCreateMeta({ ...rest, userId }, now));
    }

    return {
      table,
      total: args.rows.length,
      inserted: toInsert.length,
      skipped: args.rows.length - toInsert.length,
      cloudCount: existing.length + toInsert.length,
    };
  },
});

/**
 * Minimal progress signal for the upgrade backfill: the number of the caller's rows already in the
 * cloud per local-first table (the "done" side; the client supplies its local "total"). Paid-only.
 */
export const backfillStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await resolvePaidUserId(ctx);
    const counts: Record<string, number> = {};
    for (const table of LOCAL_FIRST_TABLES) {
      const rows = await userRowsInTable(ctx, table, userId);
      counts[table] = rows.length;
    }
    return counts;
  },
});
