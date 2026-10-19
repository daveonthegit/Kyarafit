import { describe, expect, it, vi } from "vitest";
import { InMemoryLocalStore, type StoredEntityRow } from "./localStore";
import { adoptLegacyStore } from "./legacyRecovery";

function row(id: string, userId: string): StoredEntityRow {
  return {
    table: "builds",
    id,
    userId,
    json: JSON.stringify({ _id: id, userId, name: id }),
    updatedAt: 1,
    synced: false,
    deleted: false,
  };
}

it.each(["indexeddb", "opfs"])("recovers only the owner's legacy %s data and intents", async (source) => {
  const legacy = new InMemoryLocalStore();
  await legacy.putEntityRow(row("a", "A"));
  await legacy.putEntityRow(row("b", "B"));
  for (const [key, args, clientId] of [
    ["a-create", { userId: "A", name: "A" }, "local:a"],
    ["b-create", { userId: "B", name: "B" }, "local:b"],
    ["a-edit", { id: "a", name: "Edited" }, null],
    ["mixed", { userId: "A", ids: ["a", "b"] }, null],
    ["unknown", { id: "unknown" }, null],
  ] as const) {
    await legacy.enqueueMutation({
      fn: "builds:update",
      argsJson: JSON.stringify(args),
      idempotencyKey: key,
      clientId,
    });
  }
  await legacy.setServerId("local:a", "server:a");
  await legacy.setServerId("local:b", "server:b");
  const a = new InMemoryLocalStore();
  await adoptLegacyStore(legacy, a, "A", source);
  expect(await a.listEntityRows()).toEqual([row("a", "A")]);
  expect((await a.listPendingMutations()).map((entry) => entry.idempotency_key)).toEqual([
    "a-create",
    "a-edit",
  ]);
  expect(await a.loadIdMap()).toEqual({ "local:a": "server:a" });
  await a.putEntityRow({ ...row("a", "A"), deleted: true });
  for (const entry of await a.listPendingMutations()) await a.deleteMutation(entry.id);
  await adoptLegacyStore(legacy, a, "A", source);
  expect((await a.listEntityRows())[0].deleted).toBe(true);
  expect(await a.listPendingMutations()).toEqual([]);
  const b = new InMemoryLocalStore();
  await adoptLegacyStore(legacy, b, "B", source);
  expect(await b.listEntityRows()).toEqual([row("b", "B")]);
  expect((await b.listPendingMutations()).map((entry) => entry.idempotency_key)).toEqual([
    "b-create",
  ]);
  expect(await b.loadIdMap()).toEqual({ "local:b": "server:b" });
  expect(await legacy.listEntityRows()).toEqual([row("a", "A"), row("b", "B")]);
  expect(await legacy.listPendingMutations()).toHaveLength(5);
});

describe("interrupted recovery", () => {
  it("retries without overwriting newer rows or duplicating committed intents", async () => {
    const legacy = new InMemoryLocalStore();
    const destination = new InMemoryLocalStore();
    await legacy.putEntityRow(row("a", "A"));
    for (const key of ["one", "two"]) {
      await legacy.enqueueMutation({
        fn: "builds:create",
        argsJson: JSON.stringify({ userId: "A" }),
        idempotencyKey: key,
        clientId: null,
      });
    }
    const commit = destination.commitCommand.bind(destination);
    vi.spyOn(destination, "commitCommand")
      .mockImplementationOnce(commit)
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(adoptLegacyStore(legacy, destination, "A", "indexeddb")).rejects.toThrow(
      "disk full"
    );
    expect(await destination.getMeta("legacy-adopted:indexeddb")).toBeNull();
    await destination.putEntityRow({ ...row("a", "A"), json: '{"name":"Newer"}' });
    await adoptLegacyStore(legacy, destination, "A", "indexeddb");
    expect(await destination.listPendingMutations()).toHaveLength(2);
    expect((await destination.listEntityRows())[0].json).toBe('{"name":"Newer"}');
    expect(await destination.getMeta("legacy-adopted:indexeddb")).toBe("1");
  });
});
