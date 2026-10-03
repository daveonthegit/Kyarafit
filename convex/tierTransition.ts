import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { withCreateMeta } from "./lib/syncMeta";
import {
  prepareBackfillRow,
  resolveBackfillId,
  validateBackfillBatch,
  type BackfillRow,
} from "./lib/backfillValidation";
import {
  DOWNGRADE_RETENTION_MS,
  isCloudPurgeable,
  selectBackfillRows,
} from "@kyarafit/design-system/domain/tierTransition";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { hasPaidAccess } from "@kyarafit/design-system/domain/accessPolicy";

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
  // REQ-D95: backfill is a paid, cloud feature — only runs for a user who is (newly) paid. Owners
  // count as paid regardless of tier (role read from the DB row, never client input).
  if (!hasPaidAccess(user?.tier, user?.role)) {
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
 * Rows are bounded and validated per table; ownership, publication and sync metadata are derived
 * server-side. Related ids may be server ids or actor-scoped clientIds from earlier chunks. Same-
 * table parents in this chunk are inserted first; cross-table dependencies must already exist.
 * Rows without a `clientId` are left to normal sync push and counted as skipped.
 * Cloud media is fail-closed at the S4 ownership/quota integration seam in backfillValidation.ts.
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

    const candidates = validateBackfillBatch(table, args.rows);
    const existing = await userRowsInTable(ctx, table, userId);
    const serverClientIds = existing
      .map((row) => row.clientId)
      .filter((id): id is string => typeof id === "string");

    // selectBackfillRows handles prior chunks/devices; this map also dedupes within the chunk.
    const pending = new Map<string, BackfillRow>();
    for (const row of selectBackfillRows(candidates, serverClientIds))
      if (!pending.has(row.clientId)) pending.set(row.clientId, row);
    const insertedIds = new Map<string, string>();
    const visiting = new Set<string>();
    const now = Date.now();
    async function insertRow(row: BackfillRow): Promise<string> {
      const inserted = insertedIds.get(row.clientId);
      if (inserted) return inserted;
      if (visiting.has(row.clientId)) throw new Error("Cyclic backfill relationship");
      visiting.add(row.clientId);
      const prepared = await prepareBackfillRow(ctx, table, row, userId, async (target, value) => {
        // Never shadow an actual server id with client input, including a foreign server id.
        if (target === table && !ctx.db.normalizeId(target, value)) {
          const dependency = pending.get(value);
          if (dependency) return await insertRow(dependency);
        }
        return await resolveBackfillId(ctx, target, value, userId);
      });
      const id = await looseDb(ctx).insert(table, withCreateMeta({ ...prepared, userId }, now));
      insertedIds.set(row.clientId, id);
      visiting.delete(row.clientId);
      return id;
    }
    // One Convex transaction: a bad relationship/media seam failure rolls back the whole chunk.
    for (const row of pending.values()) await insertRow(row);
    // Additive response contract: installed clients can ignore ids; newer clients remap local
    // references without modifying local records. Include deduped rows for lost-response retries.
    const ids: Array<{ clientId: string; id: string }> = [];
    const mapped = new Set<string>();
    for (const row of candidates) {
      if (mapped.has(row.clientId)) continue;
      const id =
        insertedIds.get(row.clientId) ??
        existing.find((existingRow) => existingRow.clientId === row.clientId)?._id;
      if (id) ids.push({ clientId: row.clientId, id });
      mapped.add(row.clientId);
    }

    return {
      table,
      total: args.rows.length,
      inserted: insertedIds.size,
      skipped: args.rows.length - insertedIds.size,
      cloudCount: existing.length + insertedIds.size,
      ids,
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

/**
 * Delete every CLOUD row a user owns across the local-first tables. Operates only on Convex tables
 * (the cloud mirror); it cannot and does not reach the client's on-device store. Returns the number
 * of cloud rows removed.
 */
async function purgeUserCloudMirror(ctx: MutationCtx, userId: string): Promise<number> {
  let deleted = 0;
  for (const table of LOCAL_FIRST_TABLES) {
    const rows = await userRowsInTable(ctx, table, userId);
    for (const row of rows) {
      await looseDb(ctx).delete(row._id);
      deleted += 1;
    }
  }
  return deleted;
}

/**
 * REQ-D96/D97 — downgrade retention cron. Purges the CLOUD copies of local-first data for users who
 * downgraded paid→free and have stayed free past the full retention window (grace + freeze + the rest
 * of {@link DOWNGRADE_RETENTION_MS}). Registered daily in `convex/crons.ts`.
 *
 * SAFETY / SELECTION PREDICATE — a user is purged only when ALL hold:
 *   1. `downgradedAt` is set and `now - downgradedAt >= DOWNGRADE_RETENTION_MS` (isCloudPurgeable) —
 *      i.e. strictly past grace AND past freeze. Users in grace or freeze are never selected.
 *   2. Their current tier is still FREE (a re-subscribe clears `downgradedAt` and sets tier back to
 *      paid via `users.setTier`, so re-upgrading before the window elapses cancels the purge).
 *   3. `cloudPurgedAt` is unset — makes the cron idempotent; an already-purged user is skipped, so a
 *      second run deletes nothing.
 * After purging, `cloudPurgedAt` is stamped and `downgradedAt` cleared so the user drops out of the
 * candidate index.
 *
 * NEVER DELETES LOCAL DATA: this only touches Convex tables (the cloud mirror). The device store is a
 * separate database Convex cannot reach — the invariant is structural, not a runtime check.
 *
 * Guards: bounded by `limit` per run; `dryRun` reports candidates + would-be deletions without
 * mutating anything; `now` is injectable for deterministic tests (the cron passes none → Date.now()).
 */
export const purgeDowngradedCloudData = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    const dryRun = args.dryRun ?? false;
    const cutoff = now - DOWNGRADE_RETENTION_MS;

    // Coarse candidate scan via index: downgraded users whose downgrade is at/older than the cutoff.
    const candidates = await ctx.db
      .query("users")
      .withIndex("by_downgradedAt", (q) => q.gt("downgradedAt", 0).lte("downgradedAt", cutoff))
      .take(limit);

    let usersPurged = 0;
    let rowsDeleted = 0;
    const purgedUserIds: string[] = [];

    for (const user of candidates) {
      // Defense in depth: re-verify each guard against the authoritative domain predicate + fields.
      if (!isCloudPurgeable(user.downgradedAt, now)) continue;
      if (normalizeConvexTier(user.tier) !== "FREE") continue;
      if (user.cloudPurgedAt != null) continue;

      if (dryRun) {
        rowsDeleted += await countUserCloudMirror(ctx, user.externalId);
        usersPurged += 1;
        purgedUserIds.push(user.externalId);
        continue;
      }

      rowsDeleted += await purgeUserCloudMirror(ctx, user.externalId);
      await ctx.db.patch(user._id, { cloudPurgedAt: now, downgradedAt: undefined });
      usersPurged += 1;
      purgedUserIds.push(user.externalId);
    }

    return { usersPurged, rowsDeleted, dryRun, purgedUserIds };
  },
});

/** Count (without deleting) a user's cloud-mirror rows — used by the cron's dryRun mode. */
async function countUserCloudMirror(ctx: MutationCtx, userId: string): Promise<number> {
  let total = 0;
  for (const table of LOCAL_FIRST_TABLES) {
    total += (await userRowsInTable(ctx, table, userId)).length;
  }
  return total;
}
