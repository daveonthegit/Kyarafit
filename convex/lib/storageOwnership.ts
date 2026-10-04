import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { effectiveStorageLimitMb } from "@kyarafit/design-system/domain/accessPolicy";
import { assertActiveAccountTargets } from "./accountDeletion";
import {
  storageReferences,
  hasLiveReferences,
  canAttachReferencedStorage,
} from "./storageReferences";

export const MB = 1024 * 1024;
// Bound buffering and orphan exposure in the upload proxy. This is an ingress safety ceiling,
// not a tier allowance or the future R2 derivative-size policy.
export const MAX_UPLOAD_BYTES = 20 * MB;
export const UPLOAD_TTL_MS = 15 * 60 * 1000;
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
// Convex runtime actions have a 30-minute execution ceiling; recovery waits beyond that ceiling.
export const UPLOAD_RECOVERY_TTL_MS = 35 * 60 * 1000;

/** Non-secret MIME parameter durably links a stored blob to its reservation across action failure. */
export function uploadContentType(contentType: string | null, uploadTag: string): string {
  const base = contentType?.split(";")[0].trim().toLowerCase() ?? "";
  const mime = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(base)
    ? base
    : "application/octet-stream";
  return `${mime};kfm-upload-tag=${uploadTag}`;
}
export const MAX_PENDING_UPLOADS = 5;

export async function storageClaim(ctx: QueryCtx, storageId: Id<"_storage">) {
  return ctx.db
    .query("storageClaims")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
}

export async function storageUser(ctx: QueryCtx, userId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", userId))
    .unique();
  if (!user) throw new Error("Upload account not found");
  return user;
}

/** Every live-reference move/add/remove changes this token in the same transaction. */
export async function touchStorageReferences(ctx: MutationCtx, storageId: Id<"_storage">) {
  const epoch = await ctx.db
    .query("storageReferenceEpochs")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  const revision = crypto.randomUUID();
  if (epoch) await ctx.db.patch(epoch._id, { revision });
  else await ctx.db.insert("storageReferenceEpochs", { storageId, revision });
}

export async function assertCanAttachStorage(
  ctx: MutationCtx,
  userId: string,
  storageId: Id<"_storage">
) {
  await storageUser(ctx, userId);
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata || metadata.size <= 0) throw new Error("Storage object not found");
  await touchStorageReferences(ctx, storageId);
  const claim = await storageClaim(ctx, storageId);
  if (claim?.userId === userId && !claim.attached) {
    if (claim.expiresAt <= Date.now()) throw new Error("Upload claim expired");
    await ctx.db.patch(claim._id, { attached: true });
    return;
  }
  if (!(await canAttachReferencedStorage(ctx, await storageReferences(ctx, storageId), userId))) {
    throw new Error("Storage attachment not authorized");
  }
}

export async function reserveUpload(
  ctx: MutationCtx,
  userId: string,
  token: string,
  requestedBytes?: number
) {
  const user = await storageUser(ctx, userId);
  const reservations = await ctx.db
    .query("storageUploadReservations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const pending = await ctx.db
    .query("storageClaims")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("attached"), false))
    .collect();
  if (reservations.length + pending.length >= MAX_PENDING_UPLOADS)
    throw new Error("Too many pending uploads");
  const reserved = reservations.reduce((sum, row) => sum + row.reservedBytes, 0);
  const limit = effectiveStorageLimitMb(user.tier, user.role);
  const available =
    limit < 0 ? MAX_UPLOAD_BYTES : Math.floor((limit - user.currentUsageMb) * MB) - reserved;
  const bytes = requestedBytes ?? Math.min(MAX_UPLOAD_BYTES, available);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES)
    throw new Error("Invalid upload size or storage limit reached");
  if (bytes > available) throw new Error("Storage limit reached");
  const id = await ctx.db.insert("storageUploadReservations", {
    userId,
    token,
    uploadTag: crypto.randomUUID(),
    reservedBytes: bytes,
    expiresAt: Date.now() + UPLOAD_TTL_MS,
    consumed: false,
  });
  await ctx.scheduler.runAfter(UPLOAD_TTL_MS, internal.files.expireReservation, { id });
  return id;
}

/** Called after a reference-removal transaction commits; never delete a live shared object. */
export async function cleanupStorageClaim(ctx: MutationCtx, storageId: Id<"_storage">) {
  const claim = await storageClaim(ctx, storageId);
  if (!claim) return;
  const refs = await storageReferences(ctx, storageId);
  if (hasLiveReferences(refs)) {
    if (!claim.attached) await ctx.db.patch(claim._id, { attached: true });
    return;
  }
  if (!claim.attached && claim.expiresAt > Date.now()) return;
  await ctx.storage.delete(storageId);
  const epoch = await ctx.db
    .query("storageReferenceEpochs")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (epoch) await ctx.db.delete(epoch._id);
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", claim.userId))
    .unique();
  if (user)
    await ctx.db.patch(user._id, {
      currentUsageMb: Math.max(0, user.currentUsageMb - claim.sizeBytes / MB),
    });
  await ctx.db.delete(claim._id);
}

/** Deletion-only bounded reference walk; unrelated upload/attachment behavior is unchanged. */
const deletionReferenceTables = [
  "builds",
  "cosplayNodes",
  "buildReferenceImages",
  "buildProcessPictures",
  "conventions",
  "closetItems",
  "users",
  "groups",
  "progressMediaReferences",
  "buildProgressUpdates",
] as const;
type DeletionStorageCursor = {
  storageId: Id<"_storage">;
  table: number;
  page: string | null;
  live: boolean;
  revision?: string;
};

export async function releaseDeletedStorage(
  ctx: MutationCtx,
  userId: string,
  storageId: Id<"_storage">,
  cursor?: string
): Promise<{ done: boolean; cursor?: string }> {
  const parsed: DeletionStorageCursor | undefined = cursor ? JSON.parse(cursor) : undefined;
  const epoch = await ctx.db
    .query("storageReferenceEpochs")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  const matches = parsed?.storageId === storageId && parsed.revision === epoch?.revision;
  const resumeTable = matches ? parsed.table : undefined;
  const state: DeletionStorageCursor = matches
    ? parsed
    : { storageId, table: 0, page: null, live: false, revision: epoch?.revision };
  const claim = await storageClaim(ctx, storageId);
  // At most one small page per reference table. A heavily-shared blob continues next transaction.
  for (; state.table < deletionReferenceTables.length; state.table++) {
    const table = deletionReferenceTables[state.table];
    const query =
      table === "buildProgressUpdates"
        ? ctx.db.query(table).withIndex("by_mediaIndexed", (q) => q.eq("mediaIndexed", undefined))
        : table === "progressMediaReferences"
          ? ctx.db.query(table).withIndex("by_storageId", (q) => q.eq("storageId", storageId))
          : ctx.db
              .query(table)
              .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId));
    // Convex permits only one pagination query per function. Small indexed reads use take;
    // a larger reference set is checkpointed and paginated alone on the following invocation.
    let page;
    if (state.table === resumeTable) {
      page = await query.paginate({ cursor: state.page, numItems: 5 });
    } else {
      const small = await query.take(6);
      if (small.length === 6) return { done: false, cursor: JSON.stringify(state) };
      page = { page: small, isDone: true, continueCursor: "" };
    }
    for (const entry of page.page) {
      const row = "progressUpdateId" in entry ? await ctx.db.get(entry.progressUpdateId) : entry;
      if (!row || ("deletedAt" in row && row.deletedAt != null)) continue;
      if (
        table === "buildProgressUpdates" &&
        "imageRefs" in row &&
        !row.imageRefs.some((ref) => ref.kind === "cloud" && ref.storageId === storageId)
      )
        continue;
      state.live = true;
      const owner =
        "userId" in row
          ? row.userId
          : "externalId" in row
            ? row.externalId
            : "createdBy" in row
              ? row.createdBy
              : undefined;
      if (owner && owner !== userId) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", owner))
          .unique();
        if (user) {
          // Transfer once, even above cap: deletion must not destroy legitimate shared bytes.
          if (claim?.userId === userId) {
            await ctx.db.patch(user._id, {
              currentUsageMb: user.currentUsageMb + claim.sizeBytes / MB,
            });
            await ctx.db.patch(claim._id, { userId: owner, attached: true });
          }
          return { done: true };
        }
      }
    }
    if (!page.isDone) {
      state.page = page.continueCursor;
      return { done: false, cursor: JSON.stringify(state) };
    }
    state.page = null;
  }
  if (!state.live) {
    // Duplicate references may enqueue the same blob; already-removed bytes are a successful retry.
    if (await ctx.db.system.get("_storage", storageId)) await ctx.storage.delete(storageId);
    if (epoch) await ctx.db.delete(epoch._id);
    if (claim) {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", claim.userId))
        .unique();
      if (owner)
        await ctx.db.patch(owner._id, {
          currentUsageMb: Math.max(0, owner.currentUsageMb - claim.sizeBytes / MB),
        });
      await ctx.db.delete(claim._id);
    }
  } else if (claim?.userId === userId) {
    // A surviving historical reference without an app user still protects bytes, not an identity.
    await ctx.db.delete(claim._id);
  }
  return { done: true };
}

/** Call AFTER deleting owned references. Repeat with the returned cursor until done. */
export async function releaseUserStorage(
  ctx: MutationCtx,
  userId: string,
  cursor?: string
): Promise<{ done: boolean; cursor?: string; retryAfterMs: number }> {
  const reservations = await ctx.db
    .query("storageUploadReservations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(5);
  for (const reservation of reservations) {
    if (reservation.consumed) {
      // In-flight actions must finish (or pass their runtime ceiling) before tagged orphan recovery.
      const delay = Math.max(
        0,
        (reservation.consumedAt ?? reservation.expiresAt) + UPLOAD_RECOVERY_TTL_MS - Date.now()
      );
      await ctx.scheduler.runAfter(delay, internal.files.reconcileReservation, {
        id: reservation._id,
        cursor: null,
      });
      return { done: false, cursor, retryAfterMs: Math.max(delay, 60_000) };
    }
    await ctx.db.delete(reservation._id);
  }
  const claims = await ctx.db
    .query("storageClaims")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(2);
  for (const claim of claims) {
    const result = await releaseDeletedStorage(ctx, userId, claim.storageId, cursor);
    if (!result.done) return { ...result, retryAfterMs: 0 };
    // A resumed walk may have paginated: handle the next claim in a fresh transaction.
    if (cursor) return { done: false, retryAfterMs: 0 };
    cursor = undefined;
  }
  const remainingReservation = await ctx.db
    .query("storageUploadReservations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  const remainingClaim = await ctx.db
    .query("storageClaims")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return { done: !remainingReservation && !remainingClaim, retryAfterMs: 0 };
}

export async function indexProgressMedia(
  ctx: MutationCtx,
  progressUpdateId: Id<"buildProgressUpdates">
) {
  const row = await ctx.db.get(progressUpdateId);
  if (row) {
    const build = await ctx.db.get(row.buildId);
    await assertActiveAccountTargets(ctx, row.userId, build?.userId);
  }
  const old = await ctx.db
    .query("progressMediaReferences")
    .withIndex("by_progressUpdateId", (q) => q.eq("progressUpdateId", progressUpdateId))
    .collect();
  for (const ref of old) {
    await touchStorageReferences(ctx, ref.storageId);
    await ctx.db.delete(ref._id);
  }
  if (!row) return;
  const ids = new Set(
    row.imageRefs.filter((ref) => ref.kind === "cloud").map((ref) => ref.storageId)
  );
  for (const storageId of ids) {
    await touchStorageReferences(ctx, storageId);
    await ctx.db.insert("progressMediaReferences", { storageId, progressUpdateId });
  }
  await ctx.db.patch(progressUpdateId, { mediaIndexed: true });
}
