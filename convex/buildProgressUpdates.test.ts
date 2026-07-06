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

const MB = 1024 * 1024;
const localRef = (imageKey: string) => ({
  kind: "local" as const,
  uri: `file://${imageKey}`,
  imageKey,
});

async function usageMb(t: ReturnType<typeof convexTest>, externalId: string): Promise<number> {
  return t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .unique();
    return user?.currentUsageMb ?? 0;
  });
}

// Paid image upload-on-sync (REQ-D71): the sync worker flips a `local` ImageRef to `cloud` via
// `update`. That flip must enforce the REQ-D90 cloud-storage cap (paid = 2048 MB) via the same
// accounting as the normal upload path, without double-counting on replay.
describe("buildProgressUpdates cloud-mirror storage cap (REQ-D71/D90)", () => {
  it("should_count_cloud_usage_when_a_paid_user_flips_a_local_ref_to_cloud", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "pro1", "PRO");
    const buildId = await makeBuild(t, "pro1", "A");
    const created = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "pro1",
      note: "wip",
      imageRefs: [localRef("k1")],
    });

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(5 * MB)])));
    const flipped = await t.mutation(api.buildProgressUpdates.update, {
      id: created!._id,
      userId: "pro1",
      imageRefs: [{ kind: "cloud", storageId, imageKey: "k1" }],
    });

    expect(flipped!.imageRefs[0]!.kind).toBe("cloud");
    expect(await usageMb(t, "pro1")).toBeCloseTo(5, 5);
  });

  it("should_block_the_flip_over_cap_and_preserve_the_local_ref", async () => {
    const t = convexTest(schema, modules);
    // Seed a paid user already near the 2048 MB cap so a 5 MB blob would exceed it.
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: "pro2",
        email: "pro2@example.com",
        tier: "PRO",
        currentUsageMb: 2047,
      });
    });
    const buildId = await makeBuild(t, "pro2", "A");
    const created = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "pro2",
      note: "wip",
      imageRefs: [localRef("k1")],
    });

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(5 * MB)])));
    await expect(
      t.mutation(api.buildProgressUpdates.update, {
        id: created!._id,
        userId: "pro2",
        imageRefs: [{ kind: "cloud", storageId, imageKey: "k1" }],
      })
    ).rejects.toThrow(/storage limit/i);

    // The row keeps its local ref (the local binary is never lost) and usage is unchanged.
    const stored = await t.run((ctx) => ctx.db.get(created!._id));
    expect(stored!.imageRefs[0]!.kind).toBe("local");
    expect(await usageMb(t, "pro2")).toBeCloseTo(2047, 5);
  });

  it("should_not_double_count_when_the_flip_is_replayed", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "pro3", "PRO");
    const buildId = await makeBuild(t, "pro3", "A");
    const created = await t.mutation(api.buildProgressUpdates.add, {
      buildId,
      userId: "pro3",
      note: "wip",
      imageRefs: [localRef("k1")],
    });

    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(5 * MB)])));
    const cloudRefs = [{ kind: "cloud" as const, storageId, imageKey: "k1" }];
    await t.mutation(api.buildProgressUpdates.update, {
      id: created!._id,
      userId: "pro3",
      imageRefs: cloudRefs,
    });
    // Re-run the same flip (idempotent replay): the storage id is already cloud, so it must not be
    // counted again.
    await t.mutation(api.buildProgressUpdates.update, {
      id: created!._id,
      userId: "pro3",
      imageRefs: cloudRefs,
    });

    expect(await usageMb(t, "pro3")).toBeCloseTo(5, 5);
  });
});
