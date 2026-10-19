import { expect, it, vi } from "vitest";
import { createImportIdentityStore } from "./importIdentityStore";
import { emptyCollections, NonEmptyVaultError, runImport, type CreateRowFn } from "./dataPortability";
import { readLocalCollections } from "./localFirstData";
import { offlineRuntime } from "./offline/runtime";
import { InMemoryLocalStore } from "./offline/localStore";

it("resumes only the same interrupted backup and isolates attempts by account", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const imported = { ...emptyCollections(), cosplayNodes: [{ id: "backup-node", nodeType: "element" }] };
  const identities = createImportIdentityStore("A");
  await identities.begin(imported, emptyCollections());
  const key = identities.key("cosplayNodes", "backup-node");
  const identity = { id: "server-node", complete: false, row: imported.cosplayNodes[0] };
  await identities.write("cosplayNodes", "backup-node", identity);
  offlineRuntime.lock();
  offlineRuntime.setStore(store, "A");
  await offlineRuntime.hydrate();
  const resumed = createImportIdentityStore("A");
  await resumed.begin(imported, readLocalCollections("A"));
  expect(resumed.key("cosplayNodes", "backup-node")).toBe(key);
  expect(await resumed.read("cosplayNodes", "backup-node")).toEqual(identity);
  await expect(createImportIdentityStore("A").begin(emptyCollections(), readLocalCollections("A"))).rejects.toThrow(NonEmptyVaultError);
  offlineRuntime.setStore(new InMemoryLocalStore(), "B");
  const b = createImportIdentityStore("B");
  await b.begin(imported, emptyCollections());
  expect(await b.read("cosplayNodes", "backup-node")).toBeNull();
  await expect(resumed.read("cosplayNodes", "backup-node")).rejects.toThrow("account changed");
});

it("starts a fresh attempt after a completed restore has been explicitly emptied", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const imported = { ...emptyCollections(), builds: [{ id: "source" }] };
  const first = createImportIdentityStore("A");
  await first.begin(imported, emptyCollections());
  const oldKey = first.key("builds", "source");
  await first.write("builds", "source", { id: "old", complete: true, row: { id: "source" } });
  await first.finish();
  await store.deleteEntityRow("builds", "old");
  offlineRuntime.setStore(store, "A");
  await offlineRuntime.hydrate();
  const next = createImportIdentityStore("A");
  await next.begin(imported, readLocalCollections("A"));
  expect(next.key("builds", "source")).not.toBe(oldKey);
  expect(await next.read("builds", "source")).toBeNull();
});

it("normalizes every persisted identity and nested reference through the current account ID map", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const ledger = createImportIdentityStore("A");
  await ledger.begin(emptyCollections(), emptyCollections());
  await ledger.write("packingListItems", "local:source", {
    id: "local:pack", complete: false,
    row: { id: "local:source", conventionId: "local:con", buildId: "local:build", parentId: "local:parent",
      workflowItemId: "local:workflow", attachments: [
        { entityType: "cosplayNode", entityId: "local:node", buildContextId: "local:build" },
      ] },
  });
  for (const name of ["source", "pack", "con", "build", "parent", "workflow", "node"]) {
    await store.setServerId(`local:${name}`, `server:${name}`);
  }
  expect(await ledger.read("packingListItems", "local:source")).toEqual({
    id: "server:pack", complete: false,
    row: { id: "local:source", conventionId: "server:con", buildId: "server:build", parentId: "server:parent",
      workflowItemId: "server:workflow", attachments: [
        { entityType: "cosplayNode", entityId: "server:node", buildContextId: "server:build" },
      ] },
  });
});

it("retries an interrupted offline restore after its build has replayed, without creating another build", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const imported = {
    ...emptyCollections(), builds: [{ id: "source-build" }],
    workflowItems: [{ id: "source-task", attachments: [{ entityType: "build", entityId: "source-build" }] }],
  };
  const first = vi.fn((collection: string) => {
    if (collection === "builds") return "local:build";
    throw new Error("disk full");
  });
  await expect(runImport({ imported, existing: emptyCollections(), createRow: first,
    identities: createImportIdentityStore("A") })).rejects.toThrow("disk full");
  await store.setServerId("local:build", "server-build");
  await store.deleteEntityRow("builds", "local:build");
  await store.putEntityRow({ table: "builds", id: "server-build", userId: "A",
    json: JSON.stringify({ _id: "server-build", userId: "A" }), updatedAt: 1, deleted: false, synced: true });
  offlineRuntime.setStore(store, "A");
  await offlineRuntime.hydrate();
  const retry = vi.fn<CreateRowFn>((_collection, row) => {
    expect(row.attachments).toEqual([expect.objectContaining({ entityId: "server-build" })]);
    return "server-task";
  });
  await runImport({ imported, existing: readLocalCollections("A"), createRow: retry,
    identities: createImportIdentityStore("A") });
  expect(retry).toHaveBeenCalledOnce();
  expect(first.mock.calls.filter(([key]) => key === "builds")).toHaveLength(1);
  expect(readLocalCollections("A").builds).toHaveLength(1);
  await expect(runImport({ imported, existing: readLocalCollections("A"), createRow: retry,
    identities: createImportIdentityStore("A") })).rejects.toThrow(NonEmptyVaultError);
  expect(retry).toHaveBeenCalledOnce();
});

it("refuses unrelated local data added during an interrupted restore without any further writes", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const imported = { ...emptyCollections(), builds: [{ id: "source" }], workflowItems: [{ id: "task" }] };
  await expect(runImport({ imported, existing: emptyCollections(),
    identities: createImportIdentityStore("A"), createRow: (key) => {
      if (key === "builds") return "destination";
      throw new Error("interrupted");
    } })).rejects.toThrow("interrupted");
  await store.putEntityRow({ table: "conventions", id: "unrelated", userId: "A", json: "{}",
    updatedAt: 1, deleted: false, synced: true });
  const before = await store.getMeta("restore:active:v1");
  const createRow = vi.fn();
  await expect(runImport({ imported, existing: readLocalCollections("A"), createRow,
    identities: createImportIdentityStore("A") })).rejects.toThrow(NonEmptyVaultError);
  expect(createRow).not.toHaveBeenCalled();
  expect(await store.getMeta("restore:active:v1")).toBe(before);
});

it("reports deleted completed destinations during an interrupted restore rather than manufacturing skips", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const imported = { ...emptyCollections(), builds: [{ id: "source" }], workflowItems: [{ id: "task" }] };
  await expect(runImport({ imported, existing: emptyCollections(),
    identities: createImportIdentityStore("A"), createRow: (key) => {
      if (key === "builds") return "destination";
      throw new Error("interrupted");
    } })).rejects.toThrow("interrupted");
  await store.deleteEntityRow("builds", "destination");
  offlineRuntime.setStore(store, "A");
  await offlineRuntime.hydrate();
  const createRow = vi.fn();
  await expect(runImport({ imported, existing: readLocalCollections("A"), createRow,
    identities: createImportIdentityStore("A") })).rejects.toThrow("restored data is missing");
  expect(createRow).not.toHaveBeenCalled();
});

it("rejects unreadable or unwritable restore metadata rather than starting an untracked import", async () => {
  const store = new InMemoryLocalStore();
  offlineRuntime.setStore(store, "A");
  const identities = createImportIdentityStore("A");
  vi.spyOn(store, "getMeta").mockRejectedValueOnce(new Error("disk error"));
  await expect(identities.begin(emptyCollections(), emptyCollections())).rejects.toThrow("disk error");
  await identities.begin(emptyCollections(), emptyCollections());
  vi.spyOn(store, "setMeta").mockRejectedValueOnce(new Error("disk full"));
  await expect(identities.write("cosplayNodes", "source", {
    id: "destination", complete: false, row: { id: "source" },
  })).rejects.toThrow("disk full");
});
