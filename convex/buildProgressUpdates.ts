import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { idempotentReplay, idempotentRecord } from "./lib/idempotency";
import { hasPaidAccess } from "@kyarafit/design-system/domain/accessPolicy";
import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import { MAX_LENGTH, clampNumber, sanitizeOptional } from "./lib/validation";
import { imageRefValidator } from "./lib/imageRef";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { indexProgressMedia } from "./lib/storageOwnership";
import { optionalIdentity, requireIdentity } from "./lib/authz";

/**
 * Build progress-update timeline (DATA_AND_SYNC.md §3.3, PRODUCT_SPEC.md §4.3 — REQ-049). Dated,
 * ownership-scoped, timeline-ordered (newest first). `publishedToFeed` is paid-only: the publish
 * gate is enforced here at the mutation. Mutations validate args and maintain sync metadata; `add`
 * is idempotent-capable via an optional `idempotencyKey` (matching `builds.create`).
 */

/** Whether `userId` (Better Auth externalId) is on a paid tier — the gate for publishing to feed. */
async function isPaidUser(ctx: MutationCtx, userId: string): Promise<boolean> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", userId))
    .unique();
  // Owners count as paid regardless of tier (role read from the DB row, never client input).
  return hasPaidAccess(user?.tier, user?.role);
}

/** The set of Convex `_storage` ids referenced by `cloud` `ImageRef`s on a doc's `imageRefs`. */
function cloudStorageIds(refs: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(refs)) return ids;
  for (const ref of refs) {
    if (
      ref !== null &&
      typeof ref === "object" &&
      (ref as { kind?: unknown }).kind === "cloud" &&
      typeof (ref as { storageId?: unknown }).storageId === "string"
    ) {
      ids.add((ref as { storageId: string }).storageId);
    }
  }
  return ids;
}

export const listByBuild = query({
  args: { buildId: v.id("builds"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== actorId || build.deletedAt != null) return [];
    const rows = await ctx.db
      .query("buildProgressUpdates")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const live = rows.filter((r) => r.deletedAt == null);
    // Reuse the shared pure ordering (newest-first by createdAt, stable for ties).
    return sortProgressUpdates(live.map((r) => ({ ...r, id: r._id as string })));
  },
});

export const add = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.optional(v.string()), // retained for deployed clients but ignored
    note: v.optional(v.string()),
    imageRefs: v.optional(v.array(imageRefValidator)),
    progressPercent: v.optional(v.number()),
    /** Request to surface this update on the social feed. Honored only for paid users. */
    publish: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== actorId || build.deletedAt != null) {
      throw new Error("Build not found or not authorized");
    }

    // Session and resource checks must precede even a cached response.
    const replay = await idempotentReplay(ctx, args.idempotencyKey, "buildProgressUpdates.add");
    if (replay.hit) return replay.result as Doc<"buildProgressUpdates"> | null;

    let publishedToFeed = false;
    if (args.publish === true) {
      if (!(await isPaidUser(ctx, actorId))) {
        throw new Error("Publishing a progress update to the feed requires a paid plan");
      }
      publishedToFeed = true;
    }

    const imageRefs = args.imageRefs ?? [];
    if (imageRefs.length > 20) throw new Error("Too many progress images");
    const charged = new Set<string>();
    for (const ref of imageRefs) {
      if (ref.kind === "cloud" && !charged.has(ref.storageId)) {
        await checkLimitAndAddUsage(ctx, actorId, ref.storageId);
        charged.add(ref.storageId);
      }
    }
    const id = await ctx.db.insert(
      "buildProgressUpdates",
      withCreateMeta({
        buildId: args.buildId,
        userId: actorId,
        createdAt: Date.now(),
        note: sanitizeOptional(args.note, MAX_LENGTH.notes, "Note"),
        imageRefs,
        progressPercent: clampNumber(args.progressPercent, 0, 100, "Progress percent"),
        publishedToFeed,
      })
    );
    await indexProgressMedia(ctx, id);
    return idempotentRecord(
      ctx,
      args.idempotencyKey,
      actorId,
      await ctx.db.get(id),
      "buildProgressUpdates.add"
    );
  },
});

export const update = mutation({
  args: {
    id: v.id("buildProgressUpdates"),
    userId: v.optional(v.string()), // retained for deployed clients but ignored
    note: v.optional(v.union(v.string(), v.null())),
    imageRefs: v.optional(v.array(imageRefValidator)),
    progressPercent: v.optional(v.union(v.number(), v.null())),
    /** Toggle feed publication. Setting true requires a paid plan; false is always allowed. */
    publish: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== actorId || doc.deletedAt != null) {
      throw new Error("Progress update not found or not authorized");
    }

    const replay = await idempotentReplay(ctx, args.idempotencyKey, "buildProgressUpdates.update");
    if (replay.hit) return replay.result as Doc<"buildProgressUpdates"> | null;

    const patch: Record<string, unknown> = {};
    if (args.note !== undefined)
      patch.note =
        args.note === null ? undefined : sanitizeOptional(args.note, MAX_LENGTH.notes, "Note");
    if (args.imageRefs !== undefined) {
      if (args.imageRefs.length > 20) throw new Error("Too many progress images");
      // Paid image upload-on-sync flips a `local` ref to `cloud` here (REQ-D71). A newly-stored
      // blob must go through the same cloud-storage accounting as the normal upload path so a paid
      // user cannot exceed the REQ-D90 cap. Only storage ids that were NOT already cloud on this doc
      // are counted, so replays and non-mirroring edits (reorder/remove) never double-count. Over
      // the cap, `checkLimitAndAddUsage` throws before the patch, so the row keeps its `local` ref
      // (the local binary is never lost — the sync worker retries on the next drain).
      const before = cloudStorageIds(doc.imageRefs);
      for (const ref of args.imageRefs) {
        if (ref.kind === "cloud" && !before.has(ref.storageId)) {
          await checkLimitAndAddUsage(ctx, actorId, ref.storageId);
          before.add(ref.storageId);
        }
      }
      const after = cloudStorageIds(args.imageRefs);
      for (const ref of doc.imageRefs) {
        if (ref.kind === "cloud" && !after.has(ref.storageId)) {
          await subtractUsageForStorageId(ctx, actorId, ref.storageId);
          after.add(ref.storageId);
        }
      }
      patch.imageRefs = args.imageRefs;
    }
    if (args.progressPercent !== undefined)
      patch.progressPercent =
        args.progressPercent === null
          ? undefined
          : clampNumber(args.progressPercent, 0, 100, "Progress percent");
    if (args.publish !== undefined) {
      if (args.publish === true && !(await isPaidUser(ctx, actorId))) {
        throw new Error("Publishing a progress update to the feed requires a paid plan");
      }
      patch.publishedToFeed = args.publish;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, withUpdateMeta(doc, patch));
      if (args.imageRefs !== undefined) await indexProgressMedia(ctx, args.id);
    }
    return idempotentRecord(
      ctx,
      args.idempotencyKey,
      actorId,
      await ctx.db.get(args.id),
      "buildProgressUpdates.update"
    );
  },
});

export const remove = mutation({
  args: { id: v.id("buildProgressUpdates"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== actorId) {
      throw new Error("Progress update not found or not authorized");
    }
    if (doc.deletedAt != null) return;
    for (const storageId of new Set(
      doc.imageRefs.filter((ref) => ref.kind === "cloud").map((ref) => ref.storageId)
    )) {
      await subtractUsageForStorageId(ctx, actorId, storageId);
    }
    // Keep the row so incremental pull can propagate deletion to offline clients.
    await ctx.db.patch(args.id, withUpdateMeta(doc, { deletedAt: Date.now() }));
  },
});
