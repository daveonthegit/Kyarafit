import {
  readVaultArchiveImages,
  readVaultArchiveManifest,
  writeVaultArchive,
  VaultArchiveError,
  type SizedByteReader,
  type ByteWriter,
  type ExportSummary,
} from "./archive";
import { collectVaultPhotos, localizeVaultPhotos } from "./images";
import type { ImportRowsResult, VaultStore } from "./store";

/**
 * Whole-vault export / import, platform-independent (the device adapter supplies the byte streams
 * and the photo directory). Free for everyone: nothing here looks at tier.
 */

/** The vault's photo directory, by image key. */
export interface VaultPhotoFiles {
  /** Size in bytes, or null when the photo is not on this device. */
  size(key: string): number | null;
  read(key: string): Uint8Array;
  write(key: string, bytes: Uint8Array): void;
}

export interface VaultImportSummary {
  rows: ImportRowsResult;
  rowsOmitted: number;
  photosWritten: number;
  photosAlreadyPresent: number;
  /** Photos the backup referenced but could not supply or that failed to save here. */
  photosMissing: string[];
}

export interface CloudPhotoSource {
  online(): boolean;
  download(storageId: string): Promise<Uint8Array | null>;
  assertCurrent(): void;
}

export async function exportVault(
  store: VaultStore,
  photos: VaultPhotoFiles,
  writer: ByteWriter,
  cloud?: CloudPhotoSource,
  now = Date.now()
): Promise<ExportSummary> {
  cloud?.assertCurrent();
  let rowsOmitted = 0;
  const rows = store.exportRows(() => {
    rowsOmitted += 1;
  });
  const references = collectVaultPhotos(rows);
  for (const photo of references.values()) {
    cloud?.assertCurrent();
    if (!cloud || !photo.storageId || photos.size(photo.key) !== null || !cloud.online()) continue;
    let bytes: Uint8Array | null;
    try {
      bytes = await cloud.download(photo.storageId);
    } catch {
      cloud.assertCurrent();
      continue;
    }
    cloud.assertCurrent();
    if (bytes) photos.write(photo.key, bytes);
  }
  cloud?.assertCurrent();
  const available = new Set([...references.keys()].filter((key) => photos.size(key) !== null));
  return writeVaultArchive(
    {
      subject: store.subject,
      now,
      rows: localizeVaultPhotos(rows, available),
      rowsOmitted,
      imageSize: (key) => photos.size(key),
      readImage: (key) => photos.read(key),
    },
    writer
  );
}

/**
 * Import a backup into the unlocked vault. Photos are copied first; the rows are then committed in
 * one transaction, so a damaged or truncated file throws before any row changes. Importing the same
 * backup twice changes nothing the second time. Missing photos are reported, never hidden.
 */
export function importVault(
  store: VaultStore,
  photos: VaultPhotoFiles,
  reader: SizedByteReader
): VaultImportSummary {
  const manifest = readVaultArchiveManifest(reader);
  const imageBytes = manifest.images.reduce((total, image) => total + image.size, 0);
  if (!Number.isSafeInteger(imageBytes) || imageBytes !== reader.remainingBytes) {
    throw new VaultArchiveError("This Kyarafit backup has damaged photo lengths");
  }
  let photosWritten = 0;
  let photosAlreadyPresent = 0;
  const photosMissing = [...manifest.missingImages];
  readVaultArchiveImages(reader, manifest, (key, bytes) => {
    if (photos.size(key) === bytes.length) {
      photosAlreadyPresent += 1;
      return;
    }
    try {
      photos.write(key, bytes);
      photosWritten += 1;
    } catch (error) {
      console.warn(`[vault] could not restore photo ${key}`, error);
      photosMissing.push(key);
    }
  });
  const available = new Set(
    manifest.images.map((image) => image.key).filter((key) => photos.size(key) !== null)
  );
  const rows = store.importRows(manifest.rows, manifest.source.subject, available);
  return {
    rows,
    rowsOmitted: rows.unknown + manifest.rowsOmitted,
    photosWritten,
    photosAlreadyPresent,
    photosMissing,
  };
}
