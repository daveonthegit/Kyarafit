import { uploadTestBlob } from "./mediaTestHelpers.fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  REPLICA_PROTOCOL_VERSION as protocol,
  REPLICA_RETENTION_MS,
  type ReplicaOp,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { DOWNGRADE_RETENTION_MS } from "@kyarafit/design-system/domain/tierTransition";

// Backend contract for the managed-sync row replica (convex/replica.ts).
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);
type Harness = ReturnType<typeof convexTest>;

afterEach(() => {
  vi.useRealTimers();
});

async function user(t: Harness, externalId: string, tier = "SUPPORTER") {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.invalid`,
      tier,
      currentUsageMb: 0,
    })
  );
}

let opSeq = 0;
function put(
  rowId: string,
  fields: Record<string, unknown>,
  baseRev = 0,
  table = "builds"
): ReplicaOp {
  return { opId: `op-${++opSeq}`, table, rowId, kind: "put", fields, baseRev };
}
function del(rowId: string, baseRev = 0, table = "builds"): ReplicaOp {
  return { opId: `op-${++opSeq}`, table, rowId, kind: "delete", baseRev };
}

function session(t: Harness, subject: string) {
  const as = t.withIdentity({ subject });
  return {
    push: (ops: ReplicaOp[], deviceId = "A") =>
      as.mutation(api.replica.push, { protocol, subject, deviceId, ops }),
    pull: (after = 0, limit?: number) =>
      as.query(api.replica.pull, { protocol, subject, after, limit }),
    dismiss: (ids: string[]) =>
      as.mutation(api.replica.dismissConflicts, { protocol, subject, ids }),
  };
}

async function liveRows(t: Harness, userId: string) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .query("replicaRows")
        .withIndex("by_user_row", (q) => q.eq("userId", userId))
        .collect()
    ).filter((row) => !row.deleted)
  );
}

describe("replica containment", () => {
  it("rejects unauthenticated, free-tier and mismatched-account callers", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    await user(t, "free", "FREE");
    await expect(
      t.mutation(api.replica.push, { protocol, subject: "alice", deviceId: "A", ops: [] })
    ).rejects.toThrow(/Unauthorized/);
    await expect(session(t, "free").push([put("local:1", { name: "x" })])).rejects.toThrow(
      /Sync requires Kyarafit Cloud/
    );
    // A vault for one account can never be pushed under another account's session.
    await expect(
      t.withIdentity({ subject: "alice" }).mutation(api.replica.push, {
        protocol,
        subject: "free",
        deviceId: "A",
        ops: [],
      })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.withIdentity({ subject: "alice" }).query(api.replica.pull, {
        protocol,
        subject: "alice",
        after: 0,
      })
    ).resolves.toMatchObject({ rows: [] });
    await expect(
      session(t, "alice").push([{ ...put("local:1", {}), table: "users" }])
    ).rejects.toThrow(/Not a synced table/);
    await expect(
      t.withIdentity({ subject: "alice" }).mutation(api.replica.push, {
        protocol: protocol + 1,
        subject: "alice",
        deviceId: "A",
        ops: [],
      })
    ).rejects.toThrow(/Update the app/);
  });

  it("keeps each account's rows separate even for the same row id", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    await user(t, "bob");
    await session(t, "alice").push([put("local:same", { name: "Alice's" })]);
    await session(t, "bob").push([put("local:same", { name: "Bob's" })]);
    expect((await session(t, "alice").pull()).rows.map((r) => r.doc?.name)).toEqual(["Alice's"]);
    expect((await session(t, "bob").pull()).rows.map((r) => r.doc?.name)).toEqual(["Bob's"]);
    await session(t, "bob").push([del("local:same")]);
    expect((await liveRows(t, "alice")).map((r) => r.doc.name)).toEqual(["Alice's"]);
  });
});

describe("replica push and pull", () => {
  it("dedupes a resent batch after a lost acknowledgement", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    const ops = [put("local:1", { name: "Zelda" }), put("local:2", { name: "Link" })];
    const first = await alice.push(ops);
    const again = await alice.push(ops);
    expect(again.outcomes).toEqual(first.outcomes);
    expect(again.head).toBe(first.head);
    expect(await liveRows(t, "alice")).toHaveLength(2);
  });

  it("pages both a cycle repair and a concurrent field conflict after 499 preceding conflicts", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([
      put("local:x", { title: "X" }, 0, "workflowItems"),
      put("local:y", { title: "Original Y" }, 0, "workflowItems"),
    ]);
    const base = (await alice.pull()).cursor;
    await t.run(async ctx => {
      for (let i = 1; i <= 499; i++) await ctx.db.insert("replicaConflicts", {
        userId: "alice", table: "workflowItems", rowId: `fixture-${i}`,
        kind: "concurrent-field-edit", lost: { title: `Prior ${i}` },
        rev: base + i, createdAt: Date.now(), dismissed: false,
      });
      const head = await ctx.db.query("replicaHeads").withIndex("by_user", q => q.eq("userId", "alice")).unique();
      await ctx.db.patch(head!._id, { rev: base + 499 });
    });
    await alice.push([
      put("local:x", { parentId: "local:y" }, base, "workflowItems"),
      put("local:y", { title: "A's Y" }, base, "workflowItems"),
    ], "A");
    await alice.push([put("local:y", { parentId: "local:x", title: "B's Y" }, base, "workflowItems")], "B");
    const first = await alice.pull();
    expect(first.conflicts).toHaveLength(500);
    expect(first.hasMore).toBe(true);
    const second = await alice.pull(first.cursor);
    const conflicts = [...first.conflicts, ...second.conflicts];
    expect(conflicts).toHaveLength(501);
    expect(new Set(conflicts.map(row => row.id)).size).toBe(501);
    expect(conflicts.filter(row => row.rowId === "local:y").map(row => row.kind).sort()).toEqual([
      "concurrent-field-edit", "orphan-unlinked",
    ]);
    expect(second.hasMore).toBe(false);
    const y = (await liveRows(t, "alice")).find(row => row.rowId === "local:y")!;
    expect(y.doc.title).toBe("B's Y");
    expect(y.doc.parentId).toBeUndefined();
  });

  it("pages a complete prefix and advances past revs that changed no row", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:1", { name: "a" }), put("local:2", { name: "b" })]);
    const last = await alice.push([del("local:1"), put("local:1", { name: "late" })]);
    const page1 = await alice.pull(0, 1);
    expect(page1).toMatchObject({ hasMore: true, cursor: page1.rows[0].rev });
    const rest = await alice.pull(page1.cursor);
    expect(rest.hasMore).toBe(false);
    expect(rest.cursor).toBe(last.head);
    expect(rest.conflicts.map((c) => c.kind)).toEqual(["edit-after-delete"]);
    expect(rest.rows.find((r) => r.rowId === "local:1")).toMatchObject({ deleted: true });
    expect(rest.rows.find((r) => r.rowId === "local:1")).not.toHaveProperty("doc");
  });

  it("merges different fields, keeps the loser of a same-field edit, and never flags a device's own edits", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:b", { name: "Zelda", notes: "" })], "A");
    const base = (await alice.pull()).cursor;
    await alice.push([put("local:b", { name: "Zelda (BotW)" }, base)], "A");
    await alice.push([put("local:b", { name: "Zelda (BotW) v2" }, base)], "A"); // own unacked edit
    await alice.push([put("local:b", { name: "Zelda (TotK)", notes: "wig" }, base)], "B");
    await alice.push([put("local:b", { updatedAt: 5, version: 9 }, base)], "A"); // bookkeeping
    const pulled = await alice.pull();
    expect(pulled.rows[0].doc).toMatchObject({ name: "Zelda (TotK)", notes: "wig" });
    expect(pulled.conflicts.map(({ kind, lost }) => ({ kind, lost }))).toEqual([
      { kind: "concurrent-field-edit", lost: { name: "Zelda (BotW) v2" } },
    ]);
  });

  it("lets delete win in both orders and keeps the full losing row", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:b", { name: "Zelda", status: "wip" })], "A");
    const base = (await alice.pull()).cursor;
    // Delete first, then an edit made without seeing it.
    await alice.push([del("local:b", base)], "A");
    await alice.push([put("local:b", { name: "Zelda v2" }, base)], "B");
    // Edit first, then a delete made without seeing it.
    await alice.push([put("local:c", { name: "Midna" })], "A");
    const base2 = (await alice.pull()).cursor;
    await alice.push([put("local:c", { notes: "edited first" }, base2)], "B");
    await alice.push([del("local:c", base2)], "A");
    const { conflicts } = await alice.pull();
    expect(conflicts.map(({ kind, rowId, lost }) => ({ kind, rowId, lost }))).toEqual([
      { kind: "edit-after-delete", rowId: "local:b", lost: { name: "Zelda v2", status: "wip" } },
      {
        kind: "delete-over-unseen-edit",
        rowId: "local:c",
        lost: { name: "Midna", notes: "edited first" },
      },
    ]);
    expect(await liveRows(t, "alice")).toHaveLength(0);
  });

  it("streams dismissals so every device drops the record", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:b", { name: "a" })]);
    await alice.push([del("local:b"), put("local:b", { name: "b" })], "A");
    const first = await alice.pull();
    expect(first.conflicts).toHaveLength(1);
    expect(await alice.dismiss([first.conflicts[0].id])).toEqual({ dismissed: 1 });
    expect(await alice.dismiss([first.conflicts[0].id])).toEqual({ dismissed: 0 });
    const next = await alice.pull(first.cursor);
    expect(next.conflicts).toMatchObject([{ id: first.conflicts[0].id, dismissed: true }]);
  });
});

describe("replica cross-row integrity", () => {
  it("moves content added under a deleted build into a Recovered build and unlinks elements", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([
      put("local:b", { name: "Zelda", userId: "alice" }),
      put("local:n", { name: "Tunic", nodeType: "element", buildId: "local:b" }, 0, "cosplayNodes"),
    ]);
    await alice.push([del("local:b")], "A");
    // Device B, offline, added a photo and a task to the build A deleted.
    await alice.push(
      [
        put("local:p", { buildId: "local:b", sortOrder: 0 }, 0, "buildReferenceImages"),
        put("local:t", { buildId: "local:b", label: "Sew", sortOrder: 0 }, 0, "buildTasks"),
      ],
      "B"
    );
    const rows = new Map((await liveRows(t, "alice")).map((row) => [row.rowId, row]));
    const recovered = [...rows.values()].find((row) => row.doc.recovered === true)!;
    expect(recovered.doc).toMatchObject({ name: "Recovered", userId: "alice", status: "idea" });
    expect(rows.get("local:p")!.doc.buildId).toBe(recovered.rowId);
    expect(rows.get("local:t")!.doc.buildId).toBe(recovered.rowId);
    // The element survived A's cascade unlinked (A's own cascade would do the same).
    expect(rows.get("local:n")!.doc).not.toHaveProperty("buildId");
    const kinds = (await alice.pull()).conflicts.map((c) => [c.kind, c.rowId]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["orphan-unlinked", "local:n"],
        ["orphan-recovered", "local:p"],
        ["orphan-recovered", "local:t"],
      ])
    );
  });

  it("repairs children that reached the server before their parent's delete", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([
      put("local:b", { name: "Zelda" }),
      put(
        "local:c",
        { name: "Con", startDate: "2026-01-01", endDate: "2026-01-02" },
        0,
        "conventions"
      ),
    ]);
    const base = (await alice.pull()).cursor;
    await alice.push(
      [
        put("local:p", { buildId: "local:b", sortOrder: 0 }, 0, "buildProcessPictures"),
        put(
          "local:k",
          { conventionId: "local:c", label: "Wig", checked: false },
          0,
          "packingListItems"
        ),
      ],
      "B"
    );
    // A deletes both parents without having seen B's children.
    await alice.push([del("local:b", base), del("local:c", base, "conventions")], "A");
    const rows = new Map((await liveRows(t, "alice")).map((row) => [row.rowId, row]));
    const recovered = [...rows.values()].find((row) => row.doc.recovered === true)!;
    expect(rows.get("local:p")!.doc.buildId).toBe(recovered.rowId);
    expect(rows.has("local:k")).toBe(false);
    const removed = (await alice.pull()).conflicts.find((c) => c.kind === "orphan-removed")!;
    expect(removed).toMatchObject({ rowId: "local:k", lost: { label: "Wig" } });
  });

  it("starts a new Recovered build after the user deletes the old one", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:b", { name: "a" }), del("local:b")]);
    await alice.push([
      put("local:p", { buildId: "local:b", sortOrder: 0 }, 0, "buildReferenceImages"),
    ]);
    const first = (await liveRows(t, "alice")).find((row) => row.doc.recovered)!;
    await alice.push([del("local:p"), del(first.rowId)]);
    await alice.push([
      put("local:q", { buildId: "local:b", sortOrder: 1 }, 0, "buildReferenceImages"),
    ]);
    const live = await liveRows(t, "alice");
    const second = live.find((row) => row.doc.recovered)!;
    expect(second.rowId).not.toBe(first.rowId);
    expect(live.find((row) => row.rowId === "local:q")!.doc.buildId).toBe(second.rowId);
  });

  it("recovers an unseen-parent reference even if that parent arrives later", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([
      put("local:p", { buildId: "local:later", sortOrder: 0 }, 0, "buildReferenceImages"),
    ]);
    await alice.push([put("local:later", { name: "Arrives next batch" })]);
    const rows = await liveRows(t, "alice");
    const recovered = rows.find((row) => row.doc.recovered)!;
    expect(rows.find((row) => row.rowId === "local:p")!.doc.buildId).toBe(recovered.rowId);
    expect(rows.some((row) => row.rowId === "local:later")).toBe(true);
    expect((await alice.pull()).conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowId: "local:p", kind: "orphan-recovered", lost: { buildId: "local:later" } }),
    ]));
  });
});

describe("replica retention", () => {
  it("purges old dedupe records, tombstones and conflicts and makes stale cursors resnapshot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const alice = session(t, "alice");
    await alice.push([put("local:keep", { name: "keep" }), put("local:gone", { name: "gone" })]);
    const staleCursor = (await alice.pull()).cursor;
    await alice.push([del("local:gone"), put("local:gone", { name: "late" })], "A");
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1000);
    await alice.push([put("local:fresh", { name: "fresh" })]);
    const pruned = await t.mutation(internal.replica.prune, {});
    expect(pruned).toMatchObject({ ops: 4, tombstones: 1, conflicts: 1, more: false });
    // A device that last pulled before the purged tombstone must start over.
    expect(await alice.pull(staleCursor)).toMatchObject({ resnapshot: true, rows: [] });
    const full = await alice.pull(0);
    expect(full.resnapshot).toBe(false);
    expect(full.rows.map((row) => row.rowId).sort()).toEqual(["local:fresh", "local:keep"]);
    // An up-to-date cursor keeps working.
    expect((await alice.pull(full.cursor)).resnapshot).toBe(false);
  });
});

describe("replica media", () => {
  it("registers a synced photo for its owner only and releases it with the account", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    await user(t, "bob");
    const storageId = await uploadTestBlob(t, "alice", new Blob(["photo"], { type: "image/jpeg" }));
    const asAlice = t.withIdentity({ subject: "alice" });
    await expect(
      asAlice.mutation(api.replica.registerAsset, {
        protocol,
        subject: "alice",
        imageKey: "../escape",
        storageId,
      })
    ).rejects.toThrow(/Invalid photo key/);
    expect(
      await asAlice.mutation(api.replica.registerAsset, {
        protocol,
        subject: "alice",
        imageKey: "img_1",
        storageId,
      })
    ).toEqual({ registered: true });
    // Bob cannot claim Alice's blob under his own key.
    await expect(
      t.withIdentity({ subject: "bob" }).mutation(api.replica.registerAsset, {
        protocol,
        subject: "bob",
        imageKey: "img_1",
        storageId,
      })
    ).rejects.toThrow(/not authorized/);
    const urls = await asAlice.query(api.replica.assetUrls, {
      protocol,
      subject: "alice",
      imageKeys: ["img_1", "img_missing"],
    });
    expect(urls.map((u) => u.imageKey)).toEqual(["img_1"]);
    expect(await asAlice.query(api.files.getUrl, { storageId })).toEqual(expect.any(String));
    expect(await t.withIdentity({ subject: "bob" }).query(api.files.getUrl, { storageId })).toBe(
      null
    );
    expect(await t.query(api.files.getUrl, { storageId })).toBe(null);
  });

  it("purges a downgraded account's replica and its photo bytes after retention", async () => {
    const t = convexTest(schema, modules);
    const alice = await user(t, "alice");
    const storageId = await uploadTestBlob(t, "alice", new Blob(["photo"], { type: "image/jpeg" }));
    const asAlice = t.withIdentity({ subject: "alice" });
    await session(t, "alice").push([put("local:b", { name: "a" })]);
    await asAlice.mutation(api.replica.registerAsset, {
      protocol,
      subject: "alice",
      imageKey: "img_1",
      storageId,
    });
    const now = Date.now();
    await t.run((ctx) =>
      ctx.db.patch(alice, { tier: "FREE", downgradedAt: now - DOWNGRADE_RETENTION_MS - 1 })
    );
    await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now });
    const left = await t.run(async (ctx) => ({
      rows: await ctx.db.query("replicaRows").collect(),
      heads: await ctx.db.query("replicaHeads").collect(),
      assets: await ctx.db.query("replicaAssets").collect(),
      blob: await ctx.db.system.get("_storage", storageId as Id<"_storage">),
    }));
    expect(left).toMatchObject({ rows: [], assets: [], blob: null });
    expect(left.heads).toHaveLength(1);
    expect(left.heads[0].generation).toBeTruthy();
  });

  it("deletes the replica and its photos with the account", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await user(t, "alice");
    const storageId = await uploadTestBlob(t, "alice", new Blob(["photo"], { type: "image/jpeg" }));
    await session(t, "alice").push([
      put("local:b", { name: "a" }),
      put("local:p", { buildId: "local:b", sortOrder: 0 }, 0, "buildReferenceImages"),
    ]);
    await t.withIdentity({ subject: "alice" }).mutation(api.replica.registerAsset, {
      protocol,
      subject: "alice",
      imageKey: "img_1",
      storageId,
    });
    await t.mutation(
      makeFunctionReference<"mutation", { externalId: string }>("accountDeletion:begin"),
      { externalId: "alice" }
    );
    await Reflect.apply(t.finishAllScheduledFunctions, t, [vi.runAllTimers, 20000]);
    const left = await t.run(async (ctx) => ({
      rows: (await ctx.db.query("replicaRows").collect()).length,
      links: (await ctx.db.query("replicaLinks").collect()).length,
      ops: (await ctx.db.query("replicaOps").collect()).length,
      heads: (await ctx.db.query("replicaHeads").collect()).length,
      assets: (await ctx.db.query("replicaAssets").collect()).length,
      blob: await ctx.db.system.get("_storage", storageId as Id<"_storage">),
    }));
    expect(left).toEqual({ rows: 0, links: 0, ops: 0, heads: 0, assets: 0, blob: null });
  });
});

describe("explicit publication", () => {
  it("projects a vault build for any tier and re-publishes without touching social settings", async () => {
    const t = convexTest(schema, modules);
    await user(t, "free", "FREE");
    await user(t, "bob");
    const asFree = t.withIdentity({ subject: "free" });
    const { id } = await asFree.mutation(api.publications.publish, {
      table: "builds",
      clientId: "local:b",
      doc: { name: "Zelda", status: "wip", userId: "free", _creationTime: 1, updatedAt: 1 },
    });
    await t.run((ctx) => ctx.db.patch(id as Id<"builds">, { visibility: "public" }));
    const again = await asFree.mutation(api.publications.publish, {
      table: "builds",
      clientId: "local:b",
      doc: { name: "Zelda (TotK)", status: "wip" },
    });
    expect(again.id).toBe(id);
    const row = await t.run((ctx) => ctx.db.get(id as Id<"builds">));
    expect(row).toMatchObject({
      name: "Zelda (TotK)",
      visibility: "public",
      userId: "free",
      clientId: "local:b",
    });
    // Another account cannot publish over a server copy it does not own.
    await expect(
      t.withIdentity({ subject: "bob" }).mutation(api.publications.publish, {
        table: "builds",
        clientId: id,
        doc: { name: "Hijack", status: "idea" },
      })
    ).rejects.toThrow(/not authorized/);
    await expect(
      t.mutation(api.publications.publish, {
        table: "builds",
        clientId: "local:x",
        doc: { name: "x", status: "idea" },
      })
    ).rejects.toThrow(/Unauthorized/);
  });

  it("unpublishes idempotently and only the caller's own copy", async () => {
    const t = convexTest(schema, modules);
    await user(t, "alice");
    await user(t, "bob");
    const asAlice = t.withIdentity({ subject: "alice" });
    const { id } = await asAlice.mutation(api.publications.publish, {
      table: "builds",
      clientId: "local:b",
      doc: { name: "Zelda", status: "wip" },
    });
    expect(
      await t
        .withIdentity({ subject: "bob" })
        .mutation(api.publications.unpublish, { table: "builds", clientId: id })
    ).toEqual({ removed: false });
    expect(
      await asAlice.mutation(api.publications.unpublish, { table: "builds", clientId: id })
    ).toEqual({ removed: true });
    expect(
      await asAlice.mutation(api.publications.unpublish, { table: "builds", clientId: id })
    ).toEqual({ removed: false });
    expect(
      await asAlice.mutation(api.publications.unpublish, {
        table: "conventions",
        clientId: "not-an-id",
      })
    ).toEqual({ removed: false });
    expect(await t.run((ctx) => ctx.db.get(id as Id<"builds">))).toBeNull();
  });
});
