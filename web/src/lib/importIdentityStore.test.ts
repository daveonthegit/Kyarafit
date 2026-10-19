import { expect, it, vi } from "vitest";
import { createImportIdentityStore } from "./importIdentityStore";
import { offlineRuntime } from "./offline/runtime";
import { InMemoryLocalStore } from "./offline/localStore";

it("persists source identities across relaunch and isolates them by account", async () => {
  const a = new InMemoryLocalStore();
  offlineRuntime.setStore(a, "A");
  const identities = createImportIdentityStore("A");
  const identity = { id: "server-node", complete: false, row: { id: "backup-node" } };
  await identities.write("cosplayNodes", "backup-node", identity);
  offlineRuntime.lock();
  offlineRuntime.setStore(a, "A");
  expect(await createImportIdentityStore("A").read("cosplayNodes", "backup-node")).toEqual(identity);
  offlineRuntime.setStore(new InMemoryLocalStore(), "B");
  expect(await createImportIdentityStore("B").read("cosplayNodes", "backup-node")).toBeNull();
  await expect(identities.read("cosplayNodes", "backup-node")).rejects.toThrow("account changed");
});

it("rejects unreadable or unwritable import metadata instead of treating it as a fresh import", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const identities = createImportIdentityStore("A");
  vi.spyOn(store, "getMeta").mockRejectedValueOnce(new Error("disk error"));
  await expect(identities.read("cosplayNodes", "source")).rejects.toThrow("disk error");
  vi.spyOn(store, "setMeta").mockRejectedValueOnce(new Error("disk full"));
  await expect(identities.write("cosplayNodes", "source", {
    id: "destination", complete: false, row: { id: "source" },
  })).rejects.toThrow("disk full");
});
