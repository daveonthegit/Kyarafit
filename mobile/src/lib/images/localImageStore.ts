/**
 * Mobile on-device local image store (PRODUCT_SPEC.md §3.1, REQ-011). FREE users keep image binaries
 * LOCALLY on the device indefinitely — no cloud upload — and those binaries are included in export.
 *
 * A picked image is copied into the app's document directory under a stable `imageKey`; the returned
 * `file://` uri is the durable display source. The persisted `local` `ImageRef` carries both the
 * `uri` (for display) and the `imageKey` (the durable handle to re-resolve / delete the file).
 *
 * Uses `expo-file-system/legacy` to match the rest of the app (see `settings/data.tsx`, `offline/db`).
 */
import * as FileSystem from "expo-file-system/legacy";
import { localImageRef, type ImageRef } from "@kyarafit/design-system/domain/imageRef";

/** Sub-directory of the document dir that holds local image binaries. */
const LOCAL_IMAGE_DIRNAME = "local-images";

function documentDir(): string | null {
  return FileSystem.documentDirectory ?? null;
}

function imageDir(): string | null {
  const docs = documentDir();
  return docs ? `${docs}${LOCAL_IMAGE_DIRNAME}/` : null;
}

/** Absolute on-device path for an `imageKey` (no extension; RN Image loads any `file://`). */
export function localImagePath(imageKey: string): string | null {
  const dir = imageDir();
  return dir ? `${dir}${imageKey}` : null;
}

function generateImageKey(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `local_${rand}`;
}

async function ensureImageDir(): Promise<string> {
  const dir = imageDir();
  if (!dir) throw new Error("Document directory unavailable");
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export interface SavedLocalImage {
  imageKey: string;
  /** Durable `file://` uri for display. */
  uri: string;
  /** The `local` `ImageRef` to persist on the entity. */
  ref: ImageRef;
}

/**
 * Copy a picked image (e.g. from `expo-image-picker`) into the app document dir under a fresh
 * `imageKey` and return its durable `file://` uri + `local` `ImageRef`.
 */
export async function saveLocalImage(
  sourceUri: string,
  opts: { imageKey?: string } = {}
): Promise<SavedLocalImage> {
  const imageKey = opts.imageKey ?? generateImageKey();
  await ensureImageDir();
  const target = localImagePath(imageKey);
  if (!target) throw new Error("Document directory unavailable");
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return { imageKey, uri: target, ref: localImageRef(target, imageKey) };
}

/** Resolve a stored image's `file://` uri, or null when the key is unknown / missing on disk. */
export async function getLocalImageUri(imageKey: string): Promise<string | null> {
  const target = localImagePath(imageKey);
  if (!target) return null;
  const info = await FileSystem.getInfoAsync(target);
  return info.exists ? target : null;
}

/** Delete a stored local image. Idempotent: deleting an unknown key is a no-op. */
export async function deleteLocalImage(imageKey: string): Promise<void> {
  const target = localImagePath(imageKey);
  if (!target) return;
  await FileSystem.deleteAsync(target, { idempotent: true });
}

/** All stored local `imageKey`s (filenames in the local-images dir). */
export async function listLocalImages(): Promise<string[]> {
  const dir = imageDir();
  if (!dir) return [];
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return [];
  return FileSystem.readDirectoryAsync(dir);
}
