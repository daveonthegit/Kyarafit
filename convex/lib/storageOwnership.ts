import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { effectiveStorageLimitMb } from "@kyarafit/design-system/domain/accessPolicy";
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

export async function assertCanAttachStorage(
  ctx: MutationCtx,
  userId: string,
  storageId: Id<"_storage">
) {
  await storageUser(ctx, userId);
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata || metadata.size <= 0) throw new Error("Storage object not found");
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

/** S5 contract: call AFTER deleting owned references, instead of deleting their blobs directly. */
export async function releaseUserStorage(ctx: MutationCtx, userId: string) {
  const reservations = await ctx.db
    .query("storageUploadReservations")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const reservation of reservations) {
    if (reservation.consumed) {
      await ctx.scheduler.runAfter(0, internal.files.reconcileReservation, {
        id: reservation._id,
        cursor: null,
      });
    } else {
      await ctx.db.delete(reservation._id);
    }
  }
  const claims = await ctx.db
    .query("storageClaims")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const claim of claims) {
    const refs = await storageReferences(ctx, claim.storageId);
    if (hasLiveReferences(refs)) {
      // Existing shared bytes survive account deletion. Transfer their attribution to a remaining
      // reference owner (even if that leaves them over cap), never retain the deleted identity.
      const owners = new Set<string>();
      for (const rows of Object.values(refs))
        for (const row of rows) {
          if ("deletedAt" in row && row.deletedAt != null) continue;
          const owner =
            "userId" in row
              ? row.userId
              : "externalId" in row
                ? row.externalId
                : "createdBy" in row
                  ? row.createdBy
                  : undefined;
          if (owner && owner !== userId) owners.add(owner);
        }
      let transferred = false;
      for (const owner of [...owners].sort()) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", owner))
          .unique();
        if (!user) continue;
        await ctx.db.patch(user._id, {
          currentUsageMb: user.currentUsageMb + claim.sizeBytes / MB,
        });
        await ctx.db.patch(claim._id, { userId: owner, attached: true });
        transferred = true;
        break;
      }
      if (!transferred) await ctx.db.delete(claim._id);
    } else {
      await ctx.db.patch(claim._id, { attached: true });
      await cleanupStorageClaim(ctx, claim.storageId);
    }
  }
}

export async function indexProgressMedia(
  ctx: MutationCtx,
  progressUpdateId: Id<"buildProgressUpdates">
) {
  const row = await ctx.db.get(progressUpdateId);
  const old = await ctx.db
    .query("progressMediaReferences")
    .withIndex("by_progressUpdateId", (q) => q.eq("progressUpdateId", progressUpdateId))
    .collect();
  for (const ref of old) await ctx.db.delete(ref._id);
  if (!row) return;
  const ids = new Set(
    row.imageRefs.filter((ref) => ref.kind === "cloud").map((ref) => ref.storageId)
  );
  for (const storageId of ids)
    await ctx.db.insert("progressMediaReferences", { storageId, progressUpdateId });
  await ctx.db.patch(progressUpdateId, { mediaIndexed: true });
}
