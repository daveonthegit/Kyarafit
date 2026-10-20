// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import { REPLICA_PROTOCOL_VERSION as protocol, REPLICA_RETENTION_MS, type ReplicaOp } from "@kyarafit/design-system/domain/replicaProtocol";
import { DOWNGRADE_RETENTION_MS } from "@kyarafit/design-system/domain/tierTransition";
import { makeDevice, seedSlice, settle, type ReplicaBackend } from "@/test-support/replicaHarness";
import { convexReplicaTransport } from "./convexTransport";
import { syncReplicaAssets, type ReplicaAssetIo } from "./assets";
import { ReplicaScheduler } from "./scheduler";
import { countChangesNotApplied } from "./conflicts";

const modules = import.meta.glob(["../../../../convex/**/*.{ts,js}", "!../../../../convex/**/*.test.ts", "!../../../../convex/betterAuth/**", "!../../../../convex/node_modules/**"]);
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const user = await t.run(ctx => ctx.db.insert("users", { externalId: "owner", email: "owner@example.invalid", tier: "SUPPORTER", currentUsageMb: 0 }));
  const actor = t.withIdentity({ subject: "owner" });
  const backend: ReplicaBackend = {
    subject: "owner",
    transport: net => convexReplicaTransport({
      mutation: (ref, args) => actor.mutation(ref as never, args as never),
      query: (ref, args) => actor.query(ref as never, args as never),
    }, { subject: "owner", isOnline: () => net.online }),
  };
  const a = makeDevice("A", backend, { runId: "review" });
  const b = makeDevice("B", backend, { runId: "review" });
  return { t, user, actor, a, b };
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
  it("reconciles expired edits before pushing, keeping losing content rather than resurrecting it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { t, a, b, actor } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    b.net.online = false;
    b.mutate("builds:update", { id: ids.build, notes: "offline edit" });
    const child = b.store.commit(db => db.insert("buildReferenceImages", { buildId: ids.build, imageUrl: "https://example.invalid/p.png", sortOrder: 0 }));
    a.mutate("builds:remove", { id: ids.build });
    await a.sync();
    const before = await actor.query(api.replica.pull, { protocol, subject: "owner", after: 0 });
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 1);
    await t.mutation(internal.replica.prune, {});
    const stale: ReplicaOp = { opId: "stale", table: "builds", rowId: ids.build, kind: "put", fields: { notes: "corrupt" }, baseRev: 0 };
    expect(await actor.mutation(api.replica.push, { protocol, subject: "owner", deviceId: "stale", ops: [stale], after: 1 })).toMatchObject({ resnapshot: true, outcomes: [] });
    b.net.online = true;
    await settle(a, b);
    expect(b.replicator.status).toBe("idle");
    expect(b.get(ids.build)).toBeNull();
    expect(b.changes(ids.build)).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "edit-after-delete", lost: expect.objectContaining({ notes: "offline edit" }) })]));
    expect(b.get(child)?.buildId).not.toBe(ids.build);
    expect(before.cursor).toBeGreaterThan(1);
  });

  it.each(["cosplayNodes", "workflowItems"])("breaks concurrent %s cycles and derives workflow ancestor caches", async table => {
    const { a, b } = await setup();
    const parentField = table === "cosplayNodes" ? "parentNodeId" : "parentId";
    const [x, y, z] = a.store.commit(db => ["X", "Y", "Z"].map(name => db.insert(table, table === "cosplayNodes" ? { name, nodeType: "element", tags: [] } : { title: name, kind: "task", category: "craft", status: "not_started", ancestorIds: [], sortOrder: 0, scopeKind: "shared", sourceKind: "manual" })));
    a.store.commit(db => db.patch(z, { [parentField]: x }));
    await settle(a, b);
    a.store.commit(db => db.patch(x, { [parentField]: y, ancestorIds: ["forged"] }));
    b.store.commit(db => db.patch(y, { [parentField]: x, ancestorIds: ["forged"] }));
    await settle(a, b);
    expect(a.get(x)?.[parentField] === y && a.get(y)?.[parentField] === x).toBe(false);
    expect(b.get(x)).toEqual(a.get(x));
    if (table === "workflowItems") {
      const ancestors = a.get(x)?.parentId === y ? [y, x] : [x];
      expect(a.get(z)?.ancestorIds).toEqual(ancestors);
      expect(a.get(y)?.ancestorIds).not.toContain("forged");
    }
  });

  it("uses one identity for concurrently generated purchase and packing tasks", async () => {
    const { a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    for (const d of [a, b]) d.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: "to_buy" });
    await settle(a, b);
    const tasks = a.store.exportRows().filter(row => row.table === "workflowItems" && String(row.doc.dedupeKey).startsWith("autogen:buy:"));
    expect(tasks).toHaveLength(1);
    expect(() => a.mutate("cosplayNodes:update", { id: ids.tunic, name: "Renamed" })).not.toThrow();
    await settle(a, b);
    expect(b.get(tasks[0].id)?.title).toBe("Buy Renamed");
    const convention = a.mutate<{ _id: string }>("conventions:create", { name: "Expo", startDate: "2026-10-01", endDate: "2026-10-02" });
    const packing = a.store.commit(db => db.insert("packingListItems", { userId: "owner", conventionId: convention._id, label: "Wig", checked: false }));
    await settle(a, b);
    for (const d of [a, b]) d.mutate("conventions:updatePackingItem", { id: packing, checked: true });
    await settle(a, b);
    expect(a.store.exportRows().filter(row => row.table === "workflowItems" && row.doc.dedupeKey === `packing:${packing}`)).toHaveLength(1);
    a.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: null });
    await settle(a, b);
    a.mutate("cosplayNodes:update", { id: ids.tunic, purchaseStatus: "to_buy" });
    await settle(a, b);
    expect(a.store.exportRows().filter(row => row.table === "workflowItems" && String(row.doc.dedupeKey).startsWith("autogen:buy:"))).toHaveLength(1);
  });

  it.each(["builds", "conventions"] as const)("clears omitted %s publication fields and removes copies by client identity", async table => {
    const { actor, t, a, b } = await setup();
    const required = table === "builds" ? { name: "Build", status: "idea" } : { name: "Event", startDate: "2026-10-01", endDate: "2026-10-02" };
    const optional = table === "builds" ? { notes: "secret", character: "Link", imageFocalX: 0.5, budgetCents: 100, targetDate: "2026-10-01", manualProgressPercent: 50 } : { location: "Venue", archived: true };
    const localId = a.store.commit(db => db.insert(table, { ...required, ...optional }));
    await settle(a, b);
    const { id } = await actor.mutation(api.publications.publish, { table, clientId: localId, doc: { ...required, ...optional } });
    await actor.mutation(api.publications.publish, { table, clientId: localId, doc: required });
    const row = await t.run(ctx => ctx.db.get(id as never)) as Record<string, unknown>;
    for (const key of Object.keys(optional)) expect(row[key]).toBeUndefined();
    b.store.commit(db => db.delete(localId));
    await settle(a, b);
    expect(await t.run(ctx => ctx.db.get(id as never))).toBeNull();
    expect(a.sql.getAllSync("SELECT * FROM publish_removals")).toHaveLength(1);
  });

  it("reseeds rows and photo upload markers after a downgrade reset", async () => {
    const { t, user, a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    a.sql.runSync("INSERT INTO replica_assets (image_key, uploaded_at) VALUES (?, ?)", ["img_ref1", 1]);
    await t.run(ctx => ctx.db.patch(user, { tier: "FREE", downgradedAt: Date.now() - DOWNGRADE_RETENTION_MS - 1 }));
    await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {});
    await t.run(ctx => ctx.db.patch(user, { tier: "SUPPORTER", cloudPurgedAt: undefined }));
    await a.sync();
    expect(a.get(ids.build)?.name).toBe("Zelda");
    expect(a.sql.getAllSync("SELECT * FROM replica_assets")).toEqual([]);
    expect((await t.run(ctx => ctx.db.query("replicaRows").collect())).some(row => row.rowId === ids.build && !row.deleted)).toBe(true);
    const io = assetIo();
    expect((await syncReplicaAssets(a.sql, io)).uploaded).toBe(1);
    await settle(a, b);
    expect(b.get(ids.build)?.name).toBe("Zelda");
  });

  it("includes attached tasks and nested elements in per-build conflict lists", async () => {
    const { a, b } = await setup();
    const ids = seedSlice(a);
    await settle(a, b);
    a.store.commit(db => { db.patch(ids.task, { title: "A task" }); db.patch(ids.belt, { name: "A belt" }); });
    b.store.commit(db => { db.patch(ids.task, { title: "B task" }); db.patch(ids.belt, { name: "B belt" }); });
    await settle(a, b);
    expect(a.changes(ids.build).map(change => change.rowId)).toEqual(expect.arrayContaining([ids.task, ids.belt]));
    expect(countChangesNotApplied(a.sql, ids.build)).toBe(a.changes(ids.build).length);
  });

  it("schedules and drains more than one batch of conflict acknowledgements", async () => {
    const { a } = await setup();
    for (let i = 0; i < 101; i++) a.sql.runSync(
      "INSERT INTO replica_conflicts (id, table_name, row_id, kind, lost_json, rev, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [`c${i}`, "builds", `b${i}`, "concurrent-field-edit", "{}", i, 1]
    );
    const dismiss = vi.fn(async (_ids: string[]) => {});
    a.replicator.setTransport({ push: async () => ({ outcomes: [], head: 0 }), pull: async () => ({ rows: [], conflicts: [], cursor: 0, hasMore: false, resnapshot: false }), dismissConflicts: dismiss });
    vi.useFakeTimers();
    const scheduler = new ReplicaScheduler(a.replicator, { canSync: () => true, isEntitled: () => true });
    let pending = a.replicator.pendingCount();
    const unsubscribe = a.replicator.subscribe(() => { const next = a.replicator.pendingCount(); if (next > pending) scheduler.request(); pending = next; });
    a.replicator.resolveConflicts(Array.from({ length: 101 }, (_, i) => `c${i}`));
    await vi.advanceTimersByTimeAsync(1500);
    expect(dismiss.mock.calls.map(call => call[0].length)).toEqual([100, 1]);
    expect(a.replicator.pendingCount()).toBe(0);
    unsubscribe();
    scheduler.dispose();
  });

  it("continues bounded photo transfers and retries transient follow-up failures", async () => {
    const { a } = await setup();
    a.store.commit(db => { for (let i = 0; i < 21; i++) db.insert("builds", { name: `Photo ${i}`, imageUrl: `kyarafit-image:photo_${i}` }); });
    const io = assetIo();
    expect(await syncReplicaAssets(a.sql, io)).toMatchObject({ uploaded: 20, remaining: 1 });
    expect(await syncReplicaAssets(a.sql, io)).toMatchObject({ uploaded: 1, remaining: 0 });
    vi.useFakeTimers();
    const afterPass = vi.fn().mockResolvedValueOnce({ failed: 1, remaining: 0 }).mockResolvedValueOnce({ failed: 0, remaining: 1 }).mockResolvedValue({ failed: 0, remaining: 0 });
    const scheduler = new ReplicaScheduler(null, { canSync: () => true, isEntitled: () => true, random: () => 1, afterPass });
    await scheduler.run();
    await vi.advanceTimersByTimeAsync(3500);
    expect(afterPass).toHaveBeenCalledTimes(3);
    scheduler.dispose();
  });
});
