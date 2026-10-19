import * as FileSystem from "expo-file-system/legacy";
import { afterEach, expect, it, vi } from "vitest";
import {
  deleteVaultDatabase,
  openVaultDatabase,
  vaultExportFilePath,
  vaultKeyForSubject,
} from "./db";
import { lockVault } from "@/vault/activeVault";

const files = new Map<string, string>();
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  cacheDirectory: "file:///cache/",
  writeAsStringAsync: async (path: string, value: string) => {
    files.set(path, value);
  },
  readAsStringAsync: async (path: string) => files.get(path),
  deleteAsync: async (path: string) => {
    files.delete(path);
  },
}));

afterEach(async () => {
  await deleteVaultDatabase("export-a");
  await deleteVaultDatabase("export-b");
  files.clear();
});

it("keeps exports on sign-out and removes only the deleted account's generated file", async () => {
  const a = vaultExportFilePath("export-a")!;
  const b = vaultExportFilePath("export-b")!;
  expect(a).not.toBe(b);
  openVaultDatabase("export-a");
  await FileSystem.writeAsStringAsync(a, "private-a");
  await FileSystem.writeAsStringAsync(b, "private-b");
  await lockVault();
  expect(await FileSystem.readAsStringAsync(a)).toBe("private-a");
  const backups = `file:///cache/backups/${vaultKeyForSubject("export-a")}/`;
  files.set(backups, "pending backup folder");
  await deleteVaultDatabase("export-a");
  expect(await FileSystem.readAsStringAsync(a)).toBeUndefined();
  expect(files.has(backups)).toBe(false);
  expect(await FileSystem.readAsStringAsync(b)).toBe("private-b");
});
