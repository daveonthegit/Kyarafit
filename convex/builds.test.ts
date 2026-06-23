import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Backend spec tests for ownership scoping + offline idempotent replay (PRODUCT_SPEC §4.1,
// DATA_AND_SYNC.md §6, REQ-D62). The Better Auth component dir is excluded from the module glob.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

describe("idempotency ledger (REQ-D62)", () => {
  it("should_record_and_replay_an_idempotent_create_exactly_once", async () => {
    const t = convexTest(schema, modules);
    const args = { userId: "u1", name: "Aerith", status: "idea", idempotencyKey: "key-123" };

    const first = await t.mutation(api.builds.create, args);
    const second = await t.mutation(api.builds.create, args);

    // Replay returns the same stored result, not a new row.
    expect(second?._id).toBe(first?._id);
    const all = await t.run(async (ctx) => ctx.db.query("builds").collect());
    expect(all).toHaveLength(1);
  });

  it("should_insert_separately_for_distinct_idempotency_keys", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.builds.create, {
      userId: "u1",
      name: "A",
      status: "idea",
      idempotencyKey: "k1",
    });
    await t.mutation(api.builds.create, {
      userId: "u1",
      name: "B",
      status: "idea",
      idempotencyKey: "k2",
    });
    const all = await t.run(async (ctx) => ctx.db.query("builds").collect());
    expect(all).toHaveLength(2);
  });
});

describe("ownership & scoping (REQ-001)", () => {
  it("should_scope_list_to_the_requested_user", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.builds.create, { userId: "u1", name: "Mine", status: "idea" });
    await t.mutation(api.builds.create, { userId: "u2", name: "Theirs", status: "idea" });

    const mine = await t.query(api.builds.list, { userId: "u1" });
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Mine");
  });

  it("should_prevent_a_non_owner_from_updating_a_build", async () => {
    const t = convexTest(schema, modules);
    const build = await t.mutation(api.builds.create, {
      userId: "u1",
      name: "Mine",
      status: "idea",
    });

    await expect(
      t.mutation(api.builds.update, { id: build!._id, userId: "u2", name: "Hijacked" })
    ).rejects.toThrow(/not authorized/i);
  });
});

describe("build visibility default (REQ-050)", () => {
  it("should_default_build_visibility_to_private", async () => {
    const t = convexTest(schema, modules);
    const build = await t.mutation(api.builds.create, {
      userId: "u1",
      name: "Private by default",
      status: "idea",
    });

    const stored = await t.run(async (ctx) => ctx.db.get(build!._id));
    expect(stored?.visibility).toBe("private");
  });
});

/** Insert a users row so server-side entitlement checks resolve a concrete tier. */
async function setTier(
  t: ReturnType<typeof convexTest>,
  userId: string,
  tier: "FREE" | "PRO" | "SUPPORTER"
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId: userId,
      email: `${userId}@example.com`,
      tier,
      currentUsageMb: 0,
    });
  });
}

describe("public publish entitlement (REQ-017, server-side enforcement)", () => {
  it("should_block_public_publish_for_free_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "free-user", "FREE");

    // Blocked at create time.
    await expect(
      t.mutation(api.builds.create, {
        userId: "free-user",
        name: "Wannabe public",
        status: "idea",
        visibility: "public",
      })
    ).rejects.toThrow(/upgrade/i);

    // And blocked when transitioning an existing private build to public/unlisted.
    const build = await t.mutation(api.builds.create, {
      userId: "free-user",
      name: "Stays private",
      status: "idea",
    });
    await expect(
      t.mutation(api.builds.update, {
        id: build!._id,
        userId: "free-user",
        visibility: "public",
      })
    ).rejects.toThrow(/upgrade/i);
    await expect(
      t.mutation(api.builds.update, {
        id: build!._id,
        userId: "free-user",
        visibility: "unlisted",
      })
    ).rejects.toThrow(/upgrade/i);

    const stored = await t.run(async (ctx) => ctx.db.get(build!._id));
    expect(stored?.visibility).toBe("private");
  });

  it("should_allow_public_publish_for_paid_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "paid-user", "PRO");

    const created = await t.mutation(api.builds.create, {
      userId: "paid-user",
      name: "Public on create",
      status: "idea",
      visibility: "public",
    });
    expect(created?.visibility).toBe("public");

    const build = await t.mutation(api.builds.create, {
      userId: "paid-user",
      name: "Goes unlisted",
      status: "idea",
    });
    const updated = await t.mutation(api.builds.update, {
      id: build!._id,
      userId: "paid-user",
      visibility: "unlisted",
    });
    expect(updated?.visibility).toBe("unlisted");
    expect(updated?.shareToken).toBeTruthy();
  });

  it("should_allow_group_cosplay_build_publish_for_free_member", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "group-owner", "PRO");
    await setTier(t, "free-member", "FREE");

    // Paid owner creates a group, then adds the free user (joining is free).
    const group = await t.mutation(api.groups.create, {
      userId: "group-owner",
      name: "Squad",
    });
    await t.mutation(api.groups.addMember, {
      groupId: group!._id,
      userId: "group-owner",
      newUserId: "free-member",
    });

    // Free member's build linked to that group may be published (REQ-021 exception).
    const build = await t.mutation(api.builds.create, {
      userId: "free-member",
      name: "Group cosplay",
      status: "idea",
    });
    await t.mutation(api.builds.setGroupId, {
      buildId: build!._id,
      userId: "free-member",
      groupId: group!._id,
    });
    const published = await t.mutation(api.builds.update, {
      id: build!._id,
      userId: "free-member",
      visibility: "public",
    });
    expect(published?.visibility).toBe("public");
  });

  it("should_block_free_member_public_publish_when_build_not_group_linked", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "group-owner", "PRO");
    await setTier(t, "free-member", "FREE");

    const group = await t.mutation(api.groups.create, {
      userId: "group-owner",
      name: "Squad",
    });
    await t.mutation(api.groups.addMember, {
      groupId: group!._id,
      userId: "group-owner",
      newUserId: "free-member",
    });

    // Member of a group, but THIS build isn't linked to it → no exception, must upgrade.
    const build = await t.mutation(api.builds.create, {
      userId: "free-member",
      name: "Unlinked",
      status: "idea",
    });
    await expect(
      t.mutation(api.builds.update, {
        id: build!._id,
        userId: "free-member",
        visibility: "public",
      })
    ).rejects.toThrow(/upgrade/i);
  });
});
