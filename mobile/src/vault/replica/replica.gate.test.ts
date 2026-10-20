// @vitest-environment node
import { convexTest } from "convex-test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REPLICA_RETENTION_MS } from "@kyarafit/design-system/domain/replicaProtocol";
import schema from "../../../../convex/schema";
import { convexReplicaTransport, type ReplicaConvexClient } from "./convexTransport";
import { restoreChange } from "./conflicts";
import {
  makeDevice,
  seedSlice,
  settle,
  type Device,
  type ReplicaBackend,
} from "@/test-support/replicaHarness";

/**
 * Managed-sync acceptance scenarios (sync spike §2 S1–S6, plus the cross-row orphan case and the
 * Phase 2 gate items in reach of a test): two simulated phones, each the real vault + handlers +
 * replicator over its own SQLite database, against the real Convex replica functions.
 *
 * By default the backend is `convex-test` (in-memory Convex with the real schema, validators,
 * indexes, auth checks and guards). The same scenarios run against a real NON-PRODUCTION
 * deployment when these are set (see docs/TESTING.md, "Managed-sync staging gate"):
 *
 *   KYARAFIT_GATE_CONVEX_URL  https://<dev-or-preview>.convex.cloud
 *   KYARAFIT_GATE_TOKEN       a Convex auth JWT for a Kyarafit Cloud (paid) test account
 *   KYARAFIT_GATE_SUBJECT     that account's subject (Better Auth user id)
 *
 * Real-deployment runs only add rows under fresh ids, so they can repeat against one account.
 * Scenarios that change tiers, travel in time or inspect server tables run on `convex-test` only.
 */

declare global {
  interface ImportMeta {
    glob: (pattern: string | string[]) => Record<string, () => Promise<unknown>>;
  }
}
const modules = import.meta.glob([
  "../../../../convex/**/*.{ts,js}",
  "!../../../../convex/**/*.test.ts",
  "!../../../../convex/**/*.fixture.ts",
  "!../../../../convex/betterAuth/**",
  "!../../../../convex/node_modules/**",
]);

const SUBJECT = "gate-user";
let runSeq = 0;
const newRunId = () => `r${Date.now().toString(36)}${++runSeq}`;

afterEach(() => {
  vi.useRealTimers();
});

type Harness = ReturnType<typeof convexTest>;

/** convex-test's typed call signatures, loosened to the transport's untyped client shape. */
function asClient(caller: Pick<Harness, "mutation" | "query">): ReplicaConvexClient {
  return {
    mutation: (ref, args) =>
      (caller.mutation as unknown as (r: unknown, a: unknown) => Promise<unknown>)(ref, args),
    query: (ref, args) =>
      (caller.query as unknown as (r: unknown, a: unknown) => Promise<unknown>)(ref, args),
  };
}

async function convexTestBackend(tier = "SUPPORTER") {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("users", {
      externalId: SUBJECT,
      email: "gate@example.invalid",
      tier,
      currentUsageMb: 0,
    })
  );
  const backend: ReplicaBackend = {
    subject: SUBJECT,
    transport: (net) => {
      const as = () => asClient(net.tokenValid ? t.withIdentity({ subject: SUBJECT }) : t);
      const client: ReplicaConvexClient = {
        mutation: (ref, args) => as().mutation(ref, args),
        query: (ref, args) => as().query(ref, args),
      };
      return convexReplicaTransport(client, { subject: SUBJECT, isOnline: () => net.online });
    },
  };
  return { t, backend };
}

const gate = {
  url: process.env.KYARAFIT_GATE_CONVEX_URL,
  token: process.env.KYARAFIT_GATE_TOKEN,
  subject: process.env.KYARAFIT_GATE_SUBJECT,
};
const gateConfigured = Boolean(gate.url && gate.token && gate.subject);

function deploymentBackend(): ReplicaBackend {
  if (/prod/i.test(gate.url!)) throw new Error("Refusing to run the sync gate against production");
  return {
    subject: gate.subject!,
    transport: (net) => {
      const valid = new ConvexHttpClient(gate.url!);
      valid.setAuth(gate.token!);
      const expired = new ConvexHttpClient(gate.url!);
      expired.setAuth("expired.session.token");
      const client: ReplicaConvexClient = {
        mutation: (ref, args) =>
          (net.tokenValid ? valid : expired).mutation(ref as never, args as never),
        query: (ref, args) => (net.tokenValid ? valid : expired).query(ref as never, args as never),
      };
      return convexReplicaTransport(client, { subject: gate.subject!, isOnline: () => net.online });
    },
  };
}

/** This run's rows on a device (a real deployment also holds earlier runs' rows). */
function runRows(d: Device, runId: string, table?: string) {
  return d.store
    .exportRows()
    .filter((row) => row.id.includes(runId) && (!table || row.table === table));
}

/** Two converged devices hold exactly the same rows. */
function expectConverged(a: Device, b: Device) {
  expect(a.snapshot()).toEqual(b.snapshot());
  expect(a.replicator.pendingCount()).toBe(0);
  expect(b.replicator.pendingCount()).toBe(0);
}

type BackendCase = { label: string; make: () => Promise<ReplicaBackend> };
const backends: BackendCase[] = [
  { label: "convex-test", make: async () => (await convexTestBackend()).backend },
];
if (gateConfigured) backends.push({ label: "deployment", make: async () => deploymentBackend() });

describe.each(backends)("managed sync on $label", ({ make }) => {
  it("S1: a build with a nested element, task and photo made offline on A reaches B intact", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    a.net.online = false;
    const ids = seedSlice(a);
    await a.sync();
    expect(a.replicator.status).toBe("offline");
    expect(a.replicator.pendingCount()).toBeGreaterThan(0);
    a.net.online = true;
    await a.sync();
    await b.sync();
    expectConverged(a, b);
    expect(
      b.query<{ name: string }[]>("cosplayNodes:listChildren", { parentNodeId: ids.tunic })
    ).toMatchObject([{ name: "Belt" }]);
    expect(b.get(ids.photo)?.imageUrl).toBe("kyarafit-image:img_ref1");
    expect(b.get(ids.build)?._id).toBe(ids.build);
  });

  it("S2: concurrent offline edits keep different fields, and the same-field loser is restorable", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const ids = seedSlice(a);
    await settle(a, b);
    a.net.online = b.net.online = false;
    // Same device clock on both phones: the server's order decides, not timestamps.
    a.store.commit((db) => db.patch(ids.build, { name: "Zelda (BotW)" }));
    b.store.commit((db) => db.patch(ids.build, { name: "Zelda (TotK)", notes: "needs wig" }));
    a.mutate("cosplayNodes:update", { id: ids.belt, notes: "brown leather" });
    b.mutate("cosplayNodes:update", { id: ids.belt, name: "Leather belt" });
    a.net.online = b.net.online = true;
    await settle(a, b);
    expectConverged(a, b);
    expect(a.get(ids.build)).toMatchObject({ name: "Zelda (TotK)", notes: "needs wig" });
    expect(a.get(ids.belt)).toMatchObject({ name: "Leather belt", notes: "brown leather" });

    const [lost] = a.changes(ids.build);
    expect(lost).toMatchObject({
      kind: "concurrent-field-edit",
      action: "restore-fields",
      restorable: true,
      lost: { name: "Zelda (BotW)" },
    });
    // One tap: restore as a new edit, which syncs like any other and clears the record everywhere.
    restoreChange(a.store, lost);
    a.replicator.resolveConflicts([lost.id]);
    await settle(a, b);
    expectConverged(a, b);
    expect(b.get(ids.build)?.name).toBe("Zelda (BotW)");
    expect(a.changes(ids.build)).toEqual([]);
    expect(b.changes(ids.build)).toEqual([]);
  });

  it("S3: delete wins over an offline edit; the edit and a photo added offline are kept", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const ids = seedSlice(a);
    await settle(a, b);
    a.net.online = b.net.online = false;
    a.mutate("builds:remove", { id: ids.build });
    b.mutate("builds:update", { id: ids.build, name: "Zelda v2" });
    b.mutate("cosplayNodes:update", { id: ids.belt, notes: "add buckle" });
    const late = b.mutate<{ _id: string }>("buildReferenceImages:add", {
      buildId: ids.build,
      imageUrl: "kyarafit-image:img_late",
    });
    a.net.online = b.net.online = true;
    await settle(a, b);
    expectConverged(a, b);
    expect(a.get(ids.build)).toBeNull();
    expect(b.get(ids.task)).toBeNull();
    expect(b.get(ids.belt)).toMatchObject({ notes: "add buckle" });
    expect(b.get(ids.belt)?.buildId).toBeUndefined();

    // Cross-row integrity: the photo B added under the deleted build is not an orphan anywhere.
    const recovered = a
      .query<{ _id: string; recovered?: boolean; name: string }[]>("builds:list", {})
      .find((build) => build.recovered === true);
    expect(recovered).toMatchObject({ name: "Recovered" });
    for (const d of [a, b]) {
      const photo = d.get(late._id);
      expect(photo?.buildId).toBe(recovered!._id);
      expect(d.get(String(photo?.buildId))).not.toBeNull();
    }
    const kinds = b.changes().map((change) => [change.kind, change.rowId]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["edit-after-delete", ids.build],
        ["orphan-recovered", late._id],
      ])
    );
    // The lost edit is restorable as a new build.
    const edit = b.changes().find((change) => change.kind === "edit-after-delete")!;
    expect(edit).toMatchObject({ action: "restore-row", restorable: true, label: "Zelda v2" });
    const restoredId = restoreChange(b.store, edit);
    b.replicator.resolveConflicts([edit.id]);
    await settle(a, b);
    expect(a.get(restoredId)).toMatchObject({ name: "Zelda v2", status: "wip" });
  });

  it("S3 (reverse order): an edit that reached the server first is kept when a delete wins", async () => {
    const backend = await make();
    const runId = newRunId();
    const c = makeDevice("C", backend, { runId });
    const d = makeDevice("D", backend, { runId });
    const ids = seedSlice(c);
    await settle(c, d);
    c.net.online = d.net.online = false;
    d.mutate("builds:update", { id: ids.build, notes: "edited first" });
    c.mutate("builds:remove", { id: ids.build });
    c.net.online = d.net.online = true;
    await d.sync();
    await settle(c, d);
    expectConverged(c, d);
    expect(d.get(ids.build)).toBeNull();
    expect(c.changes().find((change) => change.rowId === ids.build)).toMatchObject({
      kind: "delete-over-unseen-edit",
      lost: { notes: "edited first" },
    });
  });

  it("cross-row: a photo that reached the server before its build's delete moves to Recovered", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const ids = seedSlice(a);
    await settle(a, b);
    a.net.online = false;
    const photo = b.mutate<{ _id: string }>("buildProcessPictures:add", {
      buildId: ids.build,
      imageUrl: "kyarafit-image:img_wip",
    });
    await b.sync(); // the photo is on the server before A's delete
    a.mutate("builds:remove", { id: ids.build }); // A never saw the photo
    a.net.online = true;
    await settle(a, b);
    expectConverged(a, b);
    const parent = a.get(String(a.get(photo._id)?.buildId));
    expect(parent).toMatchObject({ recovered: true, name: "Recovered" });
  });

  it("S5: an expired session pauses sync without losing or expiring anything", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const ids = seedSlice(a);
    await a.sync();
    a.net.online = false;
    a.mutate("builds:update", { id: ids.build, notes: "edited on a plane" });
    a.net.online = true;
    a.net.tokenValid = false;
    for (let i = 0; i < 15; i += 1) await a.sync();
    expect(a.replicator.status).toBe("needs-auth");
    expect(a.replicator.pendingCount()).toBe(1);
    a.mutate("builds:update", { id: ids.build, character: "Zelda" }); // local use continues
    a.net.tokenValid = true;
    await settle(a, b);
    expect(b.get(ids.build)).toMatchObject({ notes: "edited on a plane", character: "Zelda" });
  });

  it("S6: >500 rows across tables survive a lost push ack and a dropped pull page", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    a.store.commit((db) => {
      for (let i = 0; i < 700; i += 1)
        db.insert("builds", { userId: backend.subject, name: `b${i}`, status: "idea" });
      for (let i = 0; i < 700; i += 1)
        db.insert("cosplayNodes", { userId: backend.subject, nodeType: "material", name: `m${i}` });
    });
    a.net.loseNextPushAck = true;
    await a.sync(); // first batch applied server-side, acknowledgement lost
    expect(a.replicator.status).toBe("error");
    await a.sync(); // resent batch is deduplicated
    expect(a.replicator.pendingCount()).toBe(0);
    b.net.failPullPage = 3;
    await b.sync(); // dropped on page 2: the first page and its cursor are durable
    expect(b.replicator.status).toBe("error");
    expect(runRows(b, runId).length).toBeGreaterThan(0);
    await b.sync();
    expect(runRows(b, runId, "builds")).toHaveLength(700);
    expect(runRows(b, runId, "cosplayNodes")).toHaveLength(700);
  });

  it("two devices pushing at the same moment both land (per-account head contention)", async () => {
    const backend = await make();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    for (let i = 0; i < 40; i += 1) {
      a.mutate("builds:create", { name: `a${i}`, status: "idea" });
      b.mutate("builds:create", { name: `b${i}`, status: "idea" });
    }
    await Promise.all([a.sync(), b.sync()]);
    await settle(a, b);
    expectConverged(a, b);
    expect(runRows(a, runId, "builds")).toHaveLength(80);
  });
});

describe("managed sync gate items on convex-test", () => {
  it("S4: two free vaults that never synced merge on upgrade, ids and photo tokens intact", async () => {
    const { t, backend } = await convexTestBackend("FREE");
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId, replicate: false });
    const b = makeDevice("B", backend, { runId, replicate: false });
    const idsA = seedSlice(a);
    const idsB = seedSlice(b);
    b.mutate("builds:update", { id: idsB.build, name: "Link" });
    expect(a.replicator.pendingCount() + b.replicator.pendingCount()).toBe(0);
    a.replicator.enableReplication();
    await a.sync();
    expect(a.replicator.status).toBe("not-entitled");
    expect(a.replicator.pendingCount()).toBeGreaterThan(0); // nothing dropped
    await setTier(t, "SUPPORTER");
    b.replicator.enableReplication();
    await settle(a, b);
    expectConverged(a, b);
    expect(
      a
        .query<{ name: string }[]>("builds:list", {})
        .map((x) => x.name)
        .sort()
    ).toEqual(["Link", "Zelda"]);
    expect([a.get(idsA.photo)?.imageUrl, a.get(idsB.photo)?.imageUrl]).toEqual([
      "kyarafit-image:img_ref1",
      "kyarafit-image:img_ref1",
    ]);
  });

  it("a plan lapsing mid-sync pauses with the rest of the outbox kept", async () => {
    const { t, backend } = await convexTestBackend();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    a.store.commit((db) => {
      for (let i = 0; i < 250; i += 1) db.insert("builds", { name: `b${i}`, status: "idea" });
    });
    let pushes = 0;
    const transport = backend.transport(a.net);
    a.replicator.setTransport({
      ...transport,
      push: async (deviceId, ops) => {
        if (++pushes === 2) await setTier(t, "FREE");
        return transport.push(deviceId, ops);
      },
    });
    await a.sync();
    expect(a.replicator.status).toBe("not-entitled");
    expect(a.replicator.pendingCount()).toBe(150);
    await setTier(t, "SUPPORTER");
    await a.sync();
    expect(a.replicator.pendingCount()).toBe(0);
  });

  it("a session for another account can never write this vault into its replica", async () => {
    const { t, backend } = await convexTestBackend();
    await t.run((ctx) =>
      ctx.db.insert("users", {
        externalId: "someone-else",
        email: "else@example.invalid",
        tier: "SUPPORTER",
        currentUsageMb: 0,
      })
    );
    const a = makeDevice("A", backend, { runId: newRunId() });
    a.mutate("builds:create", { name: "Mine", status: "idea" });
    const other = asClient(t.withIdentity({ subject: "someone-else" }));
    a.replicator.setTransport(convexReplicaTransport(other, { subject: SUBJECT }));
    await a.sync();
    expect(a.replicator.status).toBe("needs-auth");
    expect(a.replicator.pendingCount()).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("replicaRows").collect())).toEqual([]);
  });

  it("a device offline past the retention horizon resnapshots, keeping its own unsynced edits", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { t, backend } = await convexTestBackend();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const keep = a.mutate<{ _id: string }>("builds:create", { name: "Keep", status: "idea" });
    const gone = a.mutate<{ _id: string }>("builds:create", { name: "Gone", status: "idea" });
    await settle(a, b);
    b.net.online = false;
    b.mutate("builds:update", { id: keep._id, notes: "written while away" });
    a.mutate("builds:remove", { id: gone._id });
    await a.sync();
    vi.setSystemTime(Date.now() + REPLICA_RETENTION_MS + 60_000);
    a.mutate("builds:create", { name: "Fresh", status: "idea" });
    await a.sync();
    await t.mutation(makeFunctionReference<"mutation">("replica:prune"), {});
    expect(b.get(gone._id)).not.toBeNull(); // B never saw the delete...
    b.net.online = true;
    await settle(a, b);
    expect(b.get(gone._id)).toBeNull(); // ...and the resnapshot removed it, tombstone or not.
    expectConverged(a, b);
    expect(a.get(keep._id)?.notes).toBe("written while away");
  });

  it("restoring a change whose parent is gone is refused, and dismissing clears it on every device", async () => {
    const { backend } = await convexTestBackend();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const b = makeDevice("B", backend, { runId });
    const convention = a.mutate<{ _id: string }>("conventions:create", {
      name: "Expo",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    });
    await settle(a, b);
    b.net.online = false;
    const item = b.mutate<{ _id: string }>("conventions:addManualPackingItem", {
      conventionId: convention._id,
      label: "Wig",
    });
    a.mutate("conventions:remove", { id: convention._id });
    await a.sync();
    b.net.online = true;
    await settle(a, b);
    expect(b.get(item._id)).toBeNull();
    const removed = b.changes().find((change) => change.rowId === item._id)!;
    expect(removed).toMatchObject({ kind: "orphan-removed", restorable: false });
    expect(() => restoreChange(b.store, removed)).toThrow(/deleted/);
    b.replicator.resolveConflicts([removed.id]);
    await settle(a, b);
    expect(a.changes().some((change) => change.id === removed.id)).toBe(false);
    expect(b.changes().some((change) => change.id === removed.id)).toBe(false);
  });

  it("server bookkeeping: no duplicates after retries and one tombstone per delete", async () => {
    const { t, backend } = await convexTestBackend();
    const runId = newRunId();
    const a = makeDevice("A", backend, { runId });
    const ids = seedSlice(a);
    a.net.loseNextPushAck = true;
    await a.sync();
    await a.sync();
    a.mutate("builds:remove", { id: ids.build });
    await a.sync();
    const rows = await t.run((ctx) => ctx.db.query("replicaRows").collect());
    const keys = rows.map((row) => `${row.table}/${row.rowId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(rows.filter((row) => row.deleted).map((row) => row.rowId)).toContain(ids.build);
  });
});

async function setTier(t: Harness, tier: string) {
  await t.run(async (ctx) => {
    const user = (await ctx.db.query("users").collect()).find(
      (row) => (row as { externalId?: string }).externalId === SUBJECT
    );
    await ctx.db.patch(user!._id, { tier } as never);
  });
}
