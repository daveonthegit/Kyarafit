import { v } from "convex/values";
import { action, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireIdentity } from "./lib/authz";
import {
  convertKyarafitToCosapp,
  newestSourceChange,
  type KySourceTable,
  EXPORT_MAX_PHOTO_BYTES,
  PHOTO_BATCH_BYTES,
  MAX_PHOTOS_PER_CALL,
  MAX_EXTERNAL_PHOTOS_PER_CALL,
  isCosappImage,
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

/** Deleted rows stay on the server; their content never leaves it through this export. */
function live<T extends { deletedAt?: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt == null);
}

/** The caller's live rows, read only through their own `by_userId` indexes. */
export const snapshot = internalQuery({
  args: {},
  handler: async (ctx): Promise<KyarafitSnapshot> => {
    const userId = await requireIdentity(ctx);
    const sourceUpdatedAt: Partial<Record<KySourceTable, number>> = {};
    const track = (table: KySourceTable) =>
      <T extends { _creationTime: number; updatedAt?: number; deletedAt?: number; _id: string }>(rows: T[]): T[] => {
        sourceUpdatedAt[table] = newestSourceChange(rows);
        return live(rows);
      };
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
        .then(track("builds")),
      ctx.db
        .query("cosplayNodes")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("cosplayNodes")),
      ctx.db
        .query("workflowItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("workflowItems")),
      ctx.db
        .query("workflowAttachments")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("workflowAttachments")),
      ctx.db
        .query("conventions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("conventions")),
      ctx.db
        .query("conventionDayPlans")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("conventionDayPlans")),
      ctx.db
        .query("packingListItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
        .then(track("packingListItems")),
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
        .then(track("buildProgressUpdates")),
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
      accountId: userId,
      sourceUpdatedAt,
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

async function externalPhoto(
  url: string
): Promise<{ blob: Blob | null; failure?: KyStoredFile["failure"] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return { blob: null, failure: "missingImage" };
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > EXPORT_MAX_PHOTO_BYTES) return { blob: null, failure: "oversizeImage" };
        chunks.push(new Uint8Array(value));
      }
    } finally {
      await reader.cancel();
    }
    const blob = new Blob(chunks);
    if (!isCosappImage(new Uint8Array(await blob.slice(0, 12).arrayBuffer()))) {
      return { blob: null, failure: "unsupportedImage" };
    }
    return { blob };
  } catch {
    return { blob: null, failure: "missingImage" };
  } finally {
    clearTimeout(timeout);
  }
}

async function convert(ctx: ActionCtx): Promise<CosappExport> {
  const rows: KyarafitSnapshot = await ctx.runQuery(internal.cosappExport.snapshot, {});
  const options = { now: Date.now() };
  const references = convertKyarafitToCosapp(rows, options).photoSources;
  for (const source of references) {
    if (!/^https?:\/\//i.test(source)) continue;
    rows.storedFiles.push({ storageId: source, size: EXPORT_MAX_PHOTO_BYTES });
  }
  return convertKyarafitToCosapp(rows, options);
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
  args: { storageIds: v.array(v.string()), offset: v.optional(v.number()) },
  handler: async (
    ctx,
    { storageIds, offset = 0 }
  ): Promise<
    { storageId: string; bytes: ArrayBuffer | null; size: number; failure?: KyStoredFile["failure"] }[]
  > => {
    if (storageIds.length > MAX_PHOTOS_PER_CALL) throw new Error("Too many photos in one request");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= EXPORT_MAX_PHOTO_BYTES) {
      throw new Error("Invalid photo offset");
    }
    const rows: KyarafitSnapshot = await ctx.runQuery(internal.cosappExport.snapshot, {});
    const allowed = new Set(convertKyarafitToCosapp(rows, { now: Date.now() }).photoSources);
    for (const storageId of storageIds) {
      if (!allowed.has(storageId)) throw new Error("Photo not found");
    }
    const externalIds = [...new Set(storageIds)].filter((id) => /^https?:\/\//i.test(id));
    if (externalIds.length > MAX_EXTERNAL_PHOTOS_PER_CALL) {
      throw new Error("Too many external photos in one request");
    }
    const externalFiles = new Map(
      await Promise.all(externalIds.map(async (id) => [id, await externalPhoto(id)] as const))
    );
    const out: {
      storageId: string;
      bytes: ArrayBuffer | null;
      size: number;
      failure?: KyStoredFile["failure"];
    }[] = [];
    let total = 0;
    for (const storageId of new Set(storageIds)) {
      const fetched: { blob: Blob | null; failure?: KyStoredFile["failure"] } =
        /^https?:\/\//i.test(storageId)
          ? externalFiles.get(storageId)!
          : { blob: await ctx.storage.get(storageId as Id<"_storage">) };
      const { blob } = fetched;
      const failure =
        fetched.failure ??
        (!blob ? "missingImage" : blob.size > EXPORT_MAX_PHOTO_BYTES ? "oversizeImage" : undefined);
      const chunk =
        blob && blob.size <= EXPORT_MAX_PHOTO_BYTES
          ? blob.slice(offset, offset + PHOTO_BATCH_BYTES)
          : null;
      total += chunk?.size ?? 0;
      if (total > PHOTO_BATCH_BYTES) throw new Error("Too many photo bytes in one request");
      out.push({
        storageId,
        bytes: chunk ? await chunk.arrayBuffer() : null,
        size: blob?.size ?? 0,
        failure,
      });
    }
    return out;
  },
});
