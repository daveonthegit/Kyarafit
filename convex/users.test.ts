import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { ConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";

// Backend spec tests for the downgrade lifecycle state recorded on the users row
// (DATA_AND_SYNC.md §10, REQ-D96/D97). The Better Auth component dir is excluded from the glob.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function insertUser(
  t: ReturnType<typeof convexTest>,
  externalId: string,
  tier: ConvexTier,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.com`,
      tier,
      currentUsageMb: 0,
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

describe("users.setTier downgrade lifecycle (REQ-D96/D97)", () => {
  it("should_record_downgradedAt_on_paid_to_free", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "PRO");

    const before = Date.now();
    await t.mutation(internal.users.setTier, { externalId: "u1", tier: "FREE", source: "admin" });
    const after = Date.now();

    const user = await getUser(t, "u1");
    expect(user?.tier).toBe("FREE");
    expect(typeof user?.downgradedAt).toBe("number");
    expect(user!.downgradedAt!).toBeGreaterThanOrEqual(before);
    expect(user!.downgradedAt!).toBeLessThanOrEqual(after);
    expect(user?.subscriptionStatus).toBe("canceled");
    expect(user?.tierSource).toBe("admin");
  });

  it("should_clear_downgradedAt_on_re_upgrade", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "FREE", {
      downgradedAt: Date.now() - 1000,
      cloudPurgedAt: Date.now() - 500,
      subscriptionStatus: "canceled",
    });

    await t.mutation(internal.users.setTier, {
      externalId: "u1",
      tier: "PRO",
      source: "revenuecat",
    });

    const user = await getUser(t, "u1");
    expect(user?.tier).toBe("PRO");
    expect(user?.downgradedAt).toBeUndefined();
    expect(user?.cloudPurgedAt).toBeUndefined();
    expect(user?.subscriptionStatus).toBe("active");
  });

  it("should_not_change_downgradedAt_on_idempotent_free_set", async () => {
    const t = convexTest(schema, modules);
    const original = Date.now() - 5000;
    await insertUser(t, "u1", "FREE", { downgradedAt: original });

    // A re-delivered free→free webhook must not reset the original downgrade time.
    await t.mutation(internal.users.setTier, { externalId: "u1", tier: "FREE" });

    const user = await getUser(t, "u1");
    expect(user?.downgradedAt).toBe(original);
  });

  it("should_not_set_downgradedAt_on_free_to_paid", async () => {
    const t = convexTest(schema, modules);
    await insertUser(t, "u1", "FREE");

    await t.mutation(internal.users.setTier, { externalId: "u1", tier: "SUPPORTER" });

    const user = await getUser(t, "u1");
    expect(user?.tier).toBe("SUPPORTER");
    expect(user?.downgradedAt).toBeUndefined();
  });
});
