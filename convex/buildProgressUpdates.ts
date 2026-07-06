import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import { idempotentReplay, idempotentRecord } from "./lib/idempotency";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import { MAX_LENGTH, clampNumber, sanitizeOptional } from "./lib/validation";
import { imageRefValidator } from "./lib/imageRef";
import { checkLimitAndAddUsage } from "./storageUsage";

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
  return isPaidConvexTier(user?.tier);
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
  args: { buildId: v.id("builds"), userId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) return [];
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
    userId: v.string(),
    note: v.optional(v.string()),
    imageRefs: v.optional(v.array(imageRefValidator)),
    progressPercent: v.optional(v.number()),
    /** Request to surface this update on the social feed. Honored only for paid users. */
    publish: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"buildProgressUpdates"> | null;

    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) {
      throw new Error("Build not found or not authorized");
    }

    let publishedToFeed = false;
    if (args.publish === true) {
      if (!(await isPaidUser(ctx, args.userId))) {
        throw new Error("Publishing a progress update to the feed requires a paid plan");
      }
      publishedToFeed = true;
    }

    const id = await ctx.db.insert(
      "buildProgressUpdates",
      withCreateMeta({
        buildId: args.buildId,
        userId: args.userId,
        createdAt: Date.now(),
        note: sanitizeOptional(args.note, MAX_LENGTH.notes, "Note"),
        imageRefs: args.imageRefs ?? [],
        progressPercent: clampNumber(args.progressPercent, 0, 100, "Progress percent"),
        publishedToFeed,
      })
    );
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(id));
  },
});

export const update = mutation({
  args: {
    id: v.id("buildProgressUpdates"),
    userId: v.string(),
    note: v.optional(v.union(v.string(), v.null())),
    imageRefs: v.optional(v.array(imageRefValidator)),
    progressPercent: v.optional(v.union(v.number(), v.null())),
    /** Toggle feed publication. Setting true requires a paid plan; false is always allowed. */
    publish: v.optional(v.boolean()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Doc<"buildProgressUpdates"> | null;

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Progress update not found or not authorized");
    }

    const patch: Record<string, unknown> = {};
    if (args.note !== undefined)
      patch.note =
        args.note === null ? undefined : sanitizeOptional(args.note, MAX_LENGTH.notes, "Note");
    if (args.imageRefs !== undefined) {
      // Paid image upload-on-sync flips a `local` ref to `cloud` here (REQ-D71). A newly-stored
      // blob must go through the same cloud-storage accounting as the normal upload path so a paid
      // user cannot exceed the REQ-D90 cap. Only storage ids that were NOT already cloud on this doc
      // are counted, so replays and non-mirroring edits (reorder/remove) never double-count. Over
      // the cap, `checkLimitAndAddUsage` throws before the patch, so the row keeps its `local` ref
      // (the local binary is never lost — the sync worker retries on the next drain).
      const before = cloudStorageIds(doc.imageRefs);
      for (const ref of args.imageRefs) {
        if (ref.kind === "cloud" && !before.has(ref.storageId)) {
          await checkLimitAndAddUsage(ctx, args.userId, ref.storageId);
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
      if (args.publish === true && !(await isPaidUser(ctx, args.userId))) {
        throw new Error("Publishing a progress update to the feed requires a paid plan");
      }
      patch.publishedToFeed = args.publish;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, withUpdateMeta(doc, patch));
    }
    return idempotentRecord(ctx, args.idempotencyKey, args.userId, await ctx.db.get(args.id));
  },
});

export const remove = mutation({
  args: { id: v.id("buildProgressUpdates"), userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc || doc.userId !== args.userId) {
      throw new Error("Progress update not found or not authorized");
    }
    await ctx.db.delete(args.id);
  },
});
