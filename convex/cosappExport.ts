import { v } from "convex/values";
import { action, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireIdentity } from "./lib/authz";
import {
  convertKyarafitToCosapp,
  type CosappExport,
  type KyarafitSnapshot,
  type KyStoredFile,
} from "@kyarafit/design-system/domain/cosappExport";

/**
 * "Download for Cosapp.si" (Settings → Backup & data). The signed-in user's own Kyarafit data,
 * converted to a Cosapp.si backup (see design-system/domain/cosappExport.ts for the rules).
 *
 * The archive is assembled in the browser: `prepare` returns the backup rows, the photo manifest
 * and the import receipt; `photoBytes` then serves the photo files in batches, because a large
 * account's photos do not fit in one Convex return value (16 MiB). Both derive the account from
 * the session, and `photoBytes` serves only files the caller's own exported rows reference.
 */

/**
 * Largest total of photo bytes one `photoBytes` call returns (the client plans 4 MiB batches; one
 * photo can be up to 10 MiB). Bytes travel base64-encoded, so this keeps responses under 16 MiB.
 */
const MAX_PHOTO_RESPONSE_BYTES = 10.5 * 1024 * 1024;
const MAX_PHOTOS_PER_CALL = 200;

/** Deleted rows stay on the server; their content never leaves it through this export. */
function live<T extends { deletedAt?: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt == null);
}

/** The caller's live rows, read only through their own `by_userId` indexes. */
export const snapshot = internalQuery({
  args: {},
  handler: async (ctx): Promise<KyarafitSnapshot> => {
    const userId = await requireIdentity(ctx);
    const [
      builds,
      cosplayNodes,
      workflowItems,
      workflowAttachments,
      conventions,
      conventionDayPlans,
      packingListItems,
      buildReferenceImages,
      buildProcessPictures,
      buildProgressUpdates,
    ] = await Promise.all([
      ctx.db
        .query("builds")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("cosplayNodes")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("workflowItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("workflowAttachments")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("conventions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("conventionDayPlans")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("packingListItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("buildReferenceImages")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("buildProcessPictures")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
      ctx.db
        .query("buildProgressUpdates")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(live),
    ]);

    const storageIds = new Set<Id<"_storage">>();
    for (const row of [
      ...builds,
      ...cosplayNodes,
      ...conventions,
      ...buildReferenceImages,
      ...buildProcessPictures,
    ]) {
      if (row.imageStorageId) storageIds.add(row.imageStorageId);
    }
    for (const update of buildProgressUpdates) {
      for (const ref of update.imageRefs) if (ref.kind === "cloud") storageIds.add(ref.storageId);
    }
    const storedFiles: KyStoredFile[] = [];
    for (const storageId of storageIds) {
      const metadata = await ctx.db.system.get("_storage", storageId);
      if (metadata) {
        storedFiles.push({ storageId, size: metadata.size, contentType: metadata.contentType });
      }
    }

    return {
      builds,
      cosplayNodes,
      workflowItems,
      workflowAttachments,
      conventions,
      conventionDayPlans,
      packingListItems,
      buildReferenceImages,
      buildProcessPictures,
      buildProgressUpdates,
      storedFiles,
    };
  },
});

async function convert(ctx: ActionCtx): Promise<CosappExport> {
  const rows: KyarafitSnapshot = await ctx.runQuery(internal.cosappExport.snapshot, {});
  return convertKyarafitToCosapp(rows, { now: Date.now() });
}

/** The backup rows, the photo files the archive needs, and the import receipt. */
export const prepare = action({
  args: {},
  handler: async (ctx): Promise<CosappExport> => convert(ctx),
});

/**
 * Bytes for a batch of the photo files `prepare` listed. Ids the caller's export does not
 * reference are refused; a file that vanished since comes back as `bytes: null`.
 */
export const photoBytes = action({
  args: { storageIds: v.array(v.string()) },
  handler: async (
    ctx,
    { storageIds }
  ): Promise<{ storageId: string; bytes: ArrayBuffer | null }[]> => {
    if (storageIds.length > MAX_PHOTOS_PER_CALL) throw new Error("Too many photos in one request");
    const { photoFiles } = await convert(ctx);
    const sizes = new Map(photoFiles.map((file) => [file.storageId, file.size]));
    let total = 0;
    for (const storageId of new Set(storageIds)) {
      const size = sizes.get(storageId);
      if (size === undefined) throw new Error("Photo not found");
      total += size;
    }
    if (total > MAX_PHOTO_RESPONSE_BYTES) throw new Error("Too many photo bytes in one request");

    const out: { storageId: string; bytes: ArrayBuffer | null }[] = [];
    for (const storageId of new Set(storageIds)) {
      const blob = await ctx.storage.get(storageId as Id<"_storage">);
      out.push({ storageId, bytes: blob ? await blob.arrayBuffer() : null });
    }
    return out;
  },
});
