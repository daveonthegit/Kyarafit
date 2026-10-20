// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import {
  REPLICA_PROTOCOL_VERSION as protocol,
  REPLICA_RETENTION_MS,
  replicaGeneratedWorkflowId,
  type ReplicaOp,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { DOWNGRADE_RETENTION_MS } from "@kyarafit/design-system/domain/tierTransition";
import {
  makeDevice,
  now,
  seedSlice,
  settle,
  type ReplicaBackend,
} from "@/test-support/replicaHarness";
import { NodeSqliteDatabase } from "@/test-support/nodeSqlite";
import { migrateVaultSchema } from "@/offline/vaultSchema";
import { VaultStore } from "../store";
import { getBuildScopedWorkflow } from "../handlers/workflow";
import { Replicator } from "./replicator";
import { convexReplicaTransport } from "./convexTransport";
import { syncReplicaAssets, type ReplicaAssetIo } from "./assets";
import { ReplicaScheduler } from "./scheduler";
import { countChangesNotApplied, listChangesNotApplied, restoreChange } from "./conflicts";
import {
  cachePublicationIdentities,
  getLocalIdForPublished,
  getPublishedId,
} from "../publications";

const modules = import.meta.glob([
  "../../../../convex/**/*.{ts,js}",
  "!../../../../convex/**/*.test.ts",
  "!../../../../convex/betterAuth/**",
  "!../../../../convex/node_modules/**",
]);
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const user = await t.run((ctx) =>
    ctx.db.insert("users", {
      externalId: "owner",
      email: "owner@example.invalid",
      tier: "SUPPORTER",
      currentUsageMb: 0,
    })
  );
  const actor = t.withIdentity({ subject: "owner" });
  const backend: ReplicaBackend = {
    subject: "owner",
    transport: (net) =>
      convexReplicaTransport(
        {
          mutation: (ref, args) =>
            (actor.mutation as unknown as (r: unknown, a: unknown) => Promise<unknown>)(ref, args),
          query: (ref, args) =>
            (actor.query as unknown as (r: unknown, a: unknown) => Promise<unknown>)(ref, args),
        },
        { subject: "owner", isOnline: () => net.online }
      ),
  };
  const a = makeDevice("A", backend, { runId: "review" });
  const b = makeDevice("B", backend, { runId: "review" });
  return { t, user, actor, a, b, backend };
}

function assetIo(): ReplicaAssetIo {
  return {
    hasLocal: async () => true,
    upload: vi.fn(async (key: string) => `storage-${key}`),
    register: vi.fn(async () => {}),
    urls: async () => [],
    download: vi.fn(async () => {}),
  };
}

describe("replica review regressions", () => {
  it.each(["cosplayNodes", "workflowItems"])(
    "validates restored %s parents atomically and maintains workflow descendant caches",
    async (table) => {
      const { a, b } = await setup();
      const make = (name: string) =>
        a.mutate<{ _id: string }>(
          table === "cosplayNodes" ? "cosplayNodes:create" : "workflow:create",
          table === "cosplayNodes" ? { nodeType: "element", name } : { title: name }
        );
      const x = make("X")._id;
      const y = make("Y")._id;
      const z = make("Z")._id;
      const child = make("Child")._id;
      const field = table === "cosplayNodes" ? "parentNodeId" : "parentId";
      const move = (device: typeof a, id: string, parent: string | null) => {
        if (table === "workflowItems") device.mutate("workflow:move", { id, parentId: parent });
        else if (parent)
          device.mutate("cosplayNodes:addChildLink", { parentNodeId: parent, childNodeId: id });
        else device.mutate("cosplayNodes:removeChildLink", { id });
      };
      move(a, child, x);
      await settle(a, b);
      a.net.online = false;
      b.net.online = false;
      move(a, x, y);
      move(b, x, z);
      a.net.online = true;
      b.net.online = true;
      await a.sync();
      await b.sync();
      await settle(a, b);
      const change = a
        .changes()
        .find(
          (row) => row.rowId === x && row.kind === "concurrent-field-edit" && row.lost[field] === y
        )!;
      expect(change).toBeDefined();
      a.net.online = false;
      move(a, y, x);
      const before = a.store.exportRows();
      const pending = a.replicator.pendingCount();
      expect(() => restoreChange(a.store, change)).toThrow(/cycle|descendant/i);
      expect(a.changes().some((row) => row.id === change.id)).toBe(true);
      expect(a.store.exportRows()).toEqual(before);
      expect(a.replicator.pendingCount()).toBe(pending);
      move(a, y, null);
      expect(restoreChange(a.store, change)).toBe(x);
      expect(a.get(x)?.[field]).toBe(y);
      if (table === "workflowItems") {
        expect(a.get(x)?.ancestorIds).toEqual([y]);
        expect(a.get(child)?.ancestorIds).toEqual([y, x]);
      }
      restoreChange(a.store, { ...change, lost: { [field]: null } });
      expect(a.get(x)?.[field]).toBeUndefined();
      if (table === "workflowItems") {
        expect(a.get(x)?.ancestorIds).toEqual([]);
        expect(a.get(child)?.ancestorIds).toEqual([x]);
      }
    }
  );

  it("rejects moves and restores from actual parents while over 500 descendant caches are partially pulled", async () => {
    const { a, b, backend, actor } = await setup();
    const x = a.mutate<{ _id: string }>("workflow:create", { title: "X", kind: "group" })._id;
    const y = a.mutate<{ _id: string }>("workflow:create", { title: "Y", kind: "group" })._id;
    const descendants: string[] = [];
    for (let i = 0; i < 501; i++)
      descendants.push(
        a.mutate<{ _id: string }>("workflow:create", {
          title: `Descendant ${i}`,
          parentId: y,
        })._id
      );
    await settle(a, b);
    a.mutate("workflow:move", { id: y, parentId: x });
    await a.sync();
    const after = Number(
      b.sql.getFirstSync<{ value: string }>(
        "SELECT value FROM sync_meta WHERE key = 'replica:cursor'"
      )!.value
    );
    const firstPage = await actor.query(api.replica.pull, {
      protocol,
      subject: "owner",
      after,
      limit: 500,
    });
    expect(firstPage.hasMore).toBe(true);
    const firstIds = new Set(firstPage.rows.map((row) => row.rowId));
    const z = descendants.find((id) => !firstIds.has(id))!;
    const refreshed = descendants.find((id) => firstIds.has(id))!;
    expect(z).toBeDefined();
    const transport = backend.transport(b.net);
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pages = 0;
    b.replicator.setTransport({
      ...transport,
      pull: async (cursor, limit, snapshot) => {
        if (limit > 1 && ++pages === 2) {
          entered();
          await resume;
        }
        return transport.pull(cursor, limit, snapshot);
      },
    });
    const syncing = b.sync();
    await waiting;
    b.net.online = false;
    try {
      expect(b.get(y)?.parentId).toBe(x);
      expect(b.get(z)?.parentId).toBe(y);
      expect(b.get(z)?.ancestorIds).toEqual([y]);
      expect(b.get(refreshed)?.ancestorIds).toEqual([x, y]);
      b.sql.runSync(
        "INSERT INTO replica_conflicts (id, table_name, row_id, kind, lost_json, rev, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "partial-parent",
          "workflowItems",
          x,
          "concurrent-field-edit",
          JSON.stringify({ parentId: z }),
          1,
          1,
        ]
      );
      const change = b.changes().find((row) => row.id === "partial-parent")!;
      const before = b.store.exportRows();
      expect(() => b.mutate("workflow:move", { id: x, parentId: z })).toThrow(/cycle/i);
      expect(() =>
        b.mutate("workflow:moveAndResequence", { move: { id: x, parentId: z }, resequence: [] })
      ).toThrow(/cycle/i);
      expect(() => restoreChange(b.store, change)).toThrow(/cycle/i);
      expect(b.store.exportRows()).toEqual(before);
      expect(b.replicator.pendingCount()).toBe(0);
      expect(b.changes().some((row) => row.id === change.id)).toBe(true);
      b.mutate("workflow:move", { id: y, parentId: null });
      expect(b.get(y)?.ancestorIds).toEqual([]);
      expect(b.get(refreshed)?.ancestorIds).toEqual([y]);
      expect(b.get(z)?.ancestorIds).toEqual([y]);
    } finally {
      release();
    }
    await syncing;
    expect(b.replicator.status).toBe("offline");
    expect(b.get(x)?.parentId).toBeUndefined();
    expect(b.get(y)?.parentId).toBeUndefined();
  });

  it("keeps build membership when attachment and task tombstones span push batches", async () => {
    const { a, b, backend } = await setup();
    const build = a.mutate<{ _id: string }>("builds:create", { name: "Subtree", status: "idea" });
    const root = a.mutate<{ _id: string }>("workflow:create", {
      title: "Root",
      kind: "group",
      attachments: [{ entityType: "build", entityId: build._id }],
    });
    const children: string[] = [];
    for (let i = 0; i < 60; i++)
      children.push(
        a.mutate<{ _id: string }>("workflow:create", {
          title: `Child ${i}`,
          parentId: root._id,
          attachments: [{ entityType: "build", entityId: build._id }],
        })._id
      );
    await settle(a, b);
    b.net.online = false;
    for (const id of [root._id, ...children])
      b.mutate("workflow:update", { id, title: `Offline ${id}` });
    a.mutate("workflow:remove", { id: root._id });
    const transport = backend.transport(a.net);
    const batches: number[] = [];
    a.replicator.setTransport({
      ...transport,
      push: (...args) => {
        batches.push(args[1].length);
        return transport.push(...args);
      },
    });
    await a.sync();
    expect(batches).toEqual([100, 22]);
    b.net.online = true;
    await settle(a, b);
    const rejected = b.changes(build._id).filter((row) => row.kind === "edit-after-delete");
    expect(new Set(rejected.map((row) => row.rowId))).toEqual(new Set([root._id, ...children]));
    expect(countChangesNotApplied(b.sql, build._id)).toBe(b.changes(build._id).length);
    expect(b.get(build._id)).not.toBeNull();
  });

  it.each(["edit-after-delete", "delete-over-unseen-edit", "orphan-removed"])(
    "reattaches a %s workflow restoration to surviving builds atomically",
    async (kind) => {
      const { a } = await setup();
      const first = a.mutate<{ _id: string }>("builds:create", { name: "First", status: "idea" });
      const second = a.mutate<{ _id: string }>("builds:create", { name: "Second", status: "idea" });
      const gone = a.mutate<{ _id: string }>("builds:create", { name: "Gone", status: "idea" });
      const task = a.mutate<{ _id: string }>("workflow:create", {
        title: "Restore me",
        attachments: [
          { entityType: "build", entityId: first._id },
          { entityType: "build", entityId: second._id },
        ],
      });
      const lost = {
        ...a.get(task._id),
        _replicaBuildIds: [first._id, second._id, gone._id],
        ...(kind === "orphan-removed" ? { parentId: "local:deleted-parent" } : {}),
      };
      a.mutate("workflow:remove", { id: task._id });
      a.mutate("builds:remove", { id: gone._id });
      a.sql.runSync(
        "INSERT INTO replica_conflicts (id, table_name, row_id, kind, lost_json, rev, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["restore-fixture", "workflowItems", task._id, kind, JSON.stringify(lost), 1, 1]
      );
      const change = a.changes(first._id).find((row) => row.id === "restore-fixture")!;
      expect(change.restorable).toBe(true);
      const restored = restoreChange(a.store, change);
      expect(a.get(restored)).toMatchObject({ title: "Restore me", ancestorIds: [] });
      expect(a.get(restored)).not.toHaveProperty("_replicaBuildIds");
      expect(a.get(restored)?.parentId).toBeUndefined();
      for (const buildId of [first._id, second._id]) {
        expect(
          getBuildScopedWorkflow({ db: a.store.reader() }, buildId)!.items.map((item) => item._id)
        ).toContain(restored);
      }
      const attachments = a.store
        .reader()
        .query("workflowAttachments")
        .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", restored))
        .collect();
      expect(attachments.map((row) => row.entityId).sort()).toEqual([first._id, second._id].sort());
    }
  );

  it.each(["upload", "download"])(
    "does not let persistent %s failures starve later transfers in the other direction",
    async (direction) => {
      const { a } = await setup();
      a.store.commit((db) => {
        for (let i = 0; i < 20; i++)
          db.insert("builds", {
            name: `Blocked ${i}`,
            imageUrl: `kyarafit-image:a_${String(i).padStart(2, "0")}`,
          });
        db.insert("builds", { name: "Ready", imageUrl: "kyarafit-image:z_ready" });
      });
      let attempts = 0;
      const successes: string[] = [];
      const downloaded = new Set<string>();
      const io: ReplicaAssetIo = {
        hasLocal: async (key) =>
          downloaded.has(key) || (direction === "upload" ? key !== "z_ready" : key === "z_ready"),
        urls: async (keys) =>
          keys
            .filter((key) => (direction === "upload" ? key === "z_ready" : key !== "z_ready"))
            .map((imageKey) => ({ imageKey, url: `https://example.invalid/${imageKey}` })),
        upload: async (key) => {
          attempts++;
          if (key !== "z_ready") throw new Error("Storage full");
          successes.push(key);
          return `storage-${key}`;
        },
        register: async () => {},
        download: async (key) => {
          attempts++;
          if (key !== "z_ready") throw new Error("Temporarily unavailable");
          downloaded.add(key);
          successes.push(key);
        },
      };
      expect(await syncReplicaAssets(a.sql, io)).toMatchObject({ failed: 20, remaining: 1 });
      expect(attempts).toBe(20);
      expect(successes).toEqual([]);
      await syncReplicaAssets(a.sql, io);
      expect(attempts).toBe(40);
      expect(successes).toEqual(["z_ready"]);
    }
  );
  it.each([
    [false, false],
    [true, false],
    [true, true],
  ])(
    "recovers acknowledged data deleted before its first pull (positive cursor=%s, existing edit=%s)",
    async (positiveCursor, editExisting) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { t, a, b, backend } = await setup();
      if (positiveCursor) {
        a.mutate("builds:create", { name: "Anchor", status: "idea" });
        await a.sync();
      }
      const created = a.mutate<{ _id: string }>("builds:create", {
        name: "Acknowledged",
        status: "idea",
      });
      if (editExisting) {
        await a.sync();
        a.mutate("builds:update", { id: created._id, notes: "Acknowledged edit" });
      }
      const priorRev = a.sql.getFirstSync<{ rev: number }>(
        "SELECT rev FROM replica_state WHERE table_name = 'builds' AND row_id = ?",
        [created._id]
      )?.rev;
      const transport = backend.transport(a.net);
      let acknowledgedRev = 0;
      a.replicator.setTransport({
        ...transport,
        push: async (...args) => {
          const result = await transport.push(...args);
          acknowledgedRev = result.outcomes.find(
            (outcome) => outcome.opId === args[1][0].opId
          )!.rev;
          a.net.online = false;
          return result;
        },
      });
      await a.sync();
      expect(a.replicator.status).toBe("offline");
      expect(a.replicator.pendingCount()).toBe(0);
      const tracked = a.sql.getFirstSync<{ rev: number; unpulled_at: number | null }>(
        "SELECT * FROM replica_state WHERE table_name = 'builds' AND row_id = ?",
        [created._id]
      );
      expect(tracked?.rev).toBe(editExisting ? priorRev : acknowledgedRev);
      expect(tracked?.unpulled_at).toEqual(expect.any(Number));
      await b.sync();
      b.mutate("builds:remove", { id: created._id });
      await b.sync();
      vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
      await t.mutation(internal.replica.prune, {});
      a.replicator.dispose();
      let seq = 0;
      let store: VaultStore;
      const deviceNow = now() + REPLICA_RETENTION_MS + 1;
      const reopened = new Replicator(a.sql, {
        newOpId: () => `ack-op-${++seq}`,
        now: () => deviceNow,
        onRowsChanged: () => store.reloadFromDisk(),
      });
      store = new VaultStore({
        subject: "owner",
        sql: a.sql,
        now: () => deviceNow,
        newId: () => `local:ack-restore-${++seq}`,
        onPersist: reopened.recordChanges,
      });
      a.net.online = true;
      reopened.setTransport(backend.transport(a.net));
      await reopened.sync();
      expect(reopened.status).toBe("idle");
      expect(store.reader().get(created._id)).toBeNull();
      const change = listChangesNotApplied(a.sql, store.reader(), created._id).find(
        (row) => row.rowId === created._id
      )!;
      expect(change).toMatchObject({
        action: "restore-row",
        restorable: true,
        lost: { name: "Acknowledged" },
      });
      if (editExisting) expect(change.lost.notes).toBe("Acknowledged edit");
      expect(
        (await t.run((ctx) => ctx.db.query("replicaRows").collect())).some(
          (row) => row.rowId === created._id && !row.deleted
        )
      ).toBe(false);
      const restored = restoreChange(store, change);
      await reopened.sync();
      await b.sync();
      expect(b.get(restored)?.name).toBe("Acknowledged");
      expect(b.get(created._id)).toBeNull();
    }
  );

  it("refreshes every committed page before edits can overwrite pulled fields or revive deleted rows", async () => {
    const { a, b, backend } = await setup();
    const kept = a.mutate<{ _id: string }>("builds:create", { name: "Old name", status: "idea" });
    const gone = a.mutate<{ _id: string }>("builds:create", { name: "Gone", status: "idea" });
    await settle(a, b);
    a.store.commit((db) => {
      db.patch(kept._id, { name: "Remote name" });
      db.delete(gone._id);
      for (let i = 0; i < 501; i++)
        db.insert("builds", { userId: "owner", name: `Extra ${i}`, status: "idea" });
    });
    await a.sync();
    const transport = backend.transport(b.net);
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    let pages = 0;
    b.replicator.setTransport({
      ...transport,
      pull: async (after, limit, snapshot) => {
        if (limit > 1 && ++pages === 2) {
          entered();
          await resume;
        }
        return transport.pull(after, limit, snapshot);
      },
    });
    const syncing = b.sync();
    await waiting;
    try {
      expect(b.get(kept._id)?.name).toBe("Remote name");
      expect(b.get(gone._id)).toBeNull();
      b.mutate("builds:update", { id: kept._id, notes: "Local notes" });
      expect(() => b.mutate("builds:update", { id: gone._id, notes: "Stale edit" })).toThrow();
      const disk = b.sql.getFirstSync<{ json: string }>(
        "SELECT json FROM entity_rows WHERE id = ?",
        [kept._id]
      );
      expect(JSON.parse(disk!.json)).toMatchObject({ name: "Remote name", notes: "Local notes" });
    } finally {
      release();
    }
    await syncing;
    expect(b.get(kept._id)).toMatchObject({ name: "Remote name", notes: "Local notes" });
    expect(b.get(gone._id)).toBeNull();
    await settle(a, b);
    expect(a.get(kept._id)).toMatchObject({ name: "Remote name", notes: "Local notes" });
  });

  it.each([false, true])(
    "keeps deleted attachment and ancestor membership in conflict lists and restores (ancestor first=%s)",
    async (ancestorFirst) => {
      const { a, b } = await setup();
      const ids = seedSlice(a);
      const other = a.mutate<{ _id: string }>("builds:create", {
        name: "Other build",
        status: "idea",
      });
      const task = a.mutate<{ _id: string }>("workflow:create", {
        title: "Shared task",
        attachments: [
          { entityType: "build", entityId: ids.build },
          { entityType: "build", entityId: other._id },
        ],
      });
      await settle(a, b);
      b.net.online = false;
      b.mutate("workflow:update", { id: task._id, title: "Offline task edit" });
      b.mutate("cosplayNodes:update", { id: ids.belt, name: "Offline belt edit" });
      a.mutate("workflow:remove", { id: task._id });
      a.store.commit((db) => {
        for (const id of ancestorFirst ? [ids.tunic, ids.belt] : [ids.belt, ids.tunic])
          db.delete(id);
      });
      await a.sync();
      b.net.online = true;
      await settle(a, b);
      expect(b.get(ids.build)).not.toBeNull();
      expect(b.get(task._id)).toBeNull();
      expect(b.get(ids.belt)).toBeNull();
      expect(b.changes(ids.build).map((row) => row.rowId)).toEqual(
        expect.arrayContaining([task._id, ids.belt])
      );
      expect(b.changes(other._id).map((row) => row.rowId)).toContain(task._id);
      for (const buildId of [ids.build, other._id])
        expect(countChangesNotApplied(b.sql, buildId)).toBe(b.changes(buildId).length);
      const taskChange = b
        .changes(ids.build)
        .find((row) => row.rowId === task._id && row.kind === "edit-after-delete")!;
      const restored = restoreChange(b.store, taskChange);
      expect(b.get(restored)?.title).toBe("Offline task edit");
      expect(b.get(restored)?.ancestorIds).toEqual([]);
      expect(b.get(restored)).not.toHaveProperty("_replicaBuildIds");
      for (const buildId of [ids.build, other._id]) {
        expect(
          getBuildScopedWorkflow({ db: b.store.reader() }, buildId)!.items.map((item) => item._id)
        ).toContain(restored);
      }
      const beltChange = b
        .changes(ids.build)
        .find((row) => row.rowId === ids.belt && row.kind === "edit-after-delete")!;
      expect(beltChange.lost.name).toBe("Offline belt edit");
      expect(beltChange.lost._replicaBuildIds).toContain(ids.build);
    }
  );
  it("preserves local conflict membership when relationships are deleted earlier in a tombstone page", async () => {
    const { a, b, backend } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    a.mutate("workflow:remove", { id: ids.task });
    a.store.commit((db) => {
      db.delete(ids.tunic);
      db.delete(ids.belt);
    });
    await a.sync();
    const transport = backend.transport(b.net);
    let edited = false;
    b.replicator.setTransport({
      ...transport,
      pull: async (after, limit, snapshot) => {
        const page = await transport.pull(after, limit, snapshot);
        if (
          !edited &&
          limit > 1 &&
          page.rows.some((row) => row.rowId === ids.task && row.deleted)
        ) {
          edited = true;
          b.mutate("workflow:update", { id: ids.task, title: "Edited during pull" });
          b.mutate("cosplayNodes:update", { id: ids.belt, name: "Edited during pull" });
        }
        return page;
      },
    });
    await b.sync();
    expect(edited).toBe(true);
    expect(b.replicator.pendingCount()).toBe(0);
    expect(b.get(ids.task)).toBeNull();
    expect(b.get(ids.belt)).toBeNull();
    expect(
      b
        .changes(ids.build)
        .filter((row) => row.kind === "edit-after-delete")
        .map((row) => row.rowId)
    ).toEqual(expect.arrayContaining([ids.task, ids.belt]));
    expect(countChangesNotApplied(b.sql, ids.build)).toBe(b.changes(ids.build).length);
  });

  it("migrates existing outbox entries without losing durable attempt timestamps on reopen", () => {
    const sql = new NodeSqliteDatabase();
    sql.execSync(`
      CREATE TABLE schema_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
      INSERT INTO schema_version VALUES (1, 4);
      CREATE TABLE replica_outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT UNIQUE NOT NULL,
        table_name TEXT NOT NULL, row_id TEXT NOT NULL, kind TEXT NOT NULL,
        fields_json TEXT, base_rev INTEGER NOT NULL
      );
      CREATE TABLE replica_state (table_name TEXT NOT NULL, row_id TEXT NOT NULL, rev INTEGER NOT NULL,
        PRIMARY KEY (table_name, row_id));
      INSERT INTO replica_state VALUES ('builds', 'local:observed', 3);
    `);
    sql.runSync(
      "INSERT INTO replica_outbox (op_id, table_name, row_id, kind, fields_json, base_rev) VALUES (?, ?, ?, ?, ?, ?)",
      ["pending", "builds", "local:kept", "put", JSON.stringify({ name: "Kept" }), 0]
    );
    migrateVaultSchema(sql, "owner");
    expect(sql.getFirstSync("SELECT * FROM replica_outbox")).toMatchObject({
      op_id: "pending",
      attempted_at: null,
    });
    expect(sql.getFirstSync("SELECT * FROM replica_state")).toMatchObject({
      row_id: "local:observed",
      unpulled_at: null,
    });
    sql.runSync("UPDATE replica_outbox SET attempted_at = 123 WHERE op_id = 'pending'");
    sql.runSync("UPDATE replica_state SET unpulled_at = 456");
    migrateVaultSchema(sql, "owner");
    expect(sql.getFirstSync("SELECT * FROM replica_outbox")).toMatchObject({
      op_id: "pending",
      attempted_at: 123,
    });
    expect(sql.getFirstSync("SELECT * FROM replica_state")).toMatchObject({
      row_id: "local:observed",
      unpulled_at: 456,
    });
  });

  it.each([
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, false],
    [false, false, true],
  ])(
    "recovers a lost-ack creation deleted by B after retention (positive cursor=%s, expired reconnect=%s, reset=%s)",
    async (positiveCursor, expiredReconnect, resetGeneration) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const { t, user, a, b, backend } = await setup();
      if (positiveCursor) {
        a.mutate("builds:create", { name: "Anchor", status: "idea" });
        await a.sync();
      }
      const created = a.mutate<{ _id: string }>("builds:create", {
        name: "Ambiguous",
        status: "idea",
        notes: "Keep for recovery",
      });
      a.net.loseNextPushAck = true;
      await a.sync();
      expect(a.replicator.status).toBe("error");
      expect(
        a.sql.getFirstSync(
          "SELECT * FROM replica_state WHERE table_name = 'builds' AND row_id = ?",
          [created._id]
        )
      ).toBeNull();
      await b.sync();
      expect(b.get(created._id)?.name).toBe("Ambiguous");
      b.mutate("builds:remove", { id: created._id });
      await b.sync();
      a.net.online = false;
      vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
      await t.mutation(internal.replica.prune, {});
      const reset = async () => {
        vi.setSystemTime(Date.now() + 1);
        await t.run((ctx) =>
          ctx.db.patch(user, {
            tier: "FREE",
            downgradedAt: Date.now() - DOWNGRADE_RETENTION_MS - 1,
          })
        );
        await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {});
        // The purge schedules the new replica generation; run it as the scheduler would.
        await t.mutation(internal.replica.startGeneration, { userId: "owner" });
        await t.run((ctx) => ctx.db.patch(user, { tier: "SUPPORTER", cloudPurgedAt: undefined }));
      };
      if (resetGeneration) await reset();
      a.replicator.dispose();
      let seq = 0;
      const deviceNow = now() + (expiredReconnect ? REPLICA_RETENTION_MS + 1 : 1000);
      let store: VaultStore;
      const reopened = new Replicator(a.sql, {
        newOpId: () => `reopened-op-${++seq}`,
        now: () => deviceNow,
        onRowsChanged: () => store.reloadFromDisk(),
      });
      store = new VaultStore({
        subject: "owner",
        sql: a.sql,
        newId: () => `local:restored-${++seq}`,
        now: () => deviceNow,
        onPersist: reopened.recordChanges,
      });
      const transport = backend.transport(a.net);
      const sentPuts: string[] = [];
      reopened.setTransport({
        ...transport,
        push: (...args) => {
          sentPuts.push(...args[1].filter((op) => op.kind === "put").map((op) => op.rowId));
          return transport.push(...args);
        },
      });
      a.net.online = true;
      await reopened.sync();
      expect(reopened.status).toBe("idle");
      expect(reopened.pendingCount()).toBe(0);
      expect(store.reader().get(created._id)).toBeNull();
      if (expiredReconnect || positiveCursor) expect(sentPuts).not.toContain(created._id);
      expect(
        (await t.run((ctx) => ctx.db.query("replicaRows").collect())).some(
          (row) => row.rowId === created._id && !row.deleted
        )
      ).toBe(false);
      const change = listChangesNotApplied(a.sql, store.reader(), created._id).find(
        (row) => row.rowId === created._id
      )!;
      expect(change).toMatchObject({
        action: "restore-row",
        restorable: true,
        lost: { name: "Ambiguous", notes: "Keep for recovery" },
      });
      if (resetGeneration) {
        await reset();
        await reopened.sync();
        expect(
          listChangesNotApplied(a.sql, store.reader(), created._id).some(
            (row) => row.id === change.id
          )
        ).toBe(true);
      }
      const restored = restoreChange(store, change);
      expect(restored).not.toBe(created._id);
      await reopened.sync();
      await b.sync();
      expect(b.get(restored)?.name).toBe("Ambiguous");
      expect(b.get(created._id)).toBeNull();
    }
  );
  it("resumes an interrupted multi-page expired snapshot before recovering an absent attempted creation", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, a, b, backend } = await setup();
    a.store.commit((db) => {
      for (let i = 0; i < 600; i++)
        db.insert("builds", { userId: "owner", name: `Kept ${i}`, status: "idea" });
    });
    await a.sync();
    const created = a.mutate<{ _id: string }>("builds:create", {
      name: "Ambiguous",
      status: "idea",
    });
    a.net.loseNextPushAck = true;
    await a.sync();
    await b.sync();
    b.mutate("builds:remove", { id: created._id });
    await b.sync();
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
    await t.mutation(internal.replica.prune, {});
    const transport = backend.transport(a.net);
    let failed = false;
    a.replicator.setTransport({
      ...transport,
      pull: async (after, limit, snapshot) => {
        if (snapshot && after > 0 && limit > 1 && !failed) {
          failed = true;
          throw new Error("Dropped after a committed snapshot page");
        }
        return transport.pull(after, limit, snapshot);
      },
    });
    await a.sync();
    expect(a.replicator.status).toBe("error");
    expect(a.sql.getAllSync("SELECT * FROM replica_seen")).toHaveLength(500);
    expect(a.get(created._id)?.name).toBe("Ambiguous");
    await a.sync();
    expect(a.replicator.status).toBe("idle");
    expect(a.replicator.pendingCount()).toBe(0);
    expect(a.get(created._id)).toBeNull();
    expect(a.changes(created._id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowId: created._id, action: "restore-row", restorable: true }),
      ])
    );
    expect(a.store.exportRows().filter((row) => row.table === "builds")).toHaveLength(600);
    expect(a.sql.getAllSync("SELECT * FROM replica_seen")).toEqual([]);
  });

  it("completes a fresh-device snapshot after a retention-rejected push", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, a, backend } = await setup();
    const gone = a.mutate<{ _id: string }>("builds:create", { name: "Gone", status: "idea" });
    const keep = a.mutate<{ _id: string }>("builds:create", { name: "Keep", status: "idea" });
    await a.sync();
    a.mutate("builds:remove", { id: gone._id });
    await a.sync();
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
    await t.mutation(internal.replica.prune, {});
    const fresh = makeDevice("Fresh", backend, { runId: "fresh" });
    const local = fresh.mutate<{ _id: string }>("builds:create", { name: "New", status: "idea" });
    const transport = backend.transport(fresh.net);
    let pushes = 0;
    fresh.replicator.setTransport({
      ...transport,
      push: (...args) => {
        if (++pushes > 2) throw new Error("Snapshot was not reconciled");
        return transport.push(...args);
      },
    });
    await fresh.sync();
    expect(fresh.replicator.status).toBe("idle");
    expect(pushes).toBe(1);
    expect(fresh.replicator.pendingCount()).toBe(0);
    expect(fresh.get(keep._id)?.name).toBe("Keep");
    expect(fresh.get(local._id)?.name).toBe("New");
    expect(fresh.get(gone._id)).toBeNull();
  });

  it.each(["builds", "conventions"] as const)(
    "preserves pending %s deletions when another device reseeds a reset replica",
    async (table) => {
      const { t, user, a, b } = await setup();
      const fields =
        table === "builds"
          ? { name: "Build", status: "idea" }
          : { name: "Expo", startDate: "2026-10-01", endDate: "2026-10-02" };
      const id = a.store.commit((db) => db.insert(table, { userId: "owner", ...fields }));
      await settle(a, b);
      await t.run((ctx) =>
        ctx.db.patch(user, { tier: "FREE", downgradedAt: Date.now() - DOWNGRADE_RETENTION_MS - 1 })
      );
      await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {});
      // The purge schedules the new replica generation; run it as the scheduler would.
      await t.mutation(internal.replica.startGeneration, { userId: "owner" });
      b.net.online = false;
      b.store.commit((db) => db.delete(id));
      await t.run((ctx) => ctx.db.patch(user, { tier: "SUPPORTER", cloudPurgedAt: undefined }));
      await a.sync();
      expect(a.get(id)?.name).toBe(fields.name);
      b.net.online = true;
      await settle(b, a);
      expect(b.replicator.status).toBe("idle");
      expect(b.replicator.pendingCount()).toBe(0);
      expect(a.get(id)).toBeNull();
      expect(b.get(id)).toBeNull();
      const rows = await t.run((ctx) => ctx.db.query("replicaRows").collect());
      expect(rows.find((row) => row.rowId === id)?.deleted).toBe(true);
    }
  );

  it("keeps an edit made during a tombstone pull as a conflict, not a replayable partial put", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, a, b, backend } = await setup();
    const build = a.mutate<{ _id: string }>("builds:create", { name: "Original", status: "idea" });
    await settle(a, b);
    a.mutate("builds:remove", { id: build._id });
    await a.sync();
    const transport = backend.transport(b.net);
    let edited = false;
    b.replicator.setTransport({
      ...transport,
      pull: async (after, limit, snapshot) => {
        const page = await transport.pull(after, limit, snapshot);
        if (
          !edited &&
          limit > 1 &&
          page.rows.some((row) => row.rowId === build._id && row.deleted)
        ) {
          edited = true;
          b.mutate("builds:update", { id: build._id, notes: "Edited during pull" });
          b.net.online = false;
        }
        return page;
      },
    });
    await b.sync();
    expect(edited).toBe(true);
    expect(b.get(build._id)).toBeNull();
    expect(b.replicator.pendingCount()).toBe(0);
    expect(b.changes(build._id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "edit-after-delete",
          lost: expect.objectContaining({ name: "Original", notes: "Edited during pull" }),
        }),
      ])
    );
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
    await t.mutation(internal.replica.prune, {});
    b.net.online = true;
    await settle(a, b);
    expect(b.replicator.status).toBe("idle");
    expect(b.get(build._id)).toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.query("replicaRows").collect())).some(
        (row) => row.rowId === build._id && !row.deleted
      )
    ).toBe(false);
  });

  it.each([0, 20])(
    "retries waiting-for-upload photos after %i transfers without an unrelated trigger",
    async (transfers) => {
      const { b } = await setup();
      const local = new Set<string>();
      b.store.commit((db) => {
        for (let i = 0; i < transfers; i++) {
          const key = `photo_${i}`;
          local.add(key);
          db.insert("builds", { name: key, imageUrl: `kyarafit-image:${key}` });
        }
        db.insert("builds", { name: "Waiting", imageUrl: "kyarafit-image:zz_wait" });
      });
      let uploadedElsewhere = false;
      const io: ReplicaAssetIo = {
        ...assetIo(),
        hasLocal: async (key) => local.has(key),
        urls: async (keys) =>
          uploadedElsewhere && keys.includes("zz_wait")
            ? [{ imageKey: "zz_wait", url: "https://example.invalid/photo" }]
            : [],
        download: vi.fn(async (key: string) => {
          local.add(key);
        }),
      };
      vi.useFakeTimers();
      const afterPass = vi.fn(async () => syncReplicaAssets(b.sql, io));
      const scheduler = new ReplicaScheduler(null, {
        canSync: () => true,
        isEntitled: () => true,
        random: () => 1,
        afterPass,
      });
      await scheduler.run();
      expect(await afterPass.mock.results[0].value).toMatchObject({
        uploaded: transfers,
        failed: 1,
      });
      uploadedElsewhere = true;
      await vi.advanceTimersByTimeAsync(2000);
      expect(afterPass).toHaveBeenCalledTimes(2);
      expect(io.download).toHaveBeenCalledWith("zz_wait", "https://example.invalid/photo");
      expect(local.has("zz_wait")).toBe(true);
      scheduler.dispose();
    }
  );

  it("resolves both publication identity directions on a second device without sharing content or identities across accounts", async () => {
    const { t, actor, a, b, backend } = await setup();
    const build = a.mutate<{ _id: string }>("builds:create", { name: "Build", status: "idea" });
    const convention = a.mutate<{ _id: string }>("conventions:create", {
      name: "Expo",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
    });
    await settle(a, b);
    const publishedBuild = await actor.mutation(api.publications.publish, {
      table: "builds",
      clientId: build._id,
      doc: { name: "Build", status: "idea" },
    });
    const publishedConvention = await actor.mutation(api.publications.publish, {
      table: "conventions",
      clientId: convention._id,
      doc: { name: "Expo", startDate: "2026-10-01", endDate: "2026-10-02" },
    });
    expect(getPublishedId(build._id, b.sql)).toBeNull();
    const identities = await actor.query(api.publications.identities, {});
    expect(identities.subject).toBe("owner");
    cachePublicationIdentities(b.sql, identities.mappings);
    const fresh = makeDevice("Empty", backend, { runId: "empty" });
    cachePublicationIdentities(fresh.sql, identities.mappings);
    expect(getLocalIdForPublished(publishedBuild.id, fresh.sql)).toBeNull();
    expect(fresh.get(build._id)).toBeNull();
    await fresh.sync();
    expect(getLocalIdForPublished(publishedBuild.id, fresh.sql)).toBe(build._id);
    for (const [clientId, serverId] of [
      [build._id, publishedBuild.id],
      [convention._id, publishedConvention.id],
    ]) {
      expect(getPublishedId(clientId, b.sql)).toBe(serverId);
      expect(getLocalIdForPublished(serverId, b.sql)).toBe(clientId);
    }
    expect(
      await t.withIdentity({ subject: "other" }).query(api.publications.identities, {})
    ).toEqual({ subject: "other", mappings: [] });
    expect(await t.query(api.publications.identities, {})).toEqual({ subject: null, mappings: [] });
  });
  it("reconciles expired edits before pushing, keeping losing content rather than resurrecting it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, a, b, actor } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    b.net.online = false;
    b.mutate("builds:update", { id: ids.build, notes: "offline edit" });
    const child = b.store.commit((db) =>
      db.insert("buildReferenceImages", {
        buildId: ids.build,
        imageUrl: "https://example.invalid/p.png",
        sortOrder: 0,
      })
    );
    a.mutate("builds:remove", { id: ids.build });
    await a.sync();
    const before = await actor.query(api.replica.pull, { protocol, subject: "owner", after: 0 });
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
    await t.mutation(internal.replica.prune, {});
    const stale: ReplicaOp = {
      opId: "stale",
      table: "builds",
      rowId: ids.build,
      kind: "put",
      fields: { notes: "corrupt" },
      baseRev: 0,
    };
    expect(
      await actor.mutation(api.replica.push, {
        protocol,
        subject: "owner",
        deviceId: "stale",
        ops: [stale],
        after: 1,
      })
    ).toMatchObject({ resnapshot: true, outcomes: [] });
    b.net.online = true;
    await settle(a, b);
    expect(b.replicator.status).toBe("idle");
    expect(b.get(ids.build)).toBeNull();
    expect(b.changes(ids.build)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "edit-after-delete",
          lost: expect.objectContaining({ notes: "offline edit" }),
        }),
      ])
    );
    expect(b.get(child)?.buildId).not.toBe(ids.build);
    expect(before.cursor).toBeGreaterThan(1);
  });

  it.each(["cosplayNodes", "workflowItems"])(
    "breaks concurrent %s cycles and derives workflow ancestor caches",
    async (table) => {
      const { a, b } = await setup();
      const parentField = table === "cosplayNodes" ? "parentNodeId" : "parentId";
      const [x, y, z] = a.store.commit((db) =>
        ["X", "Y", "Z"].map((name) =>
          db.insert(
            table,
            table === "cosplayNodes"
              ? { name, nodeType: "element", tags: [] }
              : {
                  title: name,
                  kind: "task",
                  category: "craft",
                  status: "not_started",
                  ancestorIds: [],
                  sortOrder: 0,
                  scopeKind: "shared",
                  sourceKind: "manual",
                }
          )
        )
      );
      a.store.commit((db) => db.patch(z, { [parentField]: x }));
      await settle(a, b);
      a.store.commit((db) => db.patch(x, { [parentField]: y, ancestorIds: ["forged"] }));
      b.store.commit((db) => db.patch(y, { [parentField]: x, ancestorIds: ["forged"] }));
      await settle(a, b);
      expect(a.get(x)?.[parentField] === y && a.get(y)?.[parentField] === x).toBe(false);
      expect(b.get(x)).toEqual(a.get(x));
      if (table === "workflowItems") {
        const ancestors = a.get(x)?.parentId === y ? [y, x] : [x];
        expect(a.get(z)?.ancestorIds).toEqual(ancestors);
        expect(a.get(y)?.ancestorIds).not.toContain("forged");
      }
    }
  );

  it("converges two offline devices' generated purchase and packing tasks and their references", async () => {
    const { t, a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    for (const d of [a, b]) {
      d.net.online = false;
      d.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: "to_buy" });
    }
    const purchaseKey = `autogen:buy:${ids.build}:${ids.tunic}`;
    const purchaseId = replicaGeneratedWorkflowId(purchaseKey);
    for (const d of [a, b]) {
      expect(
        d.store
          .exportRows()
          .filter((row) => row.table === "workflowItems" && row.doc.dedupeKey === purchaseKey)
          .map((row) => row.id)
      ).toEqual([purchaseId]);
      d.net.online = true;
    }
    await settle(a, b);
    const tasks = a.store
      .exportRows()
      .filter(
        (row) =>
          row.table === "workflowItems" && String(row.doc.dedupeKey).startsWith("autogen:buy:")
      );
    expect(tasks).toHaveLength(1);
    expect(a.changes()).toEqual([]);
    expect(b.changes()).toEqual([]);
    expect(
      b.store
        .exportRows()
        .filter(
          (row) => row.table === "workflowItems" && row.doc.dedupeKey === tasks[0].doc.dedupeKey
        )
        .map((row) => row.id)
    ).toEqual([tasks[0].id]);
    const purchaseRows = await t.run((ctx) => ctx.db.query("replicaRows").collect());
    expect(
      purchaseRows
        .filter(
          (row) =>
            !row.deleted &&
            row.table === "workflowItems" &&
            row.doc.dedupeKey === tasks[0].doc.dedupeKey
        )
        .map((row) => row.rowId)
    ).toEqual([tasks[0].id]);
    expect(() => a.mutate("cosplayNodes:update", { id: ids.tunic, name: "Renamed" })).not.toThrow();
    await settle(a, b);
    expect(b.get(tasks[0].id)?.title).toBe("Buy Renamed");
    const convention = a.mutate<{ _id: string }>("conventions:create", {
      name: "Expo",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
    });
    const packing = a.store.commit((db) =>
      db.insert("packingListItems", {
        userId: "owner",
        conventionId: convention._id,
        label: "Wig",
        checked: false,
      })
    );
    await settle(a, b);
    for (const d of [a, b]) {
      d.net.online = false;
      d.mutate("conventions:updatePackingItem", { id: packing, checked: true });
    }
    const packingId = replicaGeneratedWorkflowId(`packing:${packing}`);
    expect(packingId).not.toBe(purchaseId);
    for (const d of [a, b]) {
      expect(d.get(packing)?.workflowItemId).toBe(packingId);
      expect(d.get(packingId)?.dedupeKey).toBe(`packing:${packing}`);
      d.net.online = true;
    }
    await settle(a, b);
    const packingTasks = a.store
      .exportRows()
      .filter((row) => row.table === "workflowItems" && row.doc.dedupeKey === `packing:${packing}`);
    expect(packingTasks).toHaveLength(1);
    for (const d of [a, b]) {
      expect(d.get(packing)?.workflowItemId).toBe(packingTasks[0].id);
      expect(
        d.store
          .exportRows()
          .filter(
            (row) => row.table === "workflowItems" && row.doc.dedupeKey === `packing:${packing}`
          )
          .map((row) => row.id)
      ).toEqual([packingTasks[0].id]);
      expect(() =>
        d.mutate("conventions:updatePackingItem", { id: packing, checked: false })
      ).not.toThrow();
    }
    const packingRows = await t.run((ctx) => ctx.db.query("replicaRows").collect());
    expect(
      packingRows
        .filter(
          (row) =>
            !row.deleted &&
            row.table === "workflowItems" &&
            row.doc.dedupeKey === `packing:${packing}`
        )
        .map((row) => row.rowId)
    ).toEqual([packingTasks[0].id]);
    a.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: null });
    expect(a.get(purchaseId)?.status).toBe("cancelled");
    expect(
      getBuildScopedWorkflow({ db: a.store.reader() }, ids.build)!.items.map((item) => item._id)
    ).not.toContain(purchaseId);
    await settle(a, b);
    a.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: "to_buy" });
    await settle(a, b);
    expect(
      a.store
        .exportRows()
        .filter(
          (row) =>
            row.table === "workflowItems" && String(row.doc.dedupeKey).startsWith("autogen:buy:")
        )
        .map((row) => row.id)
    ).toEqual([purchaseId]);
    expect(b.get(purchaseId)?.status).toBe("not_started");
  });

  it.each(["builds", "conventions"] as const)(
    "clears omitted %s publication fields and removes copies by client identity",
    async (table) => {
      const { actor, t, a, b } = await setup();
      const required =
        table === "builds"
          ? { name: "Build", status: "idea" }
          : { name: "Event", startDate: "2026-10-01", endDate: "2026-10-02" };
      const optional =
        table === "builds"
          ? {
              notes: "secret",
              character: "Link",
              imageFocalX: 0.5,
              budgetCents: 100,
              targetDate: "2026-10-01",
              manualProgressPercent: 50,
            }
          : { location: "Venue", archived: true };
      const localId = a.store.commit((db) => db.insert(table, { ...required, ...optional }));
      await settle(a, b);
      const { id } = await actor.mutation(api.publications.publish, {
        table,
        clientId: localId,
        doc: { ...required, ...optional },
      });
      await actor.mutation(api.publications.publish, { table, clientId: localId, doc: required });
      const row = (await t.run((ctx) => ctx.db.get(id as never))) as Record<string, unknown>;
      for (const key of Object.keys(optional)) expect(row[key]).toBeUndefined();
      b.store.commit((db) => db.delete(localId));
      await settle(a, b);
      expect(await t.run((ctx) => ctx.db.get(id as never))).toBeNull();
      expect(a.sql.getAllSync("SELECT * FROM publish_removals")).toHaveLength(1);
    }
  );

  it("reseeds rows and photo upload markers after a downgrade reset", async () => {
    const { t, user, a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    a.sql.runSync("INSERT INTO replica_assets (image_key, uploaded_at) VALUES (?, ?)", [
      "img_ref1",
      1,
    ]);
    await t.run((ctx) =>
      ctx.db.patch(user, { tier: "FREE", downgradedAt: Date.now() - DOWNGRADE_RETENTION_MS - 1 })
    );
    await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {});
    // The purge schedules the new replica generation; run it as the scheduler would.
    await t.mutation(internal.replica.startGeneration, { userId: "owner" });
    await t.run((ctx) => ctx.db.patch(user, { tier: "SUPPORTER", cloudPurgedAt: undefined }));
    await a.sync();
    expect(a.get(ids.build)?.name).toBe("Zelda");
    expect(a.sql.getAllSync("SELECT * FROM replica_assets")).toEqual([]);
    expect(
      (await t.run((ctx) => ctx.db.query("replicaRows").collect())).some(
        (row) => row.rowId === ids.build && !row.deleted
      )
    ).toBe(true);
    const io = assetIo();
    expect((await syncReplicaAssets(a.sql, io)).uploaded).toBe(1);
    await settle(a, b);
    expect(b.get(ids.build)?.name).toBe("Zelda");
  });

  it("includes attached tasks and nested elements in per-build conflict lists", async () => {
    const { a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    a.store.commit((db) => {
      db.patch(ids.task, { title: "A task" });
      db.patch(ids.belt, { name: "A belt" });
    });
    b.store.commit((db) => {
      db.patch(ids.task, { title: "B task" });
      db.patch(ids.belt, { name: "B belt" });
    });
    await settle(a, b);
    expect(a.changes(ids.build).map((change) => change.rowId)).toEqual(
      expect.arrayContaining([ids.task, ids.belt])
    );
    expect(countChangesNotApplied(a.sql, ids.build)).toBe(a.changes(ids.build).length);
  });

  it("schedules and drains more than one batch of conflict acknowledgements", async () => {
    const { a } = await setup();
    for (let i = 0; i < 101; i++)
      a.sql.runSync(
        "INSERT INTO replica_conflicts (id, table_name, row_id, kind, lost_json, rev, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [`c${i}`, "builds", `b${i}`, "concurrent-field-edit", "{}", i, 1]
      );
    const dismiss = vi.fn(async (_ids: string[]) => {});
    a.replicator.setTransport({
      push: async () => ({ outcomes: [], head: 0 }),
      pull: async () => ({ rows: [], conflicts: [], cursor: 0, hasMore: false, resnapshot: false }),
      dismissConflicts: dismiss,
    });
    vi.useFakeTimers();
    const scheduler = new ReplicaScheduler(a.replicator, {
      canSync: () => true,
      isEntitled: () => true,
    });
    let pending = a.replicator.pendingCount();
    const unsubscribe = a.replicator.subscribe(() => {
      const next = a.replicator.pendingCount();
      if (next > pending) scheduler.request();
      pending = next;
    });
    a.replicator.resolveConflicts(Array.from({ length: 101 }, (_, i) => `c${i}`));
    await vi.advanceTimersByTimeAsync(1500);
    expect(dismiss.mock.calls.map((call) => call[0].length)).toEqual([100, 1]);
    expect(a.replicator.pendingCount()).toBe(0);
    unsubscribe();
    scheduler.dispose();
  });

  it("continues bounded photo transfers and retries transient follow-up failures", async () => {
    const { a } = await setup();
    a.store.commit((db) => {
      for (let i = 0; i < 21; i++)
        db.insert("builds", { name: `Photo ${i}`, imageUrl: `kyarafit-image:photo_${i}` });
    });
    const io = assetIo();
    expect(await syncReplicaAssets(a.sql, io)).toMatchObject({ uploaded: 20, remaining: 1 });
    expect(await syncReplicaAssets(a.sql, io)).toMatchObject({ uploaded: 1, remaining: 0 });
    vi.useFakeTimers();
    const afterPass = vi
      .fn()
      .mockResolvedValueOnce({ failed: 1, remaining: 0 })
      .mockResolvedValueOnce({ failed: 0, remaining: 1 })
      .mockResolvedValue({ failed: 0, remaining: 0 });
    const scheduler = new ReplicaScheduler(null, {
      canSync: () => true,
      isEntitled: () => true,
      random: () => 1,
      afterPass,
    });
    await scheduler.run();
    await vi.advanceTimersByTimeAsync(3500);
    expect(afterPass).toHaveBeenCalledTimes(3);
    scheduler.dispose();
  });
});
