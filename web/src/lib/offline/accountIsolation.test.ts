import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { InMemoryLocalStore } from "./localStore";
import { offlineRuntime } from "./runtime";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, warmEntityRows } from "./syncWorker";
import { readLocalCollections } from "../localFirstData";

beforeEach(() => {
  setOfflineConnectivity(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("account-bound local web storage", () => {
  it("preserves complete owned documents through partial offline edits and relaunch", async () => {
    const store = new InMemoryLocalStore();
    await store.putEntityRow({
      table: "builds",
      id: "b1",
      userId: "A",
      json: JSON.stringify({
        _id: "b1",
        userId: "A",
        name: "Zelda",
        notes: "Keep",
        status: "idea",
      }),
      updatedAt: 1,
      deleted: false,
      synced: true,
    });
    offlineRuntime.setStore(store, "A");
    await offlineRuntime.hydrate();
    await offlineRuntime.commitCommand(
      {
        fn: "builds:updateStatusMany",
        argsJson: "{}",
        idempotencyKey: "status",
        clientId: null,
      },
      [{ table: "builds", id: "b1", doc: { _id: "b1", status: "wip" }, deleted: false }]
    );
    await offlineRuntime.writeEntityOverlay("builds", "b1", "", { notes: "Edited" }, false);
    offlineRuntime.lock();
    offlineRuntime.setStore(store, "A");
    await offlineRuntime.hydrate();
    expect(readLocalCollections("A").builds).toEqual([
      expect.objectContaining({ id: "b1", name: "Zelda", notes: "Edited", status: "wip" }),
    ]);
    expect(readLocalCollections("B").builds).toEqual([]);
    expect((await store.listEntityRows())[0].userId).toBe("A");
  });
  it("locks without deleting rows or queue and filters exports by account", async () => {
    const a = new InMemoryLocalStore();
    offlineRuntime.setStore(a, "A");
    await offlineRuntime.writeEntityOverlay("builds", "a", "A", { _id: "a", userId: "A" }, false);
    await offlineRuntime.writeEntityOverlay(
      "builds",
      "foreign",
      "B",
      { _id: "foreign", userId: "B" },
      false
    );
    await offlineRuntime.enqueueMutation("builds:create", { name: "A" }, "key-a");
    expect(readLocalCollections("A").builds.map((row) => row.id)).toEqual(["a"]);
    offlineRuntime.lock();
    expect(readLocalCollections("A").builds).toEqual([]);
    await expect(offlineRuntime.enqueueMutation("builds:create", {}, "locked")).rejects.toThrow(
      "locked"
    );
    offlineRuntime.setStore(new InMemoryLocalStore(), "B");
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
    expect(readLocalCollections("B").builds).toEqual([]);
    offlineRuntime.setStore(a, "A");
    await offlineRuntime.hydrate();
    expect(readLocalCollections("A").builds.map((row) => row.id)).toEqual(["a"]);
    expect(await offlineRuntime.listPendingMutations()).toHaveLength(1);
  });

  it("rejects failed enqueue instead of acknowledging persistence", async () => {
    const store = new InMemoryLocalStore();
    vi.spyOn(store, "enqueueMutation").mockRejectedValue(new Error("disk full"));
    offlineRuntime.setStore(store, "A");
    await expect(offlineRuntime.enqueueMutation("builds:create", {}, "key")).rejects.toThrow(
      "disk full"
    );
    expect(await offlineRuntime.listPendingMutations()).toEqual([]);
  });

  it("discards a response received after switching accounts", async () => {
    offlineRuntime.setStore(new InMemoryLocalStore(), "A");
    let resolve!: (result: unknown) => void;
    const client = {
      query: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      ),
    } as unknown as ConvexReactClient;
    const warming = warmEntityRows(client);
    await vi.waitFor(() => expect(client.query).toHaveBeenCalledOnce());
    offlineRuntime.setStore(new InMemoryLocalStore(), "B");
    resolve({ cursor: 10, builds: [{ _id: "a", userId: "A" }] });
    await warming;
    expect(offlineRuntime.listLocalEntityRowsSync("builds")).toEqual([]);
    expect(await offlineRuntime.getSyncCursor()).toBe(0);
  });

  it("never replays the next queued payload after an account switch", async () => {
    offlineRuntime.setStore(new InMemoryLocalStore(), "A");
    await offlineRuntime.enqueueMutation("builds:create", { name: "A1" }, "a1");
    await offlineRuntime.enqueueMutation("builds:create", { name: "A2" }, "a2");
    let resolve!: (result: unknown) => void;
    const client = {
      mutation: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      ),
    } as unknown as ConvexReactClient;
    const draining = drainMutationQueue(client);
    await vi.waitFor(() => expect(client.mutation).toHaveBeenCalledOnce());
    offlineRuntime.setStore(new InMemoryLocalStore(), "B");
    await offlineRuntime.enqueueMutation("builds:create", { name: "B" }, "b");
    resolve({ _id: "server-a" });
    await expect(draining).rejects.toThrow("account changed");
    expect(client.mutation).toHaveBeenCalledOnce();
    expect(await offlineRuntime.listPendingMutations()).toHaveLength(1);
  });
});
