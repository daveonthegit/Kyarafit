import type { ConvexReactClient } from "convex/react";
import { strToU8, zipSync } from "fflate";
import { api } from "convex/_generated/api";
import {
  COSAPP_BACKUP_EXTENSION,
  COSAPP_RECEIPT_ENTRY,
  PHOTO_BATCH_BYTES,
  isCosappImage,
  planPhotoBatches,
  withoutPhotoFiles,
  type CosappExport,
  type CosappReceipt,
} from "@kyarafit/design-system/domain/cosappExport";

/**
 * Builds the "Download for Cosapp.si" file in the browser from what the server's
 * `cosappExport` actions return. The layout is Cosapp.si's own backup: `data.json` plus
 * `photos/<fileName>` for every live photo row, stored uncompressed (photos are already
 * compressed), plus a `kyarafit-receipt.json` that Cosapp.si's import ignores.
 */

export type CosappExportClient = Pick<ConvexReactClient, "action">;

export interface CosappDownload {
  fileName: string;
  bytes: Uint8Array;
  receipt: CosappReceipt;
}

/** Zip a converted export and its photo bytes (keyed by photo file name). */
export function encodeCosappArchive(
  result: CosappExport,
  photos: Map<string, Uint8Array>
): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    "data.json": strToU8(JSON.stringify(result.data)),
    [COSAPP_RECEIPT_ENTRY]: strToU8(JSON.stringify(result.receipt, null, 2)),
  };
  for (const file of result.photoFiles) {
    const bytes = photos.get(file.fileName);
    if (!bytes) throw new Error(`Missing photo: ${file.fileName}`);
    entries[`photos/${file.fileName}`] = bytes;
  }
  return zipSync(entries, { level: 0 });
}

export function cosappFileName(now: Date): string {
  return `kyarafit-for-cosapp-${now.toISOString().slice(0, 10)}.${COSAPP_BACKUP_EXTENSION}`;
}

/** Fetch the signed-in account's export and its photos, and build the `.cosapp` file. */
export async function buildCosappDownload(
  client: CosappExportClient,
  {
    signal,
    onProgress,
    now = new Date(),
  }: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    now?: Date;
  } = {}
): Promise<CosappDownload> {
  let result = await client.action(api.cosappExport.prepare, {});
  signal?.throwIfAborted();
  const batches = planPhotoBatches(result.photoFiles, PHOTO_BATCH_BYTES);
  const byStorage = new Map<string, Uint8Array>();
  const sizes = new Map(result.photoFiles.map((file) => [file.storageId, file.size]));
  const failed = new Map<string, "missingImage" | "unsupportedImage" | "oversizeImage">();
  onProgress?.(0, batches.length);
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    let size = Math.max(...batch.map((id) => sizes.get(id)!));
    for (let offset = 0; offset < size; offset += PHOTO_BATCH_BYTES) {
      const served = await client.action(api.cosappExport.photoBytes, {
        storageIds: batch.filter((id) => !failed.has(id) && sizes.get(id)! > offset),
        offset,
      });
      signal?.throwIfAborted();
      for (const { storageId, bytes, size: servedSize, failure } of served) {
        if (servedSize !== undefined) sizes.set(storageId, servedSize);
        if (!bytes) {
          failed.set(storageId, failure ?? "missingImage");
          continue;
        }
        const prior = byStorage.get(storageId);
        const combined = new Uint8Array((prior?.length ?? 0) + bytes.byteLength);
        if (prior) combined.set(prior);
        combined.set(new Uint8Array(bytes), prior?.length ?? 0);
        byStorage.set(storageId, combined);
      }
      size = Math.max(0, ...batch.filter((id) => !failed.has(id)).map((id) => sizes.get(id)!));
    }
    onProgress?.(index + 1, batches.length);
  }
  const photos = new Map<string, Uint8Array>();
  const missing = new Set<string>();
  const notImages = new Set<string>();
  const oversized = new Set<string>();
  for (const file of result.photoFiles) {
    const bytes = byStorage.get(file.storageId);
    const failure = failed.get(file.storageId);
    if (failure === "unsupportedImage") notImages.add(file.fileName);
    else if (failure === "oversizeImage") oversized.add(file.fileName);
    else if (!bytes || failure) missing.add(file.fileName);
    else if (!isCosappImage(bytes)) notImages.add(file.fileName);
    else photos.set(file.fileName, bytes);
  }
  result = withoutPhotoFiles(
    withoutPhotoFiles(withoutPhotoFiles(result, missing), notImages, "unsupportedImage"),
    oversized,
    "oversizeImage"
  );
  return {
    fileName: cosappFileName(now),
    bytes: encodeCosappArchive(result, photos),
    receipt: result.receipt,
  };
}
