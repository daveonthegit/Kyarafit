import { describe, expect, it } from "vitest";
import { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { makeTestVault } from "@/test-support/vaultHarness";
import { VaultStore, VaultWriteError } from "./store";

describe("VaultStore", () => {
  it("commits inserts durably and serves them through Convex-shaped queries", () => {
    const { store, sql } = makeTestVault();
    const id = store.commit((db) =>
      db.insert("builds", { userId: "u", name: "Zelda", status: "idea" })
    );
    store.commit((db) => db.insert("builds", { userId: "u", name: "Link", status: "wip" }));

    const all = store
      .reader()
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", "u"))
      .collect();
    expect(all.map((b) => b.name)).toEqual(["Zelda", "Link"]);
    const wip = store
      .reader()
      .query("builds")
      .withIndex("by_userId_status", (q) => q.eq("userId", "u").eq("status", "wip"))
      .unique();
    expect(wip?.name).toBe("Link");
    expect(store.reader().get(id)?.name).toBe("Zelda");
    expect(sql.getFirstSync<{ c: number }>("SELECT COUNT(*) AS c FROM entity_rows")?.c).toBe(2);
  });

  it("orders withIndex results by the index fields", () => {
    const { store } = makeTestVault();
    store.commit((db) => {
      db.insert("workflowItems", { parentId: "p", sortOrder: 3, title: "c" });
      db.insert("workflowItems", { parentId: "p", sortOrder: 1, title: "a" });
      db.insert("workflowItems", { parentId: "q", sortOrder: 0, title: "x" });
      db.insert("workflowItems", { parentId: "p", sortOrder: 2, title: "b" });
    });
    const rows = store
      .reader()
      .query("workflowItems")
      .withIndex("by_parentId_sortOrder", (q) => q.eq("parentId", "p"))
      .collect();
    expect(rows.map((r) => r.title)).toEqual(["a", "b", "c"]);
  });

  it("patch removes undefined fields and stamps updatedAt", () => {
    const { store, tick } = makeTestVault();
    const id = store.commit((db) => db.insert("builds", { name: "A", notes: "n", status: "idea" }));
    const later = tick(5000);
    store.commit((db) => db.patch(id, { notes: undefined, name: "B" }));
    const doc = store.reader().get(id)!;
    expect(doc.name).toBe("B");
    expect("notes" in doc).toBe(false);
    expect(doc.updatedAt).toBe(later);
  });

  it("a failed write throws VaultWriteError and leaves memory and disk unchanged", () => {
    const sql = new NodeSqliteDatabase();
    const { store } = makeTestVault({ sql });
    store.commit((db) => db.insert("builds", { name: "Kept", status: "idea" }));
    const before = store.getVersion();

    sql.failNextWrite = (source) => source.includes("INSERT INTO entity_rows");
    expect(() =>
      store.commit((db) => db.insert("builds", { name: "Lost", status: "idea" }))
    ).toThrow(VaultWriteError);

    expect(store.getVersion()).toBe(before);
    expect(
      store
        .reader()
        .query("builds")
        .collect()
        .map((b) => b.name)
    ).toEqual(["Kept"]);
    expect(sql.getFirstSync<{ c: number }>("SELECT COUNT(*) AS c FROM entity_rows")?.c).toBe(1);
  });

  it("rolls back the entity rows when the replication intent cannot be queued", () => {
    const sql = new NodeSqliteDatabase();
    const { store } = makeTestVault({ sql });
    sql.failNextWrite = (source) => source.includes("INSERT INTO mutation_queue");
    expect(() =>
      store.commit(
        (db) => db.insert("builds", { name: "X", status: "idea" }),
        (id) => ({ fn: "builds:create", args: { name: "X" }, idempotencyKey: "k1", clientId: id })
      )
    ).toThrow(VaultWriteError);
    expect(sql.getFirstSync<{ c: number }>("SELECT COUNT(*) AS c FROM entity_rows")?.c).toBe(0);
    expect(store.reader().query("builds").collect()).toEqual([]);
  });

  it("records the replication intent in the same transaction as the rows it covers", () => {
    const { store, sql } = makeTestVault();
    const id = store.commit(
      (db) => db.insert("builds", { name: "X", status: "idea" }),
      (newId, touched) => ({
        fn: "builds:create",
        args: { name: "X" },
        idempotencyKey: "k1",
        clientId: newId,
      })
    );
    const row = sql.getFirstSync<{ fn: string; client_id: string; touched_json: string }>(
      "SELECT fn, client_id, touched_json FROM mutation_queue"
    );
    expect(row).toEqual({
      fn: "builds:create",
      client_id: id,
      touched_json: JSON.stringify([["builds", id]]),
    });
  });

  it("hard-deletes never-replicated local rows and tombstones rows the cloud may hold", () => {
    const { store, sql } = makeTestVault();
    const local = store.commit((db) => db.insert("builds", { name: "local", status: "idea" }));
    sql.runSync(
      `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
       VALUES ('builds', 'srv1', 'u', '{"name":"server","status":"idea","_creationTime":1}', 1, 1, 0)`
    );
    store.reloadFromDisk();
    store.commit((db) => {
      db.delete(local);
      db.delete("srv1");
    });
    expect(store.reader().query("builds").collect()).toEqual([]);
    const rows = sql.getAllSync<{ id: string; deleted: number; synced_at: number | null }>(
      "SELECT id, deleted, synced_at FROM entity_rows ORDER BY id"
    );
    expect(rows).toEqual([{ id: "srv1", deleted: 1, synced_at: null }]);
  });

  it("survives close and reopen: the vault on disk is the source of truth", () => {
    const sql = new NodeSqliteDatabase();
    const first = makeTestVault({ sql });
    first.store.commit((db) => db.insert("conventions", { name: "Expo", startDate: "2026-01-01" }));
    const reopened = new VaultStore({ subject: first.subject, sql, newId: () => "unused" });
    expect(
      reopened
        .reader()
        .query("conventions")
        .collect()
        .map((c) => c.name)
    ).toEqual(["Expo"]);
  });

  it("validation errors from the task propagate unchanged and write nothing", () => {
    const { store, sql } = makeTestVault();
    expect(() =>
      store.commit((db) => {
        db.insert("builds", { name: "half", status: "idea" });
        throw new Error("Name is required");
      })
    ).toThrow("Name is required");
    expect(sql.getFirstSync<{ c: number }>("SELECT COUNT(*) AS c FROM entity_rows")?.c).toBe(0);
  });
});
