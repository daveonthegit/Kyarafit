import { describe, expect, it, vi } from "vitest";
import { InMemoryLocalStore, type StoredEntityRow } from "./localStore";
import { WaSqliteLocalStore } from "./waSqliteStore";

const input = {
  fn: "builds:create",
  argsJson: "{}",
  idempotencyKey: "create",
  clientId: "local:a",
};
const row: StoredEntityRow = {
  table: "builds",
  id: "local:a",
  userId: "A",
  json: "{}",
  updatedAt: 1,
  deleted: false,
  synced: false,
};

describe("in-memory command persistence", () => {
  it("stages all rows before committing queue intent", async () => {
    const store = new InMemoryLocalStore();
    const invalid = {
      ...row,
      id: "invalid",
      get json(): string {
        throw new Error("cannot persist");
      },
    };
    await expect(store.commitCommand(input, [row, invalid])).rejects.toThrow("cannot persist");
    expect(await store.listEntityRows()).toEqual([]);
    expect(await store.listPendingMutations()).toEqual([]);
    await store.commitCommand(input, [row]);
    expect(await store.listEntityRows()).toEqual([row]);
    expect(await store.listPendingMutations()).toHaveLength(1);
    await store.commitCommand(input, [{ ...row, deleted: true }]);
    expect(await store.listEntityRows()).toEqual([row]);
    expect(await store.listPendingMutations()).toHaveLength(1);
  });
});

describe("OPFS command transaction protocol", () => {
  it("rolls back an overlay failure and serializes a concurrent command until rollback", async () => {
    const store = new WaSqliteLocalStore();
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const commands: string[] = [];
    let fail = true;
    const run = vi.fn(async (_db: number, sql: string) => {
      const command = sql.trim().split(/\s+/).slice(0, 3).join(" ");
      commands.push(command);
      if (command === "INSERT INTO entity_rows" && fail) {
        fail = false;
        await paused;
        throw new Error("disk full");
      }
      return 0;
    });
    Object.assign(store, {
      db: 1,
      sqlite3: {
        run,
        execWithParams: async () => ({ rows: [], columns: [] }),
      },
    });
    const failed = store.commitCommand(input, [row]);
    const failure = expect(failed).rejects.toThrow("disk full");
    await vi.waitFor(() => expect(commands).toContain("INSERT INTO entity_rows"));
    const retry = store.commitCommand({ ...input, idempotencyKey: "retry" }, [row]);
    await Promise.resolve();
    expect(commands.filter((command) => command === "BEGIN IMMEDIATE")).toHaveLength(1);
    release();
    await failure;
    await retry;
    expect(commands).toEqual([
      "BEGIN IMMEDIATE",
      "INSERT INTO mutation_queue",
      "INSERT INTO entity_rows",
      "ROLLBACK",
      "BEGIN IMMEDIATE",
      "INSERT INTO mutation_queue",
      "INSERT INTO entity_rows",
      "COMMIT",
    ]);
  });
});
