import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

// SECURITY-SENSITIVE: the owner role grants UNLIMITED access and is enforced server-side from the
// user's DB row. These tests assert bootstrap, owner-only granting, admin acceptance, and that owner
// bypasses the storage cap + is treated as paid in the publish/backfill gates. (REQ owner-role.)
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

type Role = "user" | "admin" | "owner";

async function seedUser(
  t: ReturnType<typeof convexTest>,
  externalId: string,
  tier: string,
  role?: Role,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.com`,
      tier,
      currentUsageMb: 0,
      ...(role ? { role } : {}),
      ...extra,
    });
  });
}

async function getUser(t: ReturnType<typeof convexTest>, externalId: string) {
  return t.run(async (ctx) =>
    ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique()
  );
}

describe("setUserRole bootstrap (internal)", () => {
  it("should_bootstrap_first_owner_by_externalId", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", "FREE");
    await t.mutation(internal.users.setUserRole, { externalId: "u1", role: "owner" });
    expect((await getUser(t, "u1"))?.role).toBe("owner");
  });

  it("should_bootstrap_owner_by_email", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", "FREE");
    await t.mutation(internal.users.setUserRole, { email: "u1@example.com", role: "owner" });
    expect((await getUser(t, "u1"))?.role).toBe("owner");
  });

  it("should_reject_when_no_identifier", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.users.setUserRole, { role: "owner" })).rejects.toThrow(
      /externalId or email/i
    );
  });
});

describe("grantRole authz (owner only)", () => {
  it("should_let_owner_grant_owner_to_another_user", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    await seedUser(t, "u2", "FREE");
    await t
      .withIdentity({ subject: "owner1" })
      .mutation(api.users.grantRole, { targetExternalId: "u2", role: "owner" });
    expect((await getUser(t, "u2"))?.role).toBe("owner");
  });

  it("should_reject_grant_from_a_plain_user", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", "FREE", "user");
    await seedUser(t, "u2", "FREE");
    await expect(
      t
        .withIdentity({ subject: "u1" })
        .mutation(api.users.grantRole, { targetExternalId: "u2", role: "owner" })
    ).rejects.toThrow(/Forbidden/);
    expect((await getUser(t, "u2"))?.role).toBeUndefined();
  });

  it("should_reject_grant_from_an_admin_caller", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "a1", "FREE", "admin");
    await seedUser(t, "u2", "FREE");
    await expect(
      t
        .withIdentity({ subject: "a1" })
        .mutation(api.users.grantRole, { targetExternalId: "u2", role: "admin" })
    ).rejects.toThrow(/Forbidden/);
  });

  it("should_reject_grant_when_unauthenticated", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u2", "FREE");
    await expect(
      t.mutation(api.users.grantRole, { targetExternalId: "u2", role: "owner" })
    ).rejects.toThrow(/Unauthorized/);
  });
});

describe("owner effective tier/storage via getMe", () => {
  it("should_surface_owner_as_top_tier_with_unlimited_storage", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    const me = await t.query(api.users.getMe, { externalId: "owner1" });
    expect(me?.tier).toBe("SUPPORTER");
    expect(me?.role).toBe("owner");
    expect(me?.storageLimitMb).toBeGreaterThan(2048);
  });

  it("should_flip_a_users_access_after_grant", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    await seedUser(t, "u2", "FREE");
    const before = await t.query(api.users.getMe, { externalId: "u2" });
    expect(before?.tier).toBe("FREE");
    await t
      .withIdentity({ subject: "owner1" })
      .mutation(api.users.grantRole, { targetExternalId: "u2", role: "owner" });
    const after = await t.query(api.users.getMe, { externalId: "u2" });
    expect(after?.tier).toBe("SUPPORTER");
    expect(after?.storageLimitMb).toBeGreaterThan(2048);
    expect(after?.role).toBe("owner");
  });
});

describe("owner bypasses storage cap (checkLimitAndAddUsage via updateProfileImage)", () => {
  // Seed usage already at the paid cap, then attach a file. A FREE/paid user would be blocked once
  // over their cap; an owner has the unlimited sentinel cap and is allowed.
  async function attachBigFile(t: ReturnType<typeof convexTest>, externalId: string) {
    const storageId = await t.run(async (ctx) => {
      const blob = new Blob(["x".repeat(2 * 1024 * 1024)]); // ~2 MB
      return ctx.storage.store(blob);
    });
    // Exercise the shared server enforcer directly (the same helper every upload path calls).
    return t.run(async (ctx) => {
      const { checkLimitAndAddUsage } = await import("./storageUsage");
      await checkLimitAndAddUsage(ctx, externalId, storageId);
      const user = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
        .unique();
      return user?.currentUsageMb ?? 0;
    });
  }

  it("should_block_a_free_user_over_cap", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "free1", "FREE", undefined, { currentUsageMb: 49.5 });
    await expect(attachBigFile(t, "free1")).rejects.toThrow(/Storage limit reached/);
  });

  it("should_allow_an_owner_beyond_the_paid_cap", async () => {
    const t = convexTest(schema, modules);
    // Usage already above the 2048 MB paid cap — a paid user would be blocked; the owner is not.
    await seedUser(t, "owner1", "FREE", "owner", { currentUsageMb: 5000 });
    const usage = await attachBigFile(t, "owner1");
    expect(usage).toBeGreaterThan(5000);
  });
});

describe("owner treated as paid in the publish gate", () => {
  it("should_let_an_owner_publish_a_progress_update_to_the_feed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    const build = await t.mutation(api.builds.create, {
      userId: "owner1",
      name: "B",
      status: "idea",
    });
    const update = await t.mutation(api.buildProgressUpdates.add, {
      buildId: build!._id,
      userId: "owner1",
      note: "shipping it",
      publish: true,
    });
    expect(update?.publishedToFeed).toBe(true);
  });

  it("should_still_block_a_free_user_from_publishing", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "free1", "FREE");
    const build = await t.mutation(api.builds.create, {
      userId: "free1",
      name: "B",
      status: "idea",
    });
    await expect(
      t.mutation(api.buildProgressUpdates.add, {
        buildId: build!._id,
        userId: "free1",
        note: "nope",
        publish: true,
      })
    ).rejects.toThrow(/paid plan/i);
  });
});

describe("owner treated as paid in the backfill gate", () => {
  it("should_let_an_owner_run_paid_only_backfillStatus", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    const counts = await t
      .withIdentity({ subject: "owner1" })
      .query(api.tierTransition.backfillStatus, {});
    expect(counts).toBeTruthy();
  });

  it("should_still_block_a_free_user_from_backfill", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "free1", "FREE");
    await expect(
      t.withIdentity({ subject: "free1" }).query(api.tierTransition.backfillStatus, {})
    ).rejects.toThrow(/upgrade/i);
  });
});

describe("requireAdmin / requireOwner", () => {
  const broadcastArgs = {
    title: "Hello",
    body: "World",
    audience: "all" as const,
    scheduledAt: Date.now() + 60_000,
  };

  it("should_accept_an_owner_for_an_admin_gated_mutation", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "owner1", "FREE", "owner");
    // broadcasts.create is gated by requireAdmin; an owner (superset of admin) must be accepted.
    const id = await t
      .withIdentity({ subject: "owner1" })
      .mutation(api.broadcasts.create, broadcastArgs);
    expect(id).toBeTruthy();
  });

  it("should_accept_an_admin_for_an_admin_gated_mutation", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "a1", "FREE", "admin");
    const id = await t
      .withIdentity({ subject: "a1" })
      .mutation(api.broadcasts.create, broadcastArgs);
    expect(id).toBeTruthy();
  });

  it("should_reject_a_plain_user_from_an_admin_gated_mutation", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "u1", "FREE", "user");
    await expect(
      t.withIdentity({ subject: "u1" }).mutation(api.broadcasts.create, broadcastArgs)
    ).rejects.toThrow(/Forbidden/);
  });
});
