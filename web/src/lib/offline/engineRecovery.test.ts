import { afterEach, expect, it, vi } from "vitest";
import { InMemoryLocalStore } from "./localStore";

const state = vi.hoisted(() => ({
  stores: new Map<string, unknown>(),
  legacyUnavailable: true,
}));
vi.mock("./indexedDbStore", () => ({
  IndexedDbLocalStore: class {
    constructor(name = "kyarafit-offline") {
      return state.stores.get(name) as object;
    }
  },
}));
vi.mock("./waSqliteStore", () => ({
  isWaSqliteOpfsSupported: () => true,
  WaSqliteLocalStore: class {
    constructor(accountKey?: string) {
      return Object.assign(state.stores.get("opfs") as object, {
        init: async () => {
          if (accountKey || state.legacyUnavailable) throw new Error("WASM unavailable");
        },
      });
    }
  },
}));
import { createBrowserLocalStore } from "./engineSelection";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps the account vault usable and retries incomplete OPFS recovery later", async () => {
  vi.stubGlobal("indexedDB", {});
  const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const account = new InMemoryLocalStore();
  const legacy = new InMemoryLocalStore();
  const opfs = new InMemoryLocalStore();
  state.stores.set("kyarafit-offline-41", account);
  state.stores.set("kyarafit-offline", legacy);
  state.stores.set("opfs", opfs);
  await account.putEntityRow({
    table: "builds",
    id: "saved",
    userId: "A",
    json: "{}",
    updatedAt: 1,
    deleted: false,
    synced: false,
  });
  await opfs.putEntityRow({
    table: "builds",
    id: "old",
    userId: "A",
    json: "{}",
    updatedAt: 1,
    deleted: false,
    synced: false,
  });
  expect(await createBrowserLocalStore("A")).toBe(account);
  expect((await account.listEntityRows()).map((row) => row.id)).toEqual(["saved"]);
  expect(await account.getMeta("legacy-adopted:opfs")).toBeNull();
  expect(alert).toHaveBeenCalledOnce();
  state.legacyUnavailable = false;
  expect(await createBrowserLocalStore("A")).toBe(account);
  expect((await account.listEntityRows()).map((row) => row.id)).toEqual(["saved", "old"]);
  expect(await account.getMeta("legacy-adopted:opfs")).toBe("1");
});
