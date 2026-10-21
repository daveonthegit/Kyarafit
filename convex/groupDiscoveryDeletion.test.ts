import "./mediaTestHelpers.fixture";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { sharesAnyGroup } from "./lib/buildAccess";
import { canAttachReferencedStorage, storageReferences } from "./lib/storageReferences";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const records = await t.run(async (ctx) => {
    const avatar = await ctx.storage.store(new Blob(["private avatar"]));
    for (const externalId of ["alice", "bob", "carol"])
      await ctx.db.insert("users", {
        externalId,
        email: `${externalId}@example.test`,
        tier: "FREE",
        currentUsageMb: 0,
        profileVisibility: "private",
        ...(externalId === "carol" ? { imageStorageId: avatar } : {}),
      });
    const publicGroup = await ctx.db.insert("groups", {
      createdBy: "alice",
      name: "Deleting public group",
      visibility: "public",
      createdAt: 1,
      description: "Group details",
      imageUrl: "https://example.test/group.png",
    });
    const privateGroup = await ctx.db.insert("groups", {
      createdBy: "alice",
      name: "Deleting private group",
      visibility: "private",
      createdAt: 1,
    });
    const liveGroup = await ctx.db.insert("groups", {
      createdBy: "bob",
      name: "Live group",
      visibility: "public",
      createdAt: 1,
    });
    for (const groupId of [publicGroup, privateGroup]) {
      for (const userId of ["alice", "bob", "carol"])
        await ctx.db.insert("groupMembers", { groupId, userId, role: "member" });
    }
    await ctx.db.insert("groupMembers", { groupId: liveGroup, userId: "bob", role: "admin" });
    const conventionFields = { startDate: "2027-01-01", endDate: "2027-01-02" };
    const deletingConvention = await ctx.db.insert("conventions", {
      userId: "alice",
      name: "Deleting convention",
      ...conventionFields,
    });
    const liveConvention = await ctx.db.insert("conventions", {
      userId: "bob",
      name: "Live convention",
      ...conventionFields,
    });
    for (const groupId of [publicGroup, privateGroup, liveGroup]) {
      for (const conventionId of [deletingConvention, liveConvention])
        await ctx.db.insert("groupConventionDays", { groupId, conventionId, date: "2027-01-01" });
    }
    return { avatar, publicGroup, privateGroup, liveGroup, deletingConvention, liveConvention };
  });
  return { t, ...records };
}

describe("deletion-aware group discovery", () => {
  for (const failed of [false, true]) {
    it(`suppresses group and convention references during ${failed ? "failed" : "pending"} cleanup`, async () => {
      const { t, publicGroup, privateGroup, liveGroup, deletingConvention, liveConvention } =
        await fixture();
      const bob = t.withIdentity({ subject: "bob" });
      expect(
        await bob.query(api.groupConventionDays.listGroupsForConvention, {
          conventionId: liveConvention,
        })
      ).toHaveLength(3);
      expect(
        await bob.query(api.groupConventionDays.listForGroup, { groupId: liveGroup })
      ).toHaveLength(2);
      expect(
        await bob.query(api.groupConventionDays.listForGroupWithConventions, { groupId: liveGroup })
      ).toHaveLength(2);
      const jobId = await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
      if (failed) await t.run((ctx) => ctx.db.patch(jobId, { status: "failed" }));
      expect(
        (
          await bob.query(api.groupConventionDays.listGroupsForConvention, {
            conventionId: liveConvention,
          })
        ).map((g) => g._id)
      ).toEqual([liveGroup]);
      for (const groupId of [publicGroup, privateGroup]) {
        expect(await bob.query(api.groupConventionDays.listForGroup, { groupId })).toEqual([]);
        expect(
          await bob.query(api.groupConventionDays.listForGroupWithConventions, { groupId })
        ).toEqual([]);
      }
      const liveDays = await bob.query(api.groupConventionDays.listForGroup, {
        groupId: liveGroup,
      });
      expect(liveDays.map((d) => [d.conventionId, d.date])).toEqual([
        [liveConvention, "2027-01-01"],
      ]);
      expect(
        await bob.query(api.groupConventionDays.listForGroup, {
          groupId: liveGroup,
          conventionId: deletingConvention,
        })
      ).toEqual([]);
      expect(
        await bob.query(api.groupConventionDays.listForGroup, {
          groupId: liveGroup,
          conventionId: liveConvention,
        })
      ).toEqual(liveDays);
      expect(
        await bob.query(api.groupConventionDays.listForGroupWithConventions, { groupId: liveGroup })
      ).toEqual([
        {
          conventionId: liveConvention,
          conventionName: "Live convention",
          startDate: "2027-01-01",
          endDate: "2027-01-02",
          dates: ["2027-01-01"],
        },
      ]);
      expect(
        await t
          .withIdentity({ subject: "alice" })
          .query(api.groupConventionDays.listGroupsForConvention, {
            conventionId: deletingConvention,
          })
      ).toEqual([]);
    });

    for (const survivingRelationship of [false, true]) {
      it(`requires a live common group for private avatar discovery (${failed ? "failed" : "pending"}, surviving relationship: ${survivingRelationship})`, async () => {
        const { t, avatar, liveGroup } = await fixture();
        const bob = t.withIdentity({ subject: "bob" });
        const url = await bob.query(api.files.getUrl, { storageId: avatar });
        expect(url).not.toBeNull();
        expect(await t.run((ctx) => sharesAnyGroup(ctx, "bob", "carol"))).toBe(true);
        const jobId = await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
        if (failed) await t.run((ctx) => ctx.db.patch(jobId, { status: "failed" }));
        if (survivingRelationship)
          await t.run((ctx) =>
            ctx.db.insert("groupMembers", { groupId: liveGroup, userId: "carol", role: "member" })
          );
        expect(await t.run((ctx) => sharesAnyGroup(ctx, "bob", "carol"))).toBe(
          survivingRelationship
        );
        expect(await t.run((ctx) => sharesAnyGroup(ctx, "carol", "bob"))).toBe(
          survivingRelationship
        );
        expect(await bob.query(api.files.getUrl, { storageId: avatar })).toBe(
          survivingRelationship ? url : null
        );
        expect(
          await t.run(async (ctx) =>
            canAttachReferencedStorage(ctx, await storageReferences(ctx, avatar), "bob")
          )
        ).toBe(survivingRelationship);
        expect(
          await t.withIdentity({ subject: "carol" }).query(api.files.getUrl, { storageId: avatar })
        ).toBe(url);
      });
    }
  }
});
