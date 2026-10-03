import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  internalMutation,
  httpAction,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { optionalIdentity, requireIdentity } from "./lib/authz";
import { canReadStorageId } from "./lib/mediaAccess";
import {
  reserveUpload,
  storageUser,
  cleanupStorageClaim,
  MB,
  PENDING_TTL_MS,
  indexProgressMedia,
  UPLOAD_RECOVERY_TTL_MS,
  uploadContentType,
  storageClaim,
} from "./lib/storageOwnership";
import { effectiveStorageLimitMb } from "@kyarafit/design-system/domain/accessPolicy";
import { storageReferences, hasLiveReferences } from "./lib/storageReferences";

async function mintUploadUrl(ctx: MutationCtx, sizeBytes?: number): Promise<string> {
  const actorId = await requireIdentity(ctx);
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new Error("Upload endpoint is not configured");
  const token = crypto.randomUUID();
  await reserveUpload(ctx, actorId, token, sizeBytes);
  return `${site.replace(/\/$/, "")}/media/upload?token=${encodeURIComponent(token)}`;
}

/** Same installed-client contract: no args, URL string, POST bytes, receive {storageId}. */
export const generateUploadUrl = mutation({
  args: {},
  handler: (ctx): Promise<string> => mintUploadUrl(ctx),
});

/** Opt-in exact-byte reservation for future clients; do not change the zero-arg SDK signature. */
export const generateUploadUrlForSize = mutation({
  args: { sizeBytes: v.number() },
  handler: (ctx, args): Promise<string> => mintUploadUrl(ctx, args.sizeBytes),
});

export const consumeReservation = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<Doc<"storageUploadReservations"> | null> => {
    const row = await ctx.db
      .query("storageUploadReservations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!row || row.consumed || row.expiresAt <= Date.now()) return null;
    await storageUser(ctx, row.userId);
    await ctx.db.patch(row._id, { consumed: true, consumedAt: Date.now() });
    await ctx.scheduler.runAfter(UPLOAD_RECOVERY_TTL_MS, internal.files.reconcileReservation, {
      id: row._id,
      cursor: null,
    });
    return row;
  },
});

export const expireReservation = internalMutation({
  args: { id: v.id("storageUploadReservations"), releaseConsumed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    // If ingress was interrupted, unknown stored bytes remain quota-reserved. Never automatically
    // release a consumed reservation until the action confirms completion or blob deletion.
    if (row && (!row.consumed || args.releaseConsumed)) await ctx.db.delete(args.id);
  },
});

/** Recover interrupted ingress without an unbounded transaction or deleting shared bytes. */
export const reconcileReservation = internalMutation({
  args: { id: v.id("storageUploadReservations"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.db.get(args.id);
    if (!row || !row.consumed) return;
    const due = (row.consumedAt ?? row.expiresAt) + UPLOAD_RECOVERY_TTL_MS;
    if (due > Date.now()) {
      await ctx.scheduler.runAfter(due - Date.now(), internal.files.reconcileReservation, {
        id: row._id,
        cursor: null,
      });
      return;
    }
    const page = await ctx.db.system
      .query("_storage")
      .paginate({ cursor: args.cursor, numItems: 50 });
    for (const meta of page.page) {
      if (
        meta.contentType?.endsWith(`;kfm-upload-tag=${row.uploadTag}`) &&
        !(await storageClaim(ctx, meta._id)) &&
        !hasLiveReferences(await storageReferences(ctx, meta._id))
      ) {
        await ctx.storage.delete(meta._id);
      }
    }
    if (page.isDone) await ctx.db.delete(row._id);
    else
      await ctx.scheduler.runAfter(0, internal.files.reconcileReservation, {
        id: row._id,
        cursor: page.continueCursor,
      });
  },
});

export const completeUpload = internalMutation({
  args: { reservationId: v.id("storageUploadReservations"), storageId: v.id("_storage") },
  handler: async (ctx, args): Promise<void> => {
    const row = await ctx.db.get(args.reservationId);
    if (!row || !row.consumed || row.expiresAt <= Date.now())
      throw new Error("Upload claim expired");
    const meta = await ctx.db.system.get("_storage", args.storageId);
    if (
      !meta ||
      meta.size <= 0 ||
      meta.size > row.reservedBytes ||
      !meta.contentType?.endsWith(`;kfm-upload-tag=${row.uploadTag}`)
    )
      throw new Error("Invalid upload size");
    const user = await storageUser(ctx, row.userId);
    const others = await ctx.db
      .query("storageUploadReservations")
      .withIndex("by_userId", (q) => q.eq("userId", row.userId))
      .collect();
    const otherBytes = others
      .filter((r) => r._id !== row._id)
      .reduce((sum, r) => sum + r.reservedBytes, 0);
    const limit = effectiveStorageLimitMb(user.tier, user.role);
    if (limit >= 0 && user.currentUsageMb * MB + meta.size + otherBytes > limit * MB)
      throw new Error("Storage limit reached");
    await ctx.db.insert("storageClaims", {
      storageId: args.storageId,
      userId: row.userId,
      sizeBytes: meta.size,
      expiresAt: Date.now() + PENDING_TTL_MS,
      attached: false,
    });
    await ctx.db.patch(user._id, { currentUsageMb: user.currentUsageMb + meta.size / MB });
    await ctx.db.delete(row._id);
    await ctx.scheduler.runAfter(PENDING_TTL_MS, internal.files.cleanupClaim, {
      storageId: args.storageId,
    });
  },
});

/** Operator-invoked, non-destructive reverse-index migration; bounded batches and safe retries. */
export const indexLegacyProgress = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const rows = await ctx.db
      .query("buildProgressUpdates")
      .withIndex("by_mediaIndexed", (q) => q.eq("mediaIndexed", undefined))
      .take(25);
    for (const row of rows) await indexProgressMedia(ctx, row._id);
    if (rows.length === 25) await ctx.scheduler.runAfter(0, internal.files.indexLegacyProgress, {});
    return rows.length;
  },
});

export const cleanupClaim = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await cleanupStorageClaim(ctx, args.storageId);
  },
});

// No cookies or session headers: the one-time upload capability is the sole ingress authority.
// Public byte serving is unchanged; CORS here is only for the client-compatible upload POST.
const uploadHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
export const uploadOptions = httpAction(
  async () => new Response(null, { status: 204, headers: uploadHeaders })
);

export const upload = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token)
    return new Response('{"error":"Upload not authorized"}', {
      status: 403,
      headers: uploadHeaders,
    });
  let reservation: Doc<"storageUploadReservations"> | null;
  try {
    reservation = await ctx.runMutation(internal.files.consumeReservation, { token });
  } catch {
    reservation = null;
  }
  if (!reservation)
    return new Response('{"error":"Upload not authorized"}', {
      status: 403,
      headers: uploadHeaders,
    });
  let storageId: Id<"_storage"> | undefined;
  let releaseReservation = false;
  let rejectionStatus = 503;
  try {
    const length = request.headers.get("Content-Length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > reservation.reservedBytes)) {
      rejectionStatus = 413;
      throw new Error("Upload too large");
    }
    const reader = request.body?.getReader();
    if (!reader) {
      rejectionStatus = 400;
      throw new Error("Empty upload");
    }
    const chunks: ArrayBuffer[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > reservation.reservedBytes) {
        await reader.cancel();
        rejectionStatus = 413;
        throw new Error("Upload too large");
      }
      chunks.push(new Uint8Array(value).buffer);
    }
    if (size === 0) {
      rejectionStatus = 400;
      throw new Error("Empty upload");
    }
    storageId = await ctx.storage.store(
      new Blob(chunks, {
        type: uploadContentType(request.headers.get("Content-Type"), reservation.uploadTag),
      })
    );
    await ctx.runMutation(internal.files.completeUpload, {
      reservationId: reservation._id,
      storageId,
    });
    releaseReservation = true;
    return new Response(JSON.stringify({ storageId }), { status: 200, headers: uploadHeaders });
  } catch {
    if (storageId) await ctx.storage.delete(storageId);
    releaseReservation = true;
    return new Response('{"error":"Upload rejected"}', {
      status: rejectionStatus,
      headers: uploadHeaders,
    });
  } finally {
    if (releaseReservation)
      await ctx.runMutation(internal.files.expireReservation, {
        id: reservation._id,
        releaseConsumed: true,
      });
  }
});

/** Authorized discovery only. Possession of the returned capability URL serves bytes unsigned. */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const viewerId = await optionalIdentity(ctx);
    if (!(await canReadStorageId(ctx, args.storageId, viewerId))) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});
