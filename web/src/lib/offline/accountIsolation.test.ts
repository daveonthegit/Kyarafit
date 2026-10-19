import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { InMemoryLocalStore } from "./localStore";
import { offlineRuntime } from "./runtime";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, warmEntityRows } from "./syncWorker";
import { readLocalCollections } from "../localFirstData";

beforeEach(() => setOfflineConnectivity(true));

describe("account-bound local web storage", () => {
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
