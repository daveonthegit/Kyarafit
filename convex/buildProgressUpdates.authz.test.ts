import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { uploadTestBlob } from "./mediaTestHelpers.fixture";
import * as progressModule from "./buildProgressUpdates";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);
const OWNER = "progress-owner";
const OTHER = "progress-other";

async function fixture() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: OWNER });
  const build = await owner.mutation(api.builds.create, { name: "Timeline", status: "wip" });
  if (!build) throw new Error("Missing build");
  const row = await owner.mutation(api.buildProgressUpdates.add, {
    buildId: build._id,
    userId: OWNER,
    note: "Original",
  });
  if (!row) throw new Error("Missing progress update");
  return { t, owner, buildId: build._id, row };
}

describe("progress session authorization", () => {
  it("covers every registered public progress endpoint with executable negative cases", async () => {
    const { t, owner, buildId, row } = await fixture();
    const cases = {
      listByBuild: async (caller: typeof owner) => {
        expect(
          await caller.query(api.buildProgressUpdates.listByBuild, { buildId, userId: OWNER })
        ).toEqual([]);
      },
      add: async (caller: typeof owner, anonymous: boolean) => {
        await expect(
          caller.mutation(api.buildProgressUpdates.add, { buildId, userId: OWNER, note: "Denied" })
        ).rejects.toThrow(anonymous ? /Unauthorized/ : /not authorized/i);
      },
      update: async (caller: typeof owner, anonymous: boolean) => {
        await expect(
          caller.mutation(api.buildProgressUpdates.update, {
            id: row._id,
            userId: OWNER,
            note: "Denied",
          })
        ).rejects.toThrow(anonymous ? /Unauthorized/ : /not authorized/i);
      },
      remove: async (caller: typeof owner, anonymous: boolean) => {
        await expect(
          caller.mutation(api.buildProgressUpdates.remove, { id: row._id, userId: OWNER })
        ).rejects.toThrow(anonymous ? /Unauthorized/ : /not authorized/i);
      },
    };
    // Runtime registration coverage guard, not a source-text scan. New public functions must
    // get executable negative cases. This private timeline has NO public-by-design exceptions.
    // Public-by-design allowlist lives in docs/backend-authorization.md (discover, public
    // profiles/build listings, share-token reads and authorized media discovery); the broader
    // access matrix is exercised in authz.test.ts. Target user ids on those APIs are valid input.
    const publicByDesign: string[] = [];
    const registered = Object.entries(progressModule)
      .filter(([, value]) => value.isPublic)
      .map(([name]) => name);
    expect(registered.sort()).toEqual([...Object.keys(cases), ...publicByDesign].sort());
    for (const check of Object.values(cases)) {
      await check(t, true);
      await check(t.withIdentity({ subject: OTHER }), false);
    }
    expect(await owner.query(api.buildProgressUpdates.listByBuild, { buildId })).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get(row._id))).toEqual(row);
    expect(await t.run((ctx) => ctx.db.query("buildProgressUpdates").collect())).toHaveLength(1);
  });

  it.each([undefined, OWNER, OTHER])(
    "owner works with legacy actor argument %s",
    async (userId) => {
      const { owner, buildId } = await fixture();
      const created = await owner.mutation(api.buildProgressUpdates.add, {
        buildId,
        userId,
        note: "New",
      });
      expect(created?.userId).toBe(OWNER);
      const edited = await owner.mutation(api.buildProgressUpdates.update, {
        id: created!._id,
        userId,
        note: "Edited",
      });
      expect(edited?.note).toBe("Edited");
      expect(edited?.version).toBe((created?.version ?? 0) + 1);
      expect(
        await owner.query(api.buildProgressUpdates.listByBuild, { buildId, userId })
      ).toHaveLength(2);
      await owner.mutation(api.buildProgressUpdates.remove, { id: created!._id, userId });
      expect(
        await owner.query(api.buildProgressUpdates.listByBuild, { buildId, userId })
      ).toHaveLength(1);
    }
  );

  it("authenticates and checks resource ownership before add/update replay", async () => {
    const { t, owner, buildId, row } = await fixture();
    const added = await owner.mutation(api.buildProgressUpdates.add, {
      buildId,
      idempotencyKey: "progress-add",
    });
    expect(
      await owner.mutation(api.buildProgressUpdates.add, {
        buildId,
        userId: OTHER,
        idempotencyKey: "progress-add",
      })
    ).toEqual(added);
    const edited = await owner.mutation(api.buildProgressUpdates.update, {
      id: row._id,
      note: "Once",
      idempotencyKey: "progress-update",
    });
    expect(
      await owner.mutation(api.buildProgressUpdates.update, {
        id: row._id,
        note: "Twice",
        idempotencyKey: "progress-update",
      })
    ).toEqual(edited);
    for (const [caller, error] of [
      [t, /Unauthorized/],
      [t.withIdentity({ subject: OTHER }), /not authorized/i],
    ] as const) {
      await expect(
        caller.mutation(api.buildProgressUpdates.add, {
          buildId,
          userId: OWNER,
          idempotencyKey: "progress-add",
        })
      ).rejects.toThrow(error);
      await expect(
        caller.mutation(api.buildProgressUpdates.update, {
          id: row._id,
          userId: OWNER,
          idempotencyKey: "progress-update",
        })
      ).rejects.toThrow(error);
    }
    const ledger = await t.run((ctx) => ctx.db.query("idempotencyLedger").collect());
    expect(ledger).toHaveLength(2);
    expect(ledger.every((entry) => entry.userId === OWNER)).toBe(true);
  });

  it("uses the session tier for both publishing gates", async () => {
    const { t, owner, buildId, row } = await fixture();
    const paidId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: OWNER,
        email: "owner@example.test",
        tier: "FREE",
        currentUsageMb: 0,
      });
      return ctx.db.insert("users", {
        externalId: OTHER,
        email: "other@example.test",
        tier: "PRO",
        currentUsageMb: 0,
      });
    });
    await expect(
      owner.mutation(api.buildProgressUpdates.add, { buildId, userId: OTHER, publish: true })
    ).rejects.toThrow(/paid plan/);
    await expect(
      owner.mutation(api.buildProgressUpdates.update, { id: row._id, userId: OTHER, publish: true })
    ).rejects.toThrow(/paid plan/);
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", OWNER))
        .unique();
      await ctx.db.patch(user!._id, { tier: "PRO" });
      await ctx.db.patch(paidId, { tier: "FREE" });
    });
    expect(
      (
        await owner.mutation(api.buildProgressUpdates.add, {
          buildId,
          userId: OTHER,
          publish: true,
        })
      )?.publishedToFeed
    ).toBe(true);
    expect(
      (
        await owner.mutation(api.buildProgressUpdates.update, {
          id: row._id,
          userId: OTHER,
          publish: true,
        })
      )?.publishedToFeed
    ).toBe(true);
    expect(
      (await owner.mutation(api.buildProgressUpdates.update, { id: row._id, publish: false }))
        ?.publishedToFeed
    ).toBe(false);
  });

  it("attributes cloud-mirror quota to the session rather than the compatibility argument", async () => {
    const { t, owner, row } = await fixture();
    await t.run(async (ctx) => {
      for (const externalId of [OWNER, OTHER]) {
        await ctx.db.insert("users", {
          externalId,
          email: `${externalId}@example.test`,
          tier: "PRO",
          currentUsageMb: 0,
        });
      }
    });
    const storageId = await uploadTestBlob(t, OWNER, new Blob([new Uint8Array(1024 * 1024)]));
    await owner.mutation(api.buildProgressUpdates.update, {
      id: row._id,
      userId: OTHER,
      imageRefs: [{ kind: "cloud", storageId, imageKey: "mirror" }],
    });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.find((u) => u.externalId === OWNER)?.currentUsageMb).toBeCloseTo(1);
    expect(users.find((u) => u.externalId === OTHER)?.currentUsageMb).toBe(0);
  });

  it("deletion emits a sync tombstone, is retry-safe and cannot be edited back to life", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
      const { t, owner, buildId, row } = await fixture();
      const since = row.updatedAt!;
      vi.advanceTimersByTime(1000);
      await owner.mutation(api.buildProgressUpdates.remove, { id: row._id });
      const deleted = await t.run((ctx) => ctx.db.get(row._id));
      expect(deleted?.deletedAt).toBe(Date.now());
      expect(deleted?.updatedAt).toBe(Date.now());
      expect(deleted?.version).toBe(row.version! + 1);
      expect(deleted?.fieldUpdatedAt).toEqual(row.fieldUpdatedAt);
      expect(await owner.query(api.buildProgressUpdates.listByBuild, { buildId })).toEqual([]);
      const delta = await owner.query(api.sync.listChangedSince, { since });
      expect(delta.buildProgressUpdates).toEqual([deleted]);
      expect(delta.cursor).toBe(deleted?.updatedAt);
      expect(
        (await t.withIdentity({ subject: OTHER }).query(api.sync.listChangedSince, { since }))
          .buildProgressUpdates
      ).toEqual([]);
      vi.advanceTimersByTime(1000);
      await owner.mutation(api.buildProgressUpdates.remove, { id: row._id, userId: OTHER });
      expect(await t.run((ctx) => ctx.db.get(row._id))).toEqual(deleted);
      await expect(
        owner.mutation(api.buildProgressUpdates.update, { id: row._id, note: "Resurrect" })
      ).rejects.toThrow(/not found or not authorized/i);
      expect(await t.run((ctx) => ctx.db.get(row._id))).toEqual(deleted);
    } finally {
      vi.useRealTimers();
    }
  });
});
