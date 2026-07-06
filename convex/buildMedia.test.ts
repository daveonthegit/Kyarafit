import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Backend spec tests for offline idempotent replay of build-media creates (DATA_AND_SYNC.md §6,
// REQ-D62). The sync worker replays queued creates at-least-once; a replay with the same
// idempotencyKey must return the stored row instead of inserting a duplicate. The Better Auth
// component dir is excluded from the module glob.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function createBuild(t: ReturnType<typeof convexTest>, userId: string) {
  const build = await t.mutation(api.builds.create, { userId, name: "Aerith", status: "idea" });
  return build!._id;
}

describe("buildReferenceImages idempotency (REQ-D62)", () => {
  it("should_record_and_replay_an_idempotent_create_exactly_once", async () => {
    const t = convexTest(schema, modules);
    const buildId = await createBuild(t, "u1");
    const args = {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/ref.png",
      idempotencyKey: "ref-key-1",
    };

    const first = await t.mutation(api.buildReferenceImages.add, args);
    const second = await t.mutation(api.buildReferenceImages.add, args);

    expect(second?._id).toBe(first?._id);
    const all = await t.run(async (ctx) => ctx.db.query("buildReferenceImages").collect());
    expect(all).toHaveLength(1);
  });

  it("should_insert_separately_for_distinct_idempotency_keys", async () => {
    const t = convexTest(schema, modules);
    const buildId = await createBuild(t, "u1");
    await t.mutation(api.buildReferenceImages.add, {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/a.png",
      idempotencyKey: "ref-a",
    });
    await t.mutation(api.buildReferenceImages.add, {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/b.png",
      idempotencyKey: "ref-b",
    });
    const all = await t.run(async (ctx) => ctx.db.query("buildReferenceImages").collect());
    expect(all).toHaveLength(2);
  });
});

describe("buildProcessPictures idempotency (REQ-D62)", () => {
  it("should_record_and_replay_an_idempotent_create_exactly_once", async () => {
    const t = convexTest(schema, modules);
    const buildId = await createBuild(t, "u1");
    const args = {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/proc.png",
      idempotencyKey: "proc-key-1",
    };

    const first = await t.mutation(api.buildProcessPictures.add, args);
    const second = await t.mutation(api.buildProcessPictures.add, args);

    expect(second?._id).toBe(first?._id);
    const all = await t.run(async (ctx) => ctx.db.query("buildProcessPictures").collect());
    expect(all).toHaveLength(1);
  });

  it("should_insert_separately_for_distinct_idempotency_keys", async () => {
    const t = convexTest(schema, modules);
    const buildId = await createBuild(t, "u1");
    await t.mutation(api.buildProcessPictures.add, {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/a.png",
      idempotencyKey: "proc-a",
    });
    await t.mutation(api.buildProcessPictures.add, {
      buildId,
      userId: "u1",
      imageUrl: "https://example.com/b.png",
      idempotencyKey: "proc-b",
    });
    const all = await t.run(async (ctx) => ctx.db.query("buildProcessPictures").collect());
    expect(all).toHaveLength(2);
  });
});
