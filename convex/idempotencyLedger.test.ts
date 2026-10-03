import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { idempotentRecord, idempotentReplay, runIdempotent } from "./lib/idempotency";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);
const createArgs = { name: "Build", status: "idea", idempotencyKey: "shared-key" };

describe("scoped offline replay", () => {
  it("isolates two sessions even with a forged legacy actor argument", async () => {
    const t = convexTest(schema, modules);
    const first = await t
      .withIdentity({ subject: "owner" })
      .mutation(api.builds.create, createArgs);
    const other = await t.withIdentity({ subject: "other" }).mutation(api.builds.create, {
      ...createArgs,
      userId: "owner",
    });
    expect(other?._id).not.toBe(first?._id);
    expect(other?.userId).toBe("other");
    const rows = await t.run((ctx) => ctx.db.query("idempotencyLedger").collect());
    expect(rows.map((row) => row.userId).sort()).toEqual(["other", "owner"]);
  });

  it("separates create, update, batch write and duplicate, but retries each once", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    const first = await actor.mutation(api.builds.create, createArgs);
    const update = { id: first!._id, name: "Updated", idempotencyKey: createArgs.idempotencyKey };
    expect((await actor.mutation(api.builds.update, update))?.name).toBe("Updated");
    await actor.mutation(api.builds.updateStatusMany, {
      ids: [first!._id],
      status: "ready",
      idempotencyKey: createArgs.idempotencyKey,
    });
    // Re-delivery of the earlier update must not overwrite the subsequent status.
    expect((await actor.mutation(api.builds.update, update))?.name).toBe("Updated");
    expect((await t.run((ctx) => ctx.db.get(first!._id)))?.status).toBe("ready");
    const duplicate = { sourceBuildId: first!._id, idempotencyKey: createArgs.idempotencyKey };
    const copied = await actor.mutation(api.builds.duplicate, duplicate);
    expect(copied).not.toBe(first!._id);
    expect(await actor.mutation(api.builds.duplicate, duplicate)).toBe(copied);
    // Simulate a lost create response: same stored result, no second insert.
    expect((await actor.mutation(api.builds.create, createArgs))?._id).toBe(first!._id);
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toHaveLength(2);
  });

  it("isolates unrelated modules for a single session", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    const build = await actor.mutation(api.builds.create, createArgs);
    const conventionArgs = {
      name: "Event",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      idempotencyKey: createArgs.idempotencyKey,
    };
    const convention = await actor.mutation(api.conventions.create, conventionArgs);
    const taskArgs = { title: "Task", idempotencyKey: createArgs.idempotencyKey };
    const task = await actor.mutation(api.workflow.create, taskArgs);
    expect(convention?.name).toBe("Event");
    expect(task?.title).toBe("Task");
    expect(convention?._id).not.toBe(build?._id);
    expect((await actor.mutation(api.conventions.create, conventionArgs))?._id).toBe(
      convention?._id
    );
    expect((await actor.mutation(api.workflow.create, taskArgs))?._id).toBe(task?._id);
  });

  it("keeps convention operations independent with stable retries", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    const idempotencyKey = "event-key";
    const convention = await actor.mutation(api.conventions.create, {
      name: "Event",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
      idempotencyKey,
    });
    const updated = await actor.mutation(api.conventions.update, {
      id: convention!._id,
      name: "Renamed",
      idempotencyKey,
    });
    expect(updated?.name).toBe("Renamed");
    const planArgs = {
      conventionId: convention!._id,
      plan: [{ date: "2026-01-01" }],
      idempotencyKey,
    };
    const plan = await actor.mutation(api.conventions.replacePlan, planArgs);
    expect(await actor.mutation(api.conventions.replacePlan, planArgs)).toEqual(plan);
    const packingArgs = { conventionId: convention!._id, label: "Boots", idempotencyKey };
    const item = await actor.mutation(api.conventions.addManualPackingItem, packingArgs);
    expect(item?.label).toBe("Boots");
    expect((await actor.mutation(api.conventions.addManualPackingItem, packingArgs))?._id).toBe(
      item?._id
    );
    await actor.mutation(api.conventions.archiveMany, {
      ids: [convention!._id],
      archived: true,
      idempotencyKey,
    });
    expect((await t.run((ctx) => ctx.db.get(convention!._id)))?.archived).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("idempotencyLedger").collect())).toHaveLength(5);
  });

  it("keeps workflow operations independent with stable retries", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    const idempotencyKey = "task-key";
    const task = await actor.mutation(api.workflow.create, { title: "Task", idempotencyKey });
    expect(
      (
        await actor.mutation(api.workflow.update, {
          id: task!._id,
          title: "Updated",
          idempotencyKey,
        })
      )?.title
    ).toBe("Updated");
    const moveArgs = { id: task!._id, sortOrder: 5, idempotencyKey };
    await actor.mutation(api.workflow.move, moveArgs);
    await actor.mutation(api.workflow.move, moveArgs);
    expect((await t.run((ctx) => ctx.db.get(task!._id)))?.sortOrder).toBe(5);
    const resequenceArgs = {
      move: { id: task!._id, sortOrder: 7 },
      resequence: [],
      idempotencyKey,
    };
    expect((await actor.mutation(api.workflow.moveAndResequence, resequenceArgs))?.sortOrder).toBe(
      7
    );
    expect((await actor.mutation(api.workflow.moveAndResequence, resequenceArgs))?.sortOrder).toBe(
      7
    );
    expect(await t.run((ctx) => ctx.db.query("idempotencyLedger").collect())).toHaveLength(4);
  });

  it("isolates media and focus operations and refuses foreign media retries", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    await actor.mutation(api.users.upsert, { externalId: "owner", email: "test@example.com" });
    const build = await actor.mutation(api.builds.create, createArgs);
    const mediaArgs = {
      buildId: build!._id,
      imageUrl: "https://example.com/image.webp",
      idempotencyKey: createArgs.idempotencyKey,
    };
    const reference = await actor.mutation(api.buildReferenceImages.add, mediaArgs);
    const process = await actor.mutation(api.buildProcessPictures.add, mediaArgs);
    expect(reference?._id).not.toBe(process?._id);
    expect((await actor.mutation(api.buildReferenceImages.add, mediaArgs))?._id).toBe(
      reference?._id
    );
    expect((await actor.mutation(api.buildProcessPictures.add, mediaArgs))?._id).toBe(process?._id);
    const other = t.withIdentity({ subject: "other" });
    await expect(other.mutation(api.buildReferenceImages.add, mediaArgs)).rejects.toThrow(
      "Not authorized"
    );
    await expect(other.mutation(api.buildProcessPictures.add, mediaArgs)).rejects.toThrow(
      "Not authorized"
    );
    const focusArgs = { buildId: build!._id, idempotencyKey: createArgs.idempotencyKey };
    const focused = await actor.mutation(api.users.setFocusedBuild, focusArgs);
    expect(await actor.mutation(api.users.setFocusedBuild, focusArgs)).toBe(focused);
    expect(await other.mutation(api.users.setFocusedBuild, focusArgs)).toBeNull();
    await actor.mutation(api.builds.addNodesToBuild, {
      buildId: build!._id,
      cosplayNodeIds: [],
      idempotencyKey: createArgs.idempotencyKey,
    });
    const rows = await t.run((ctx) => ctx.db.query("idempotencyLedger").collect());
    expect(rows.map((row) => row.operation).sort()).toEqual(
      [
        "builds.addNodesToBuild",
        "builds.create",
        "buildProcessPictures.add",
        "buildReferenceImages.add",
        "users.setFocusedBuild",
      ].sort()
    );
  });

  it("never replays or promotes legacy rows, including duplicates and same-owner rows", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (const userId of ["owner", "other", "other"]) {
        await ctx.db.insert("idempotencyLedger", {
          key: createArgs.idempotencyKey,
          userId,
          createdAt: Date.now(),
          result: { legacy: true },
        });
      }
    });
    const actor = t.withIdentity({ subject: "owner" });
    const created = await actor.mutation(api.builds.create, createArgs);
    expect(created?.name).toBe("Build");
    expect((await actor.mutation(api.builds.create, createArgs))?._id).toBe(created?._id);
    const rows = await t.run((ctx) => ctx.db.query("idempotencyLedger").collect());
    expect(rows.filter((row) => row.operation)).toHaveLength(1);
    expect(rows.filter((row) => !row.operation)).toHaveLength(3);
  });

  it("rejects anonymous replay even when a key is already committed", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity({ subject: "owner" }).mutation(api.builds.create, createArgs);
    await expect(t.mutation(api.builds.create, createArgs)).rejects.toThrow("Unauthorized");
    await expect(
      t.mutation(api.users.setFocusedBuild, { idempotencyKey: createArgs.idempotencyKey })
    ).rejects.toThrow("Unauthorized");
    await expect(
      t.run((ctx) => idempotentReplay(ctx, createArgs.idempotencyKey, "builds.create"))
    ).rejects.toThrow("Unauthorized");
  });

  it("checks record actor and never reads/writes unscoped compatibility calls", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    await actor.mutation(api.builds.create, createArgs);
    expect(await actor.run((ctx) => idempotentReplay(ctx, createArgs.idempotencyKey))).toEqual({
      hit: false,
    });
    expect(await actor.run((ctx) => idempotentRecord(ctx, "legacy-call", "owner", "value"))).toBe(
      "value"
    );
    await expect(
      actor.run((ctx) => idempotentRecord(ctx, "forged", "other", "value", "test.record"))
    ).rejects.toThrow("Unauthorized");
    await expect(
      actor.run((ctx) => runIdempotent(ctx, "forged", "other", "test.run", async () => "value"))
    ).rejects.toThrow("Unauthorized");
    expect(await t.run((ctx) => ctx.db.query("idempotencyLedger").collect())).toHaveLength(1);
  });

  it("dedupes undefined results and rolls back both body and ledger on failure", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    const execute = () =>
      actor.run((ctx) =>
        runIdempotent(ctx, "void", "owner", "test.void", async () => {
          await ctx.db.insert("builds", { userId: "owner", name: "Once", status: "idea" });
        })
      );
    await execute();
    await execute();
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toHaveLength(1);
    await expect(
      actor.run((ctx) =>
        runIdempotent(ctx, "failed", "owner", "test.fail", async () => {
          await ctx.db.insert("builds", { userId: "owner", name: "Rollback", status: "idea" });
          throw new Error("Fail before commit");
        })
      )
    ).rejects.toThrow("Fail before commit");
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toHaveLength(1);
    expect(await actor.run((ctx) => idempotentReplay(ctx, "failed", "test.fail"))).toEqual({
      hit: false,
    });
  });

  it("allows unkeyed writes without creating ledger rows", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "owner" });
    await actor.mutation(api.builds.create, { name: "A", status: "idea" });
    await actor.mutation(api.builds.create, { name: "B", status: "idea", idempotencyKey: "" });
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("idempotencyLedger").collect())).toHaveLength(0);
  });
});

describe("ledger retention", () => {
  it("prunes scoped and legacy rows in bounded batches without deleting fresh retries", async () => {
    const t = convexTest(schema, modules);
    const expired = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i++) {
        await ctx.db.insert("idempotencyLedger", {
          key: String(i),
          userId: "owner",
          operation: i % 2 ? "builds.create" : undefined,
          createdAt: expired,
        });
      }
      await ctx.db.insert("idempotencyLedger", {
        key: "fresh",
        userId: "owner",
        operation: "builds.create",
        createdAt: Date.now(),
        result: "retained",
      });
    });
    expect(await t.mutation(internal.idempotencyLedger.prune, {})).toEqual({ deleted: 500 });
    expect(await t.mutation(internal.idempotencyLedger.prune, {})).toEqual({ deleted: 1 });
    expect(await t.mutation(internal.idempotencyLedger.prune, {})).toEqual({ deleted: 0 });
    expect(
      await t
        .withIdentity({ subject: "owner" })
        .run((ctx) => idempotentReplay(ctx, "fresh", "builds.create"))
    ).toEqual({ hit: true, result: "retained" });
  });
});
