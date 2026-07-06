import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { ConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import {
  DOWNGRADE_GRACE_MS,
  DOWNGRADE_RETENTION_MS,
} from "@kyarafit/design-system/domain/tierTransition";

// Backend spec tests for upgrade backfill (DATA_AND_SYNC.md §10, REQ-D95). Better Auth dir excluded.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function insertUser(
  t: ReturnType<typeof convexTest>,
  externalId: string,
  tier: ConvexTier
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.com`,
      tier,
      currentUsageMb: 0,
    });
  });
}

function build(clientId: string, name: string) {
  return { clientId, userId: "u1", name, status: "idea" };
}

async function allBuilds(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.query("builds").collect());
}

describe("upgrade backfill (REQ-D95)", () => {
  it("should_backfill_without_duplicates_on_upgrade", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");
    const asU1 = t.withIdentity({ subject: "u1" });

    // Device A backfills two local builds.
    const first = await asU1.mutation(api.tierTransition.backfillRows, {
      table: "builds",
      rows: [build("a", "Aerith"), build("b", "Bayonetta")],
    });
    expect(first.inserted).toBe(2);
    expect(first.skipped).toBe(0);
    expect(first.cloudCount).toBe(2);

    // Device B backfills an overlapping set: "b" already synced, only "c" is new.
    const second = await asU1.mutation(api.tierTransition.backfillRows, {
      table: "builds",
      rows: [build("b", "Bayonetta"), build("c", "Cloud")],
    });
    expect(second.inserted).toBe(1);
    expect(second.skipped).toBe(1);
    expect(second.cloudCount).toBe(3);

    const rows = await allBuilds(t);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.clientId))).toEqual(new Set(["a", "b", "c"]));
    // No duplicate cloud copy of clientId "b".
    expect(rows.filter((r) => r.clientId === "b")).toHaveLength(1);
  });

  it("should_be_idempotent_on_backfill_rerun", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");
    const asU1 = t.withIdentity({ subject: "u1" });

    const rows = [build("a", "Aerith"), build("b", "Bayonetta")];
    await asU1.mutation(api.tierTransition.backfillRows, { table: "builds", rows });
    const rerun = await asU1.mutation(api.tierTransition.backfillRows, { table: "builds", rows });

    expect(rerun.inserted).toBe(0);
    expect(rerun.skipped).toBe(2);
    expect(await allBuilds(t)).toHaveLength(2);
  });

  it("should_force_ownership_to_the_authenticated_caller", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");
    const asU1 = t.withIdentity({ subject: "u1" });

    // Even if a row claims another userId, it is stored under the caller.
    await asU1.mutation(api.tierTransition.backfillRows, {
      table: "builds",
      rows: [{ clientId: "x", userId: "someone-else", name: "Hijack", status: "idea" }],
    });
    const rows = await allBuilds(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("u1");
  });

  it("should_reject_backfill_for_a_free_user", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "FREE");
    const asU1 = t.withIdentity({ subject: "u1" });

    await expect(
      asU1.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: [build("a", "Aerith")],
      })
    ).rejects.toThrow(/upgrade/i);
    expect(await allBuilds(t)).toHaveLength(0);
  });

  it("should_reject_backfill_when_unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");

    await expect(
      t.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: [build("a", "Aerith")],
      })
    ).rejects.toThrow(/signed in/i);
  });

  it("should_reject_an_unknown_table", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");
    const asU1 = t.withIdentity({ subject: "u1" });

    await expect(
      asU1.mutation(api.tierTransition.backfillRows, {
        table: "not_a_table",
        rows: [],
      })
    ).rejects.toThrow(/unknown local-first table/i);
  });
});

/**
 * Downgrade retention cron (REQ-D96/D97). `now` is injected so the grace/freeze/retention windows are
 * deterministic. These prove the CLOUD mirror is only ever purged past retention — never during grace
 * or freeze, never for re-upgraded users, never another user's or non-local-first (social) data — and
 * that "local is never deleted" holds structurally (the cron only touches Convex cloud tables).
 */
describe("downgrade retention cron (REQ-D96/D97)", () => {
  const T0 = 1_700_000_000_000; // fixed downgrade instant

  /** Seed a free user downgraded at `downgradedAt` with two cloud builds + one social buildLike. */
  async function seedDowngraded(
    t: ReturnType<typeof convexTest>,
    externalId: string,
    downgradedAt: number
  ): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId,
        email: `${externalId}@example.com`,
        tier: "FREE",
        currentUsageMb: 0,
        downgradedAt,
        subscriptionStatus: "canceled",
      });
      const buildId = await ctx.db.insert("builds", {
        userId: externalId,
        name: "Cloud build",
        status: "idea",
        clientId: `${externalId}-b1`,
        version: 1,
        updatedAt: downgradedAt,
      });
      await ctx.db.insert("builds", {
        userId: externalId,
        name: "Cloud build 2",
        status: "idea",
        clientId: `${externalId}-b2`,
        version: 1,
        updatedAt: downgradedAt,
      });
      // Social / online-only owned data: NOT a local-first table, must survive the purge.
      await ctx.db.insert("buildLikes", { userId: externalId, buildId });
    });
  }

  async function counts(t: ReturnType<typeof convexTest>, userId: string) {
    return t.run(async (ctx) => {
      const builds = (await ctx.db.query("builds").collect()).filter((b) => b.userId === userId);
      const likes = (await ctx.db.query("buildLikes").collect()).filter((l) => l.userId === userId);
      const user = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", userId))
        .unique();
      return { builds: builds.length, likes: likes.length, user };
    });
  }

  it("should_not_purge_cloud_during_grace", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);

    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {
      now: T0 + DOWNGRADE_GRACE_MS - 1,
    });
    expect(res.usersPurged).toBe(0);
    const { builds, likes, user } = await counts(t, "u1");
    expect(builds).toBe(2);
    expect(likes).toBe(1);
    expect(user?.cloudPurgedAt).toBeUndefined();
    expect(user?.downgradedAt).toBe(T0);
  });

  it("should_not_purge_cloud_while_frozen", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);

    // Past the 14-day grace but before the full retention window: frozen (read-only), not purged.
    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {
      now: T0 + DOWNGRADE_GRACE_MS + 1,
    });
    expect(res.usersPurged).toBe(0);
    expect((await counts(t, "u1")).builds).toBe(2);
  });

  it("should_purge_cloud_only_after_retention", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);
    const now = T0 + DOWNGRADE_RETENTION_MS;

    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now });
    expect(res.usersPurged).toBe(1);
    expect(res.rowsDeleted).toBe(2);

    const { builds, likes, user } = await counts(t, "u1");
    expect(builds).toBe(0); // cloud mirror purged
    expect(likes).toBe(1); // social data untouched
    expect(user?.cloudPurgedAt).toBe(now); // idempotency marker
    expect(user?.downgradedAt).toBeUndefined(); // dropped out of the candidate index
  });

  it("should_not_delete_other_users_or_social_cloud_data", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "purge-me", T0);
    // A still-paid user + a user in grace must both be left entirely alone.
    await seedDowngraded(t, "in-grace", T0);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: "paid",
        email: "paid@example.com",
        tier: "PRO",
        currentUsageMb: 0,
      });
      await ctx.db.insert("builds", {
        userId: "paid",
        name: "Paid build",
        status: "idea",
        clientId: "paid-b1",
        version: 1,
        updatedAt: T0,
      });
    });

    const now = T0 + DOWNGRADE_RETENTION_MS;
    // in-grace was downgraded at T0 too, so also past retention here — narrow the test: re-seed it in
    // grace relative to `now` by bumping its downgradedAt.
    await t.run(async (ctx) => {
      const u = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", "in-grace"))
        .unique();
      await ctx.db.patch(u!._id, { downgradedAt: now - 1000 });
    });

    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now });
    expect(res.purgedUserIds).toEqual(["purge-me"]);
    expect((await counts(t, "purge-me")).builds).toBe(0);
    expect((await counts(t, "in-grace")).builds).toBe(2);
    expect((await counts(t, "paid")).builds).toBe(1);
  });

  it("should_cancel_purge_when_user_re_upgrades_before_retention", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);

    // Re-subscribe within the window (real path: users.setTier clears downgradedAt on upgrade).
    await t.mutation(internal.users.setTier, { externalId: "u1", tier: "PRO" });

    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {
      now: T0 + DOWNGRADE_RETENTION_MS + 1,
    });
    expect(res.usersPurged).toBe(0);
    expect((await counts(t, "u1")).builds).toBe(2);
  });

  it("should_be_idempotent_when_run_twice", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);
    const now = T0 + DOWNGRADE_RETENTION_MS;

    const first = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now });
    const second = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now });
    expect(first.usersPurged).toBe(1);
    expect(second.usersPurged).toBe(0);
    expect(second.rowsDeleted).toBe(0);
    expect((await counts(t, "u1")).builds).toBe(0);
  });

  it("should_report_without_deleting_in_dry_run", async () => {
    const t = convexTest(schema, modules);
    await seedDowngraded(t, "u1", T0);
    const now = T0 + DOWNGRADE_RETENTION_MS;

    const res = await t.mutation(internal.tierTransition.purgeDowngradedCloudData, {
      now,
      dryRun: true,
    });
    expect(res.dryRun).toBe(true);
    expect(res.usersPurged).toBe(1);
    expect(res.rowsDeleted).toBe(2);
    // Nothing actually deleted or marked.
    const { builds, user } = await counts(t, "u1");
    expect(builds).toBe(2);
    expect(user?.cloudPurgedAt).toBeUndefined();
    expect(user?.downgradedAt).toBe(T0);
  });
});
