import { describe, expect, it, vi } from "vitest";
import { InMemoryLocalStore, type StoredEntityRow } from "./localStore";
import { WaSqliteLocalStore } from "./waSqliteStore";
import { RESTORE_SESSION_KEY, RestoreInProgressError } from "./restoreState";

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
  it("refuses queued and overlay writes from durable session state, but allows restore writes", async () => {
    const store = new InMemoryLocalStore();
    await store.setMeta(RESTORE_SESSION_KEY, "session");
    await expect(store.enqueueMutation(input)).rejects.toBeInstanceOf(RestoreInProgressError);
    await expect(store.commitCommand(input, [row])).rejects.toBeInstanceOf(RestoreInProgressError);
    await expect(store.putEntityRow(row)).rejects.toBeInstanceOf(RestoreInProgressError);
    expect(await store.listPendingMutations()).toEqual([]);
    expect(await store.listEntityRows()).toEqual([]);
    await store.putEntityRow(row, { restore: true });
    expect(await store.listEntityRows()).toEqual([row]);
    await store.setMeta(RESTORE_SESSION_KEY, "");
    await store.commitCommand(input, [row]);
    expect(await store.listPendingMutations()).toHaveLength(1);
  });

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
  it("checks persisted session state within the write transaction", async () => {
    const store = new WaSqliteLocalStore();
    const run = vi.fn(async (_db: number, _sql: string, _params?: unknown[]) => 0);
    const read = vi.fn(async () => ({ rows: [["session"]], columns: ["value"] }));
    Object.assign(store, { db: 1, sqlite3: { run, execWithParams: read } });
    await expect(store.enqueueMutation(input)).rejects.toBeInstanceOf(RestoreInProgressError);
    await expect(store.putEntityRow(row)).rejects.toBeInstanceOf(RestoreInProgressError);
    expect(run.mock.calls.map((call) => call[1])).toEqual([
      "BEGIN IMMEDIATE", "ROLLBACK", "BEGIN IMMEDIATE", "ROLLBACK",
    ]);
    run.mockClear();
    await store.putEntityRow(row, { restore: true });
    expect(run).toHaveBeenCalledTimes(3);
  });

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
