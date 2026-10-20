// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplicaScheduler } from "./replica/scheduler";
import { makeTestVault } from "@/test-support/vaultHarness";
import {
  flushPublicationRemovals,
  publishVaultRow,
  publishedProjection,
  recordPublicationRemovals,
} from "./publications";

vi.mock("@/offline/connectivity", () => ({ getIsOnline: () => true }));
afterEach(() => vi.useRealTimers());

describe("published projections", () => {
  it("carries whitelisted content only, never device photo tokens", () => {
    expect(
      publishedProjection("builds", {
        _id: "local:1",
        userId: "u",
        name: "Zelda",
        status: "wip",
        notes: "wig",
        imageUrl: "kyarafit-image:img_1",
        recovered: true,
        fieldUpdatedAt: { name: 1 },
      })
    ).toEqual({ name: "Zelda", status: "wip", notes: "wig" });
    expect(
      publishedProjection("conventions", {
        name: "Expo",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        imageUrl: "https://example.test/expo.jpg",
      })
    ).toEqual({
      name: "Expo",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      imageUrl: "https://example.test/expo.jpg",
    });
  });

  it("publishes explicitly, then queues and flushes removal when the vault row is deleted", async () => {
    const { store, sql } = makeTestVault({ onPersist: recordPublicationRemovals });
    const id = store.commit((db) => db.insert("builds", { name: "Zelda", status: "wip" }));
    const client = {
      mutation: vi.fn(async (_ref: unknown, _args: unknown) => ({ id: "server-1" })),
    };
    expect(await publishVaultRow(client, "builds", id, sql)).toBe("server-1");
    expect(client.mutation.mock.calls[0][1]).toEqual({
      table: "builds",
      clientId: id,
      doc: { name: "Zelda", status: "wip" },
    });
    store.commit((db) => db.delete(id));
    expect(sql.getAllSync("SELECT client_id, server_id FROM publish_removals")).toEqual([
      { client_id: id, server_id: id },
    ]);

    const failing = { mutation: vi.fn(async () => Promise.reject(new Error("offline"))) };
    await expect(flushPublicationRemovals(failing, sql)).rejects.toThrow("Published copies could not be removed");
    expect(sql.getAllSync("SELECT client_id FROM publish_removals")).toHaveLength(1);

    const ok = { mutation: vi.fn(async (_ref: unknown, _args: unknown) => ({ removed: true })) };
    expect(await flushPublicationRemovals(ok, sql)).toBe(1);
    expect(ok.mutation.mock.calls[0][1]).toEqual({ table: "builds", clientId: id });
    expect(sql.getAllSync("SELECT * FROM publish_removals")).toEqual([]);
    expect(sql.getAllSync("SELECT * FROM id_map")).toEqual([]);
  });

  it.each(["builds", "conventions"])("retries a free user's failed %s removal without an unrelated trigger", async table => {
    const { store, sql } = makeTestVault({ onPersist: recordPublicationRemovals });
    const id = store.commit(db => db.insert(table, { name: "Shared" }));
    store.commit(db => db.delete(id));
    const client = { mutation: vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue({ removed: true }) };
    vi.useFakeTimers();
    const scheduler = new ReplicaScheduler(null, {
      canSync: () => true, isEntitled: () => false, random: () => 1,
      afterPass: async () => { await flushPublicationRemovals(client, sql); },
    });
    await scheduler.run();
    expect(sql.getAllSync("SELECT * FROM publish_removals")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.mutation).toHaveBeenCalledTimes(2);
    expect(client.mutation).toHaveBeenLastCalledWith(expect.anything(), { table, clientId: id });
    expect(sql.getAllSync("SELECT * FROM publish_removals")).toEqual([]);
    scheduler.dispose();
  });

  it("resolves removals without a device-only publication mapping", async () => {
    const { store, sql } = makeTestVault({ onPersist: recordPublicationRemovals });
    const id = store.commit((db) => db.insert("builds", { name: "Private", status: "idea" }));
    store.commit((db) => db.delete(id));
    const client = { mutation: vi.fn(async () => ({ removed: false })) };
    expect(await flushPublicationRemovals(client, sql)).toBe(1);
    expect(client.mutation).toHaveBeenCalledWith(expect.anything(), { table: "builds", clientId: id });
  });
});
