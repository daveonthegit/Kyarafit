// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import {
  flushPublicationRemovals,
  publishVaultRow,
  publishedProjection,
  recordPublicationRemovals,
} from "./publications";

vi.mock("@/offline/connectivity", () => ({ getIsOnline: () => true }));

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
      { client_id: id, server_id: "server-1" },
    ]);

    const failing = { mutation: vi.fn(async () => Promise.reject(new Error("offline"))) };
    expect(await flushPublicationRemovals(failing, sql)).toBe(0);
    expect(sql.getAllSync("SELECT client_id FROM publish_removals")).toHaveLength(1);

    const ok = { mutation: vi.fn(async (_ref: unknown, _args: unknown) => ({ removed: true })) };
    expect(await flushPublicationRemovals(ok, sql)).toBe(1);
    expect(ok.mutation.mock.calls[0][1]).toEqual({ table: "builds", serverId: "server-1" });
    expect(sql.getAllSync("SELECT * FROM publish_removals")).toEqual([]);
    expect(sql.getAllSync("SELECT * FROM id_map")).toEqual([]);
  });

  it("never calls the server for a vault that published nothing", async () => {
    const { store, sql } = makeTestVault({ onPersist: recordPublicationRemovals });
    const id = store.commit((db) => db.insert("builds", { name: "Private", status: "idea" }));
    store.commit((db) => db.delete(id));
    const client = { mutation: vi.fn() };
    expect(await flushPublicationRemovals(client, sql)).toBe(0);
    expect(client.mutation).not.toHaveBeenCalled();
  });
});
