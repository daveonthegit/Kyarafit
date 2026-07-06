import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { ConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";

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
