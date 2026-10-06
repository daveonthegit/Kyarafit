import "./mediaTestHelpers.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import type { MutationCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as builds from "./builds";
import * as users from "./users";
import {
  mutation,
  internalMutation,
  cleanupMutation,
  mutationGuardReads,
  MutationGuard,
} from "./lib/guardedMutation";
import { runIdempotent } from "./lib/idempotency";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function invoke(ctx: MutationCtx, registered: object, args: object = {}) {
  return Reflect.apply(Reflect.get(registered, "_handler"), registered, [ctx, args]);
}
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  const data = await t.run(async (ctx) => {
    const alphaUser = await ctx.db.insert("users", {
      externalId: "alice",
      email: "alice@example.invalid",
      tier: "PRO",
      role: "owner",
      currentUsageMb: 0,
    });
    const betaUser = await ctx.db.insert("users", {
      externalId: "bob",
      email: "bob@example.invalid",
      tier: "PRO",
      role: "owner",
      currentUsageMb: 0,
    });
    const alpha = await ctx.db.insert("builds", { userId: "alice", name: "Alpha", status: "idea" });
    const beta = await ctx.db.insert("builds", { userId: "bob", name: "Beta", status: "idea" });
    return { alphaUser, betaUser, alpha, beta };
  });
  return { t, ...data };
}

describe("mutation guard adapter", () => {
  for (const operation of [
    "insert",
    "patch",
    "replace",
    "delete",
    "tableInsert",
    "tablePatch",
    "tableReplace",
    "tableDelete",
  ] as const)
    it(`guards internal ${operation} including the table-scoped SDK surface`, async () => {
      const f = await fixture();
      const write = (target: "alpha" | "beta") =>
        internalMutation({
          args: {},
          handler: async (ctx) => {
            const userId = target === "alpha" ? "alice" : "bob";
            const id = f[target];
            const row = { userId, name: "Updated", status: "idea" };
            const scoped = Reflect.apply(Reflect.get(ctx.db, "table"), ctx.db, ["builds"]);
            if (operation === "insert") return ctx.db.insert("builds", row);
            if (operation === "patch") return ctx.db.patch("builds", id, { name: "Updated" });
            if (operation === "replace") return ctx.db.replace("builds", id, row);
            if (operation === "delete") return ctx.db.delete("builds", id);
            return Reflect.apply(
              Reflect.get(scoped, operation.slice(5).toLowerCase()),
              scoped,
              operation === "tableInsert"
                ? [row]
                : operation === "tableDelete"
                  ? [id]
                  : [id, operation === "tablePatch" ? { name: "Updated" } : row]
            );
          },
        });
      await f.t.run((ctx) => invoke(ctx, write("beta")));
      await f.t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
      await expect(f.t.run((ctx) => invoke(ctx, write("alpha")))).rejects.toThrow(
        "Account unavailable"
      );
    });

  it("checks unchanged references in an unrelated patch, but permits removal-only cleanup", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.betaUser, { focusedBuildId: f.alpha }));
    await f.t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
    const update = internalMutation({
      args: {},
      handler: (ctx) => ctx.db.patch(f.betaUser, { displayName: "Updated" }),
    });
    await expect(f.t.run((ctx) => invoke(ctx, update))).rejects.toThrow("Account unavailable");
    const detach = cleanupMutation({
      args: {},
      handler: (ctx) => ctx.db.patch(f.betaUser, { focusedBuildId: undefined }),
    });
    await f.t.run((ctx) => invoke(ctx, detach));
    await f.t.run((ctx) => invoke(ctx, update));
  });
  it("does not let cleanup flags add data, replace content, or create application rows", async () => {
    const f = await fixture();
    for (const write of [
      (ctx: MutationCtx) => ctx.db.insert("builds", { userId: "bob", name: "New", status: "idea" }),
      (ctx: MutationCtx) => ctx.db.patch(f.beta, { name: "Changed" }),
      (ctx: MutationCtx) =>
        ctx.db.replace(f.beta, { userId: "bob", name: "Changed", status: "idea" }),
    ])
      await expect(
        f.t.run((ctx) => invoke(ctx, cleanupMutation({ args: {}, handler: write })))
      ).rejects.toThrow(/Cleanup can/);
    const ordinary = internalMutation({
      args: {},
      handler: (ctx) => ctx.db.insert("accountDeletionState", { generation: 99 }),
    });
    await expect(f.t.run((ctx) => invoke(ctx, ordinary))).rejects.toThrow(
      "Cleanup capability required"
    );
  });
  it("invalidates actor and parent caches after nested deletion in the same transaction", async () => {
    const f = await fixture();
    const registered = mutation({
      args: {},
      handler: async (ctx) => {
        await ctx.runMutation(internal.accountDeletion.begin, { externalId: "bob" });
        return ctx.db.insert("builds", { userId: "alice", name: "Late", status: "idea" });
      },
    });
    await expect(
      f.t.withIdentity({ subject: "bob" }).run((ctx) => invoke(ctx, registered))
    ).rejects.toThrow("Account unavailable");
    expect(await f.t.run((ctx) => ctx.db.query("accountDeletionJobs").first())).toBeNull();
  });
  it("rejects missing targets, unknown dynamic references, and wrong table overloads", async () => {
    const f = await fixture();
    const missing = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("builds", { userId: "bob", name: "Missing", status: "idea" });
      await ctx.db.delete(id);
      return id;
    });
    const writes = [
      internalMutation({
        args: {},
        handler: (ctx) => ctx.db.patch(f.betaUser, { focusedBuildId: missing }),
      }),
      internalMutation({
        args: {},
        handler: (ctx) => ctx.db.patch("users", f.beta, { name: "Wrong" }),
      }),
    ];
    for (const write of writes)
      await expect(f.t.run((ctx) => invoke(ctx, write))).rejects.toThrow(
        /Account unavailable|Unknown reference shape/
      );
    const task = await f.t.run((ctx) =>
      ctx.db.insert("workflowItems", {
        userId: "bob",
        title: "Task",
        kind: "task",
        category: "prep",
        status: "not_started",
        sortOrder: 0,
        ancestorIds: [],
        scopeKind: "shared",
        sourceKind: "manual",
      })
    );
    const unknown = internalMutation({
      args: {},
      handler: (ctx) =>
        ctx.db.insert("workflowAttachments", {
          userId: "bob",
          workflowItemId: task,
          entityType: "unknown",
          entityId: f.beta,
          entityKey: "unknown",
          role: "primary",
        }),
    });
    await expect(f.t.run((ctx) => invoke(ctx, unknown))).rejects.toThrow("Unknown reference shape");
  });
  it("ordinary seed and mirror maintenance cannot target a suppressed account", async () => {
    const f = await fixture();
    vi.stubEnv("CONVEX_SITE_URL", "https://fixture.convex.site");
    await f.t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
    await expect(
      f.t.mutation(internal.users.setTier, { externalId: "alice", tier: "PRO" })
    ).rejects.toThrow(/Account unavailable|User not found/);
    await expect(
      f.t.withIdentity({ subject: "alice" }).mutation(api.seed.createStarter, {})
    ).rejects.toThrow("Unauthorized");
  });
  it("suppresses public content and media discovery immediately while preserving a live shared copy", async () => {
    const f = await fixture();
    const blob = await f.t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["fixture"]));
      await ctx.db.patch(f.alpha, {
        visibility: "public",
        shareToken: "fixture-share",
        imageStorageId: id,
      });
      return id;
    });
    expect(
      await f.t.query(api.builds.getByShareToken, { shareToken: "fixture-share" })
    ).not.toBeNull();
    expect(await f.t.query(api.files.getUrl, { storageId: blob })).not.toBeNull();
    await f.t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
    expect(await f.t.query(api.builds.getByShareToken, { shareToken: "fixture-share" })).toBeNull();
    expect(await f.t.query(api.builds.listPublicByUser, { userId: "alice" })).toEqual([]);
    expect(
      (await f.t.query(api.builds.listDiscover, {})).some(
        (row: { _id: string }) => row._id === f.alpha
      )
    ).toBe(false);
    expect(await f.t.query(api.files.getUrl, { storageId: blob })).toBeNull();
    await f.t.run((ctx) => ctx.db.patch(f.beta, { visibility: "public", imageStorageId: blob }));
    expect(await f.t.query(api.files.getUrl, { storageId: blob })).not.toBeNull();
  });
  it("records and replays 4,100 newly-created references using their same-transaction ownership proof", async () => {
    const f = await fixture();
    const registered = mutation({
      args: {},
      handler: (ctx) =>
        runIdempotent(ctx, "bulk", "bob", "fixtures.bulk", async () => {
          const ids = [];
          for (let i = 0; i < 4100; i++)
            ids.push(await ctx.db.insert("builds", { userId: "bob", name: "New", status: "idea" }));
          return { references: ids };
        }),
    });
    const result = await f.t.withIdentity({ subject: "bob" }).run((ctx) => invoke(ctx, registered));
    expect(result.references).toHaveLength(4100);
    expect(
      await f.t.withIdentity({ subject: "bob" }).run((ctx) => invoke(ctx, registered))
    ).toEqual(result);
    expect(await f.t.run((ctx) => ctx.db.query("idempotencyLedger").collect())).toHaveLength(1);
  }, 30000);
  it("measures actual added guard reads on representative public writers", async () => {
    const f = await fixture();
    const original = MutationGuard.prototype.context;
    let active: MutationCtx | undefined;
    vi.spyOn(MutationGuard.prototype, "context").mockImplementation(function (this: MutationGuard) {
      active = this.raw;
      return Reflect.apply(original, this, []);
    });
    const measurements = [];
    for (const [name, registered, args] of [
      ["build create", builds.create, { name: "Measured", status: "idea" }],
      ["build patch", builds.update, { id: f.beta, name: "Measured" }],
      ["profile focus", users.setFocusedBuild, { buildId: f.beta }],
    ] as const) {
      await f.t.withIdentity({ subject: "bob" }).run((ctx) => invoke(ctx, registered, args));
      const reads = mutationGuardReads(active!);
      measurements.push({ name, ...reads, total: Object.values(reads).reduce((a, b) => a + b, 0) });
    }
    expect(measurements).toEqual([
      {
        name: "build create",
        subjects: 1,
        resources: 0,
        preimages: 0,
        epochs: 0,
        mediaEpochs: 0,
        total: 1,
      },
      {
        name: "build patch",
        subjects: 1,
        resources: 1,
        preimages: 1,
        epochs: 0,
        mediaEpochs: 0,
        total: 3,
      },
      {
        name: "profile focus",
        subjects: 1,
        resources: 1,
        preimages: 1,
        epochs: 0,
        mediaEpochs: 0,
        total: 3,
      },
    ]);
  });
});
