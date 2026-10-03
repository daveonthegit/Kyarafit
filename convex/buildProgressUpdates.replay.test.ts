import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);
const idempotencyKey = "progress-retry";

async function fixture() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const build = await owner.mutation(api.builds.create, {
    name: "Timeline",
    status: "wip",
    idempotencyKey,
  });
  if (!build) throw new Error("Missing build");
  return { t, owner, buildId: build._id };
}

describe("progress scoped replay", () => {
  it("keeps add and update independent and retries each without repeating a write", async () => {
    const { t, owner, buildId } = await fixture();
    const args = { buildId, note: "Created", idempotencyKey };
    const added = await owner.mutation(api.buildProgressUpdates.add, args);
    expect(added?.note).toBe("Created");
    expect(await owner.mutation(api.buildProgressUpdates.add, args)).toEqual(added);
    const edit = { id: added!._id, note: "Edited", idempotencyKey };
    const updated = await owner.mutation(api.buildProgressUpdates.update, edit);
    expect(updated?.note).toBe("Edited");
    expect(updated?.version).toBe(added!.version! + 1);
    expect(await owner.mutation(api.buildProgressUpdates.update, edit)).toEqual(updated);
    // A delayed create retry returns its committed result, but must not reset the edited row.
    expect(await owner.mutation(api.buildProgressUpdates.add, args)).toEqual(added);
    expect(await t.run((ctx) => ctx.db.get(added!._id))).toEqual(updated);
    expect(await t.run((ctx) => ctx.db.query("buildProgressUpdates").collect())).toHaveLength(1);
    const ledger = await t.run((ctx) => ctx.db.query("idempotencyLedger").collect());
    expect(ledger.map((entry) => entry.operation).sort()).toEqual(
      ["builds.create", "buildProgressUpdates.add", "buildProgressUpdates.update"].sort()
    );
  });

  it("isolates add and update retries for two sessions using the same key", async () => {
    const { t, owner, buildId } = await fixture();
    const other = t.withIdentity({ subject: "other" });
    const otherBuild = await other.mutation(api.builds.create, {
      name: "Other",
      status: "wip",
      idempotencyKey,
    });
    const first = await owner.mutation(api.buildProgressUpdates.add, {
      buildId,
      note: "Owner",
      idempotencyKey,
    });
    const secondArgs = { buildId: otherBuild!._id, userId: "owner", note: "Other", idempotencyKey };
    const second = await other.mutation(api.buildProgressUpdates.add, secondArgs);
    expect(second?._id).not.toBe(first?._id);
    expect(second?.userId).toBe("other");
    expect(await other.mutation(api.buildProgressUpdates.add, secondArgs)).toEqual(second);
    const editedFirst = await owner.mutation(api.buildProgressUpdates.update, {
      id: first!._id,
      note: "Owner edited",
      idempotencyKey,
    });
    const secondEdit = { id: second!._id, userId: "owner", note: "Other edited", idempotencyKey };
    const editedSecond = await other.mutation(api.buildProgressUpdates.update, secondEdit);
    expect(editedSecond?.note).toBe("Other edited");
    expect(editedSecond?._id).not.toBe(editedFirst?._id);
    expect(await other.mutation(api.buildProgressUpdates.update, secondEdit)).toEqual(editedSecond);
    expect(await t.run((ctx) => ctx.db.query("buildProgressUpdates").collect())).toHaveLength(2);
  });

  it("ignores ambiguous legacy results without skipping authorized progress writes", async () => {
    const { t, owner, buildId } = await fixture();
    await t.run(async (ctx) => {
      for (const userId of ["owner", "other"]) {
        await ctx.db.insert("idempotencyLedger", {
          key: idempotencyKey,
          userId,
          createdAt: Date.now(),
          result: { legacy: true },
        });
      }
    });
    const row = await owner.mutation(api.buildProgressUpdates.add, {
      buildId,
      note: "New",
      idempotencyKey,
    });
    expect(row?.note).toBe("New");
    expect(
      (
        await owner.mutation(api.buildProgressUpdates.update, {
          id: row!._id,
          note: "Edited",
          idempotencyKey,
        })
      )?.note
    ).toBe("Edited");
    expect(await t.run((ctx) => ctx.db.query("buildProgressUpdates").collect())).toHaveLength(1);
  });

  it("charges a keyed cloud-mirror update once after a lost response", async () => {
    const { t, owner, buildId } = await fixture();
    const storageId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: "owner",
        email: "owner@example.test",
        tier: "PRO",
        currentUsageMb: 0,
      });
      return ctx.storage.store(new Blob([new Uint8Array(1024 * 1024)]));
    });
    const row = await owner.mutation(api.buildProgressUpdates.add, { buildId, idempotencyKey });
    const args = {
      id: row!._id,
      imageRefs: [{ kind: "cloud" as const, storageId, imageKey: "mirror" }],
      idempotencyKey,
    };
    const first = await owner.mutation(api.buildProgressUpdates.update, args);
    expect(await owner.mutation(api.buildProgressUpdates.update, args)).toEqual(first);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users[0].currentUsageMb).toBeCloseTo(1);
    expect((await t.run((ctx) => ctx.db.get(row!._id)))?.version).toBe(row!.version! + 1);
  });
});
