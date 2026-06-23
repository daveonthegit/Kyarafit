import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Backend spec tests for the build progress-update timeline (PRODUCT_SPEC.md §4.3,
// DATA_AND_SYNC.md §3.3, REQ-049): ownership, newest-first ordering, and the paid-only publish gate.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function makeBuild(t: ReturnType<typeof convexTest>, userId: string, name: string) {
  const build = await t.mutation(api.builds.create, { userId, name, status: "idea" });
  if (!build) throw new Error("build create failed");
  return build._id;
}

async function seedUser(t: ReturnType<typeof convexTest>, externalId: string, tier: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.com`,
      tier,
      currentUsageMb: 0,
    });
  });
}

describe("buildProgressUpdates ordering & ownership (REQ-049)", () => {
  it("should_list_updates_newest_first", async () => {
    const t = convexTest(schema, modules);
    const buildId = await makeBuild(t, "u1", "A");
    const first = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "u1",
      note: "first",
    });
    // Force a later createdAt by patching the second row's clock forward.
    const second = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "u1",
      note: "second",
    });
    await t.run(async (ctx) => {
      const f = await ctx.db.get(first!._id);
      const s = await ctx.db.get(second!._id);
      await ctx.db.patch(first!._id, { createdAt: f!.createdAt ?? 0 });
      await ctx.db.patch(second!._id, { createdAt: (s!.createdAt ?? 0) + 1000 });
    });

    const list = await t.query(api.buildProgressUpdates.listByBuild, { buildId, userId: "u1" });
    expect(list.map((u) => u.note)).toEqual(["second", "first"]);
  });

  it("should_not_list_updates_for_a_non_owner", async () => {
    const t = convexTest(schema, modules);
    const buildId = await makeBuild(t, "u1", "A");
    await t.mutation(api.buildProgressUpdates.add, { buildId, userId: "u1", note: "mine" });

    const otherView = await t.query(api.buildProgressUpdates.listByBuild, {
      buildId,
      userId: "u2",
    });
    expect(otherView).toHaveLength(0);
  });

  it("should_reject_adding_an_update_to_another_users_build", async () => {
    const t = convexTest(schema, modules);
    const buildId = await makeBuild(t, "u1", "A");
    await expect(
      t.mutation(api.buildProgressUpdates.add, { buildId, userId: "u2", note: "nope" })
    ).rejects.toThrow(/not found or not authorized/i);
  });
});

describe("buildProgressUpdates publish gate (REQ-049)", () => {
  it("should_block_a_free_user_from_publishing_to_the_feed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "free1", "FREE");
    const buildId = await makeBuild(t, "free1", "A");

    await expect(
      t.mutation(api.buildProgressUpdates.add, {
        buildId,
        userId: "free1",
        note: "look at me",
        publish: true,
      })
    ).rejects.toThrow(/paid plan/i);
  });

  it("should_default_publishedToFeed_to_false_without_publish_flag", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "free1", "FREE");
    const buildId = await makeBuild(t, "free1", "A");
    const update = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "free1",
      note: "private progress",
    });
    expect(update!.publishedToFeed).toBe(false);
  });

  it("should_allow_a_paid_user_to_publish_to_the_feed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "pro1", "PRO");
    const buildId = await makeBuild(t, "pro1", "A");
    const update = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "pro1",
      note: "shipped a sleeve",
      publish: true,
    });
    expect(update!.publishedToFeed).toBe(true);
  });
});
