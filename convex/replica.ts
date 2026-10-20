import { v } from "convex/values";
import { query } from "./_generated/server";
import { mutation, internalMutation } from "./lib/guardedMutation";
import {
  REPLICA_MAX_OP_BYTES,
  REPLICA_MAX_PULL_ROWS,
  REPLICA_MAX_PUSH_OPS,
  REPLICA_RETENTION_MS,
  isReplicaTable,
  type ReplicaConflict,
  type ReplicaConflictKind,
  type ReplicaPullResult,
  type ReplicaPushResult,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { ReplicaWriter, assertProtocol, loadHead, requireReplicaActor } from "./lib/replicaStore";
import { assertCanAttachStorage } from "./lib/storageOwnership";
import { makeFunctionReference } from "convex/server";

/**
 * Managed sync (Kyarafit Cloud): a narrow per-account row replica of the device vault.
 *
 * Contract (DATA_AND_SYNC.md §6):
 * - Devices replicate ROW STATE, not commands: each op is a field patch (`put`) or a `delete` for
 *   one vault row, keyed by the row's client-minted id. No server ids, no id map, no replay of
 *   domain mutations. The Convex domain tables (`builds`, …) are not written here: they are
 *   published projections (`convex/publications.ts`).
 * - Every applied op takes the next per-account `rev`. Pull pages over `by_user_rev`, so a cursor
 *   always acknowledges a complete prefix; a re-edited row simply moves to a higher rev.
 * - Conflicts are per field, in server-arrival order, and delete wins. Every losing value is kept in
 *   `replicaConflicts` and streamed to devices ("changes that didn't apply").
 * - Rows orphaned by a delete on another device are repaired server-side (Recovered build,
 *   unlink or remove), per `REPLICA_LINK_RULES`.
 * - Idempotent: `opId` is deduped per account for `REPLICA_RETENTION_MS`. Tombstones live as long;
 *   a device whose cursor is older than purged history is told to resnapshot.
 * - Actor and entitlement come from the session; the vault subject must match it.
 */

const opValidator = v.object({
  opId: v.string(),
  table: v.string(),
  rowId: v.string(),
  kind: v.union(v.literal("put"), v.literal("delete")),
  fields: v.optional(v.record(v.string(), v.any())),
  baseRev: v.number(),
});

export const push = mutation({
  args: {
    protocol: v.number(),
    subject: v.string(),
    deviceId: v.string(),
    ops: v.array(opValidator),
    after: v.optional(v.number()),
    generation: v.optional(v.string()),
  },
  handler: async (ctx, { protocol, subject, deviceId, ops, after = 0, generation = "initial" }): Promise<ReplicaPushResult> => {
    assertProtocol(protocol);
    if (ops.length > REPLICA_MAX_PUSH_OPS) throw new Error("Too many changes in one sync batch");
    if (!deviceId || deviceId.length > 128) throw new Error("Invalid device");
    const userId = await requireReplicaActor(ctx, subject);
    for (const op of ops) {
      if (!isReplicaTable(op.table)) throw new Error(`Not a synced table: ${op.table}`);
      if (!op.rowId || op.rowId.length > 256 || !op.opId || op.opId.length > 256)
        throw new Error("Invalid change id");
      if (op.fields && JSON.stringify(op.fields).length > REPLICA_MAX_OP_BYTES)
        throw new Error("Change too large to sync");
    }

    const current = await loadHead(ctx, userId);
    if (after < (current?.floorRev ?? 0) || generation !== (current?.generation ?? "initial"))
      return { outcomes: [], head: current?.rev ?? 0, resnapshot: true };
    const writer = await ReplicaWriter.open(ctx, userId);
    const outcomes: ReplicaPushResult["outcomes"] = [];
    const now = Date.now();
    for (const op of ops) {
      const seen = await ctx.db
        .query("replicaOps")
        .withIndex("by_user_op", (q) => q.eq("userId", userId).eq("opId", op.opId))
        .unique();
      if (seen) {
        outcomes.push({ opId: op.opId, status: seen.status, rev: seen.rev });
        continue;
      }
      const outcome = await writer.apply(op, deviceId);
      await ctx.db.insert("replicaOps", { userId, opId: op.opId, ...outcome, createdAt: now });
      outcomes.push({ opId: op.opId, ...outcome });
    }
    await writer.enforceIntegrity();
    const head = await writer.finish();
    return { outcomes, head };
  },
});

export const pull = query({
  args: {
    protocol: v.number(),
    subject: v.string(),
    after: v.number(),
    limit: v.optional(v.number()),
    snapshot: v.optional(v.boolean()),
  },
  handler: async (ctx, { protocol, subject, after, limit, snapshot }): Promise<ReplicaPullResult> => {
    assertProtocol(protocol);
    const userId = await requireReplicaActor(ctx, subject);
    const head = await loadHead(ctx, userId);
    if (!snapshot && after > 0 && after < (head?.floorRev ?? 0)) {
      return { rows: [], conflicts: [], cursor: after, hasMore: false, resnapshot: true, generation: head?.generation ?? "initial" };
    }
    const take = Math.min(
      Math.max(Math.floor(limit ?? REPLICA_MAX_PULL_ROWS), 1),
      REPLICA_MAX_PULL_ROWS
    );
    let rows = await ctx.db
      .query("replicaRows")
      .withIndex("by_user_rev", (q) => q.eq("userId", userId).gt("rev", after))
      .order("asc")
      .take(take);
    let hasMore = rows.length === take;
    // A complete prefix: when the page is short, everything up to the head has been seen (some
    // revs, such as a rejected edit or a dismissal, change no row).
    let cursor = hasMore ? rows[rows.length - 1].rev : Math.max(after, head?.rev ?? 0);
    let conflicts = await ctx.db
      .query("replicaConflicts")
      .withIndex("by_user_rev", (q) => q.eq("userId", userId).gt("rev", after).lte("rev", cursor))
      .order("asc")
      .take(take + 1);
    if (conflicts.length > take) {
      conflicts = conflicts.slice(0, take);
      cursor = conflicts[conflicts.length - 1].rev;
      rows = rows.filter((row) => row.rev <= cursor);
      hasMore = true;
    }
    return {
      rows: rows.map(({ table, rowId, doc, deleted, rev }) =>
        deleted ? { table, rowId, deleted, rev } : { table, rowId, doc, deleted, rev }
      ),
      conflicts: conflicts.map((row): ReplicaConflict => ({
        id: row._id,
        table: row.table,
        rowId: row.rowId,
        kind: row.kind as ReplicaConflictKind,
        lost: row.lost as Record<string, unknown>,
        rev: row.rev,
        createdAt: row.createdAt,
        dismissed: row.dismissed,
      })),
      cursor,
      hasMore,
      resnapshot: false,
      generation: head?.generation ?? "initial",
    };
  },
});

/** Dismiss (or mark restored) "changes that didn't apply" on every device. */
export const dismissConflicts = mutation({
  args: { protocol: v.number(), subject: v.string(), ids: v.array(v.string()) },
  handler: async (ctx, { protocol, subject, ids }) => {
    assertProtocol(protocol);
    if (ids.length > REPLICA_MAX_PUSH_OPS) throw new Error("Too many conflicts in one request");
    const userId = await requireReplicaActor(ctx, subject);
    const writer = await ReplicaWriter.open(ctx, userId);
    let dismissed = 0;
    for (const raw of ids) {
      const id = ctx.db.normalizeId("replicaConflicts", raw);
      if (id && (await writer.dismissConflict(id))) dismissed += 1;
    }
    await writer.finish();
    return { dismissed };
  },
});

const IMAGE_KEY = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_ASSET_KEYS = 50;

/**
 * Record the uploaded blob behind a vault photo key (typed, so media access, quota and account
 * deletion see it). Idempotent: a key that is already registered keeps its first blob.
 */
export const registerAsset = mutation({
  args: {
    protocol: v.number(),
    subject: v.string(),
    imageKey: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { protocol, subject, imageKey, storageId }) => {
    assertProtocol(protocol);
    if (!IMAGE_KEY.test(imageKey)) throw new Error("Invalid photo key");
    const userId = await requireReplicaActor(ctx, subject);
    const existing = await ctx.db
      .query("replicaAssets")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("imageKey", imageKey))
      .unique();
    if (existing) return { registered: existing.imageStorageId === storageId };
    await assertCanAttachStorage(ctx, userId, storageId);
    await ctx.db.insert("replicaAssets", {
      userId,
      imageKey,
      imageStorageId: storageId,
      createdAt: Date.now(),
    });
    return { registered: true };
  },
});

/** Download URLs for this account's registered photo keys (absent keys are not uploaded yet). */
export const assetUrls = query({
  args: { protocol: v.number(), subject: v.string(), imageKeys: v.array(v.string()) },
  handler: async (ctx, { protocol, subject, imageKeys }) => {
    assertProtocol(protocol);
    if (imageKeys.length > MAX_ASSET_KEYS) throw new Error("Too many photos in one request");
    const userId = await requireReplicaActor(ctx, subject);
    const out: { imageKey: string; url: string }[] = [];
    for (const imageKey of new Set(imageKeys)) {
      if (!IMAGE_KEY.test(imageKey)) continue;
      const asset = await ctx.db
        .query("replicaAssets")
        .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("imageKey", imageKey))
        .unique();
      const url = asset ? await ctx.storage.getUrl(asset.imageStorageId) : null;
      if (url) out.push({ imageKey, url });
    }
    return out;
  },
});

const PRUNE_BATCH = 200;
const pruneNext = makeFunctionReference<"mutation", { now?: number }>("replica:prune");

/**
 * Retention (daily cron): op dedupe records, tombstones and conflict records older than
 * `REPLICA_RETENTION_MS` are removed. Purging a tombstone raises its account's `floorRev`, so a
 * device that has not pulled since then resnapshots instead of silently missing the delete.
 */
export const prune = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = (args.now ?? Date.now()) - REPLICA_RETENTION_MS;
    const ops = await ctx.db
      .query("replicaOps")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(PRUNE_BATCH);
    for (const op of ops) await ctx.db.delete(op._id);
    const tombstones = await ctx.db
      .query("replicaRows")
      .withIndex("by_deletedAt", (q) => q.gt("deletedAt", 0).lt("deletedAt", cutoff))
      .take(PRUNE_BATCH);
    for (const row of tombstones) {
      const head = await loadHead(ctx, row.userId);
      if (head && head.floorRev < row.rev) await ctx.db.patch(head._id, { floorRev: row.rev });
      await ctx.db.delete(row._id);
    }
    const conflicts = await ctx.db
      .query("replicaConflicts")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(PRUNE_BATCH);
    for (const conflict of conflicts) await ctx.db.delete(conflict._id);
    const more = [ops, tombstones, conflicts].some((batch) => batch.length === PRUNE_BATCH);
    if (more) await ctx.scheduler.runAfter(0, pruneNext, { now: args.now });
    return { ops: ops.length, tombstones: tombstones.length, conflicts: conflicts.length, more };
  },
});
