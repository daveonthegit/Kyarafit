/**
 * On-device photo store for the unlocked vault (PRODUCT_SPEC.md §3.1, REQ-011).
 *
 * Every photo the user attaches is first copied into the vault's own directory
 * (`<documents>/vaults/<vaultKey>/images/<imageKey>`) and the entity stores that durable `file://`
 * URI — never a picker cache path and never an upload result. This is what makes photo flows work
 * offline for everyone; only the paid sync worker later mirrors local photos to the cloud.
 *
 * Vault documents persist photos as portable `kyarafit-image:<imageKey>` tokens (see
 * `@/vault/images`), so the same data survives an iOS container move and travels in exports.
 *
 * Uses `expo-file-system/legacy` to match the rest of the app.
 */
import * as FileSystem from "expo-file-system/legacy";
import { useCallback } from "react";
import type { VaultStore } from "@/vault/store";
import { useActiveVault } from "@/vault/hooks";
import { localImageRef, type ImageRef } from "@kyarafit/design-system/domain/imageRef";
import { activeVaultImageDir, getActiveVault, requireActiveVault } from "@/vault/activeVault";
import { VaultLockedError } from "@/offline/db";

function requireImageDir(): string {
  const dir = activeVaultImageDir();
  if (!dir) throw new VaultLockedError();
  return dir;
}

/** Absolute on-device path for an `imageKey` in the unlocked vault, or null when locked. */
export function localImagePath(imageKey: string): string | null {
  const dir = activeVaultImageDir();
  return dir ? `${dir}${imageKey}` : null;
}

function generateImageKey(): string {
  const rand =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `img_${rand}`;
}

async function ensureImageDir(vault: VaultStore): Promise<string> {
  requireActiveVault(vault);
  const dir = requireImageDir();
  const info = await FileSystem.getInfoAsync(dir);
  requireActiveVault(vault);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    requireActiveVault(vault);
  }
  return dir;
}

export interface SavedLocalImage {
  imageKey: string;
  /** Durable `file://` uri for display and for the entity's `imageUrl`. */
  uri: string;
  /** The `local` `ImageRef` to persist on entities that carry `imageRefs`. */
  ref: ImageRef;
}

/**
 * Copy a picked image (e.g. from `expo-image-picker`) into the vault under a fresh `imageKey`.
 * Throws when the vault is locked or the copy fails — callers must surface that and keep the draft.
 */
export async function saveLocalImage(
  sourceUri: string,
  opts: { imageKey?: string } = {},
  expectedVault: VaultStore | null = getActiveVault()
): Promise<SavedLocalImage> {
  const vault = requireActiveVault(expectedVault);
  const imageKey = opts.imageKey ?? generateImageKey();
  const dir = await ensureImageDir(vault);
  requireActiveVault(vault);
  const target = `${dir}${imageKey}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  requireActiveVault(vault);
  return { imageKey, uri: target, ref: localImageRef(target, imageKey) };
}

export function useSaveLocalImage() {
  const vault = useActiveVault();
  return useCallback(
    (uri: string, opts: { imageKey?: string } = {}) => saveLocalImage(uri, opts, vault),
    [vault]
  );
}

/** Write base64 bytes (vault import) to `imageKey` in the unlocked vault; returns the file URI. */
export async function writeLocalImageBase64(imageKey: string, base64: string): Promise<string> {
  const vault = requireActiveVault();
  const dir = await ensureImageDir(vault);
  requireActiveVault(vault);
  const target = `${dir}${imageKey}`;
  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  requireActiveVault(vault);
  return target;
}

/** Resolve a stored image's `file://` uri, or null when the key is unknown / missing on disk. */
export async function getLocalImageUri(imageKey: string): Promise<string | null> {
  const vault = getActiveVault();
  const target = localImagePath(imageKey);
  if (!target) return null;
  const info = await FileSystem.getInfoAsync(target);
  requireActiveVault(vault);
  return info.exists ? target : null;
}

/** Delete a stored local image. Idempotent: deleting an unknown key is a no-op. */
export async function deleteLocalImage(imageKey: string): Promise<void> {
  const vault = getActiveVault();
  const target = localImagePath(imageKey);
  if (!target) return;
  await FileSystem.deleteAsync(target, { idempotent: true });
  requireActiveVault(vault);
}

/** All stored local `imageKey`s in the unlocked vault. */
export async function listLocalImages(): Promise<string[]> {
  const vault = getActiveVault();
  const dir = activeVaultImageDir();
  if (!dir) return [];
  const info = await FileSystem.getInfoAsync(dir);
  requireActiveVault(vault);
  if (!info.exists) return [];
  const keys = await FileSystem.readDirectoryAsync(dir);
  requireActiveVault(vault);
  return keys;
}
