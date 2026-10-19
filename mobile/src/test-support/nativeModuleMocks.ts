import { randomUUID } from "node:crypto";
import { vi } from "vitest";

/**
 * Lightweight stand-ins for native Expo / RN modules that the vault reaches transitively (Expo
 * modules import react-native's untranspiled Flow sources, which vitest cannot parse). Loaded for
 * every mobile test via `setupFiles`; a test that needs specific behavior still `vi.mock`s the module
 * itself, which takes precedence.
 */

vi.mock("expo-crypto", () => ({ randomUUID: () => randomUUID() }));

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
    },
  };
});

vi.mock("expo-sqlite", async () => {
  const { NodeSqliteDatabase } = await import("./nodeSqlite");
  const files = new Map<string, InstanceType<typeof NodeSqliteDatabase>>();
  return {
    openDatabaseSync: (name: string) => {
      let db = files.get(name);
      if (!db) {
        db = new NodeSqliteDatabase();
        files.set(name, db);
      }
      // Reopening returns the same in-memory database; closing is a no-op so data persists like a file.
      return Object.assign(Object.create(db), { closeSync: () => {} });
    },
    deleteDatabaseSync: (name: string) => {
      files.delete(name);
    },
  };
});

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64", UTF8: "utf8" },
  getInfoAsync: vi.fn(async () => ({ exists: false })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  copyAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async () => undefined),
  readDirectoryAsync: vi.fn(async () => []),
  writeAsStringAsync: vi.fn(async () => undefined),
  readAsStringAsync: vi.fn(async () => ""),
}));

vi.mock("expo-file-system", () => ({
  File: class {},
  Directory: class {},
  Paths: { cache: {}, document: {} },
}));

vi.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItemAsync: async (key: string) => items.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      items.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      items.delete(key);
    },
  };
});
