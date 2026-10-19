import { Platform, Share } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { VAULT_ARCHIVE_EXTENSION, type ExportSummary } from "./archive";
import { activeVaultImageDir, requireActiveVault } from "./activeVault";
import {
  exportVault,
  importVault,
  type VaultImportSummary,
  type VaultPhotoFiles,
} from "./portability";
import { VaultLockedError, vaultKeyForSubject } from "@/offline/db";
import { getIsOnline } from "@/offline/connectivity";

/**
 * Device adapter for vault backups: streams the archive through an `expo-file-system` FileHandle
 * (one photo in memory at a time) and uses the OS pickers that ship with expo-file-system — no extra
 * native dependency.
 */

function vaultPhotoFiles(): VaultPhotoFiles {
  const store = requireActiveVault();
  const dir = activeVaultImageDir();
  if (!dir) throw new VaultLockedError();
  const imageDir = new Directory(dir);
  return {
    size: (key) => {
      requireActiveVault(store);
      const file = new File(imageDir, key);
      return file.exists ? file.size : null;
    },
    read: (key) => {
      requireActiveVault(store);
      return new File(imageDir, key).bytesSync();
    },
    write: (key, bytes) => {
      requireActiveVault(store);
      if (!imageDir.exists) imageDir.create({ intermediates: true, idempotent: true });
      const file = new File(imageDir, key);
      const temporary = new File(imageDir, `${key}.restore`);
      const previous = new File(imageDir, `${key}.previous`);
      if (temporary.exists) temporary.delete();
      temporary.create();
      try {
        temporary.write(bytes);
        if (temporary.size !== bytes.length) throw new Error("Incomplete photo write");
        if (file.exists) file.move(previous);
        const destination = new File(imageDir, key);
        try {
          temporary.move(destination);
        } catch (error) {
          if (previous.exists) previous.move(destination);
          throw error;
        }
        if (previous.exists) previous.delete();
      } catch (error) {
        const unfinished = new File(imageDir, `${key}.restore`);
        if (unfinished.exists) unfinished.delete();
        throw error;
      }
    },
  };
}

function backupFileName(now: Date, account: string): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `kyarafit-backup-${stamp}-${account}-${randomUUID()}${VAULT_ARCHIVE_EXTENSION}`;
}

export interface WrittenBackup {
  uri: string;
  summary: ExportSummary;
}

/** Write the whole unlocked vault (rows + photo originals) to a backup file in the app cache. */
export async function writeVaultBackup(
  resolveUrl: (storageId: string) => Promise<string | null>,
  now = new Date()
): Promise<WrittenBackup> {
  const store = requireActiveVault();
  const assertCurrent = () => {
    requireActiveVault(store);
  };
  const photos = vaultPhotoFiles();
  const account = vaultKeyForSubject(store.subject);
  const dir = new Directory(Paths.cache, "backups", account);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, backupFileName(now, account));
  file.create();
  const handle = file.open();
  let summary: ExportSummary;
  try {
    summary = await exportVault(
      store,
      photos,
      {
        write: (bytes) => {
          assertCurrent();
          handle.writeBytes(bytes);
        },
      },
      {
        online: getIsOnline,
        assertCurrent,
        download: async (storageId) => {
          assertCurrent();
          const url = await resolveUrl(storageId);
          assertCurrent();
          if (!url || !getIsOnline()) return null;
          const response = await fetch(url);
          assertCurrent();
          if (!response.ok) return null;
          const bytes = await response.arrayBuffer();
          assertCurrent();
          return new Uint8Array(bytes);
        },
      },
      now.getTime()
    );
    assertCurrent();
  } catch (error) {
    // Never leave a half-written backup behind that could later be mistaken for a complete one.
    handle.close();
    file.delete();
    throw error;
  }
  handle.close();
  return { uri: file.uri, summary };
}

/**
 * Hand a backup file to the user: the share sheet on iOS (Save to Files, AirDrop, …); a folder
 * picker on Android, where the file is copied. Resolves false if the user cancelled.
 */
export async function deliverVaultBackup(uri: string, title: string): Promise<boolean> {
  if (Platform.OS === "android") {
    let target: Directory;
    try {
      target = await Directory.pickDirectoryAsync();
    } catch {
      return false;
    }
    new File(uri).copy(target);
    return true;
  }
  const result = await Share.share({ url: uri, title });
  return result.action !== Share.dismissedAction;
}

/** Remove a delivered backup from the app cache (the user's copy lives wherever they saved it). */
export function discardVaultBackup(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn("[vault] could not remove a delivered backup from the cache", error);
  }
}

/** Let the user pick a backup file and merge it into the unlocked vault. Null if cancelled. */
export async function pickAndImportVaultBackup(): Promise<VaultImportSummary | null> {
  const store = requireActiveVault();
  let picked: File | File[];
  try {
    picked = await File.pickFileAsync();
  } catch {
    return null;
  }
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return null;
  requireActiveVault(store);
  const photos = vaultPhotoFiles();
  const handle = file.open();
  try {
    let remainingBytes = file.size;
    return importVault(store, photos, {
      get remainingBytes() {
        return remainingBytes;
      },
      read: (length) => {
        const bytes = handle.readBytes(length);
        remainingBytes -= bytes.length;
        return bytes;
      },
    });
  } finally {
    handle.close();
  }
}
