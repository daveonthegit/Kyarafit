import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import { DOWNGRADE_RETENTION_MS } from "@kyarafit/design-system/domain/tierTransition";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

describe("downgrade replica retention", () => {
  it("purges only expired replicas, preserves free publications, and supports dry runs", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
      const ids: Record<string, string> = {};
      for (const [subject, tier, age] of [
        ["expired", "FREE", DOWNGRADE_RETENTION_MS + 1],
        ["recent", "FREE", 1],
        ["paid", "SUPPORTER", DOWNGRADE_RETENTION_MS + 1],
      ] as const) {
        await ctx.db.insert("users", {
          externalId: subject,
          email: `${subject}@example.invalid`,
          tier,
          currentUsageMb: 0,
          downgradedAt: now - age,
        });
        ids[subject] = await ctx.db.insert("replicaRows", {
          userId: subject,
          table: "builds",
          rowId: `local:${subject}`,
          doc: { name: subject },
          fieldRevs: {},
          deleted: false,
          rev: 1,
        });
      }
      ids.publication = await ctx.db.insert("builds", {
        userId: "expired",
        name: "Public",
        status: "idea",
        visibility: "public",
      });
      return ids;
    });
    expect(
      await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now, dryRun: true })
    ).toMatchObject({ usersPurged: 1, rowsDeleted: 1 });
    expect(await t.run((ctx) => ctx.db.query("replicaRows").collect())).toHaveLength(3);
    expect(
      await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now })
    ).toMatchObject({ usersPurged: 1, rowsDeleted: 1 });
    expect(
      (await t.run((ctx) => ctx.db.query("replicaRows").collect())).map((row) => row.userId).sort()
    ).toEqual(["paid", "recent"]);
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toHaveLength(1);
    expect(
      await t.mutation(internal.tierTransition.purgeDowngradedCloudData, { now })
    ).toMatchObject({ usersPurged: 0, rowsDeleted: 0 });
  });
});
