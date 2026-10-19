import { describe, expect, it, vi } from "vitest";
import type { StoredEntityRow } from "./localStore";
import { RESTORE_SESSION_KEY, RestoreInProgressError } from "./restoreState";

const adapter = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("idb", () => ({ openDB: adapter.open }));
import { IndexedDbLocalStore } from "./indexedDbStore";

describe("IndexedDB command transaction protocol", () => {
  it("aborts both stores if any overlay fails, then permits a clean retry", async () => {
    const durable = new Map<string, unknown[]>([
      ["mutation_queue", []],
      ["entity_rows", []],
      ["sync_meta", []],
    ]);
    let fail = true;
    adapter.open.mockResolvedValue({
      getAll: async (name: string) => durable.get(name) ?? [],
      transaction: (names: string[]) => {
        expect(names).toContain("sync_meta");
        expect(names).toContain("entity_rows");
        const staged = new Map([...durable].map(([name, rows]) => [name, [...rows]]));
        let aborted = false;
        return {
          objectStore: (name: string) => ({
            get: async (key: string) =>
              staged.get(name)?.find((row) => (row as { key?: string }).key === key),
            index: () => ({ getKey: async () => undefined }),
            add: async (record: object) => staged.get(name)!.push({ ...record, id: 1 }),
            put: async (record: object) => {
              if (fail && staged.get(name)!.length === 1) throw new Error("disk full");
              staged.get(name)!.push(record);
            },
          }),
          abort: () => {
            aborted = true;
          },
          get done() {
            if (aborted) return Promise.reject(new Error("aborted"));
            for (const [name, rows] of staged) durable.set(name, rows);
            return Promise.resolve();
          },
        };
      },
    });
    const store = new IndexedDbLocalStore("test");
    const row: StoredEntityRow = {
      table: "builds",
      id: "a",
      userId: "A",
      json: "{}",
      updatedAt: 1,
      deleted: false,
      synced: false,
    };
    const command = {
      fn: "builds:updateStatusMany",
      argsJson: "{}",
      idempotencyKey: "bulk",
      clientId: null,
    };
    await expect(store.commitCommand(command, [row, { ...row, id: "b" }])).rejects.toThrow(
      "disk full"
    );
    expect(await store.listEntityRows()).toEqual([]);
    expect(await store.listPendingMutations()).toEqual([]);
    fail = false;
    await store.commitCommand(command, [row, { ...row, id: "b" }]);
    expect(await store.listEntityRows()).toHaveLength(2);
    expect(await store.listPendingMutations()).toHaveLength(1);
    durable.set("sync_meta", [{ key: RESTORE_SESSION_KEY, value: "session" }]);
    await expect(
      store.enqueueMutation({ ...command, idempotencyKey: "blocked" })
    ).rejects.toBeInstanceOf(RestoreInProgressError);
    await expect(store.putEntityRow({ ...row, id: "blocked" })).rejects.toBeInstanceOf(
      RestoreInProgressError
    );
    expect(await store.listEntityRows()).toHaveLength(2);
    expect(await store.listPendingMutations()).toHaveLength(1);
    await store.putEntityRow({ ...row, id: "restored" }, { restore: true });
    expect(await store.listEntityRows()).toHaveLength(3);
  });
});
