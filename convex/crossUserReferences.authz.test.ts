/**
 * Cross-user reference regressions for workflow attachments and group convention days.
 *
 * Both surfaces take ids of *other* resources as arguments (`entityId`, `buildContextId`,
 * `conventionId`) and, before this fix, stored or followed them without asking whether the
 * session actor could reach the resource. Two kinds of check live here:
 *
 *  - the boundary: a mutation handed a foreign id rejects it before writing;
 *  - stored rows: a reference that already exists (written before the boundary check, or by
 *    any other path) is never followed to read, overwrite or delete a foreign resource.
 *
 * The positive cases pin the legitimate flows that must keep working: owners, build editors
 * and group members.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

const ALICE = "xref-alice";
const BOB = "xref-bob";

type Fixture = {
  t: ReturnType<typeof convexTest>;
  bobBuild: Id<"builds">;
  bobNode: Id<"cosplayNodes">;
  bobConvention: Id<"conventions">;
  bobPacking: Id<"packingListItems">;
  aliceBuild: Id<"builds">;
  aliceConvention: Id<"conventions">;
  aliceGroup: Id<"groups">;
};

async function fixture(): Promise<Fixture> {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const bobBuild = await ctx.db.insert("builds", {
      userId: BOB,
      name: "Bob secret build",
      status: "wip",
      visibility: "private",
    });
    const bobNode = await ctx.db.insert("cosplayNodes", {
      userId: BOB,
      nodeType: "element",
      name: "Bob secret helmet",
      tags: [],
      buildId: bobBuild,
      sortOrder: 0,
    });
    const bobConvention = await ctx.db.insert("conventions", {
      userId: BOB,
      name: "Bob secret con",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
    });
    const bobPacking = await ctx.db.insert("packingListItems", {
      userId: BOB,
      conventionId: bobConvention,
      label: "Bob's wig",
      checked: true,
    });
    const aliceBuild = await ctx.db.insert("builds", {
      userId: ALICE,
      name: "Alice build",
      status: "wip",
      visibility: "private",
    });
    const aliceConvention = await ctx.db.insert("conventions", {
      userId: ALICE,
      name: "Alice con",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
    });
    const aliceGroup = await ctx.db.insert("groups", {
      name: "Alice's group",
      createdBy: ALICE,
      visibility: "private",
      createdAt: 1_760_000_000_000,
    });
    await ctx.db.insert("groupMembers", { groupId: aliceGroup, userId: ALICE, role: "admin" });
    return {
      bobBuild,
      bobNode,
      bobConvention,
      bobPacking,
      aliceBuild,
      aliceConvention,
      aliceGroup,
    };
  });
  return { t, ...ids };
}

/** An attachment row that already exists, as if written before the boundary check. */
async function plantAttachment(
  f: Fixture,
  workflowItemId: Id<"workflowItems">,
  entityType: string,
  entityId: string,
  role: string
) {
  await f.t.run(async (ctx) => {
    await ctx.db.insert("workflowAttachments", {
      userId: ALICE,
      workflowItemId,
      entityType,
      entityId,
      entityKey: `${entityType}:${entityId}`,
      role,
    });
  });
}

async function aliceItem(f: Fixture, extra: { dedupeKey?: string } = {}) {
  return await f.t.run(async (ctx) =>
    ctx.db.insert("workflowItems", {
      userId: ALICE,
      title: "Alice task",
      kind: "task",
      category: "pack",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
      ...extra,
    })
  );
}

describe("workflow attachments only reference resources the actor can reach", () => {
  test("create rejects every kind of foreign reference", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const foreign = [
      { entityType: "packingItem", entityId: f.bobPacking, role: "packing_entry" },
      { entityType: "convention", entityId: f.bobConvention, role: "context" },
      { entityType: "cosplayNode", entityId: f.bobNode, role: "progress_source" },
      { entityType: "build", entityId: f.bobBuild, role: "primary" },
      // Her own build, but filed under Bob's build as the context.
      {
        entityType: "build",
        entityId: f.aliceBuild,
        role: "primary",
        buildContextId: f.bobBuild,
      },
    ];
    for (const attachment of foreign) {
      await expect(
        asAlice.mutation(api.workflow.create, { title: "steal", attachments: [attachment] })
      ).rejects.toThrow(/not authorized|not found/i);
    }
    expect(await f.t.run((ctx) => ctx.db.query("workflowAttachments").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("workflowItems").collect())).toEqual([]);
  });

  test("update rejects a foreign packing item and cannot overwrite it", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const item = await aliceItem(f);
    await expect(
      asAlice.mutation(api.workflow.update, {
        id: item,
        title: "overwritten",
        status: "not_started",
        attachments: [{ entityType: "packingItem", entityId: f.bobPacking, role: "packing_entry" }],
      })
    ).rejects.toThrow(/not authorized|not found/i);
    const packing = await f.t.run((ctx) => ctx.db.get(f.bobPacking));
    expect(packing?.label).toBe("Bob's wig");
    expect(packing?.checked).toBe(true);
  });

  test("applyTemplate rejects a foreign attachment or build context", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    await asAlice.mutation(api.workflow.seedBuiltinTemplates, {});
    const template = (await asAlice.query(api.workflow.listTemplates, {}))[0];
    await expect(
      asAlice.mutation(api.workflow.applyTemplate, {
        templateId: template._id,
        attachments: [{ entityType: "packingItem", entityId: f.bobPacking, role: "packing_entry" }],
      })
    ).rejects.toThrow(/not authorized|not found/i);
    await expect(
      asAlice.mutation(api.workflow.applyTemplate, {
        templateId: template._id,
        attachments: [{ entityType: "build", entityId: f.aliceBuild, role: "primary" }],
        buildContextId: f.bobBuild,
      })
    ).rejects.toThrow(/not authorized|not found/i);
    expect(await f.t.run((ctx) => ctx.db.query("workflowAttachments").collect())).toEqual([]);
  });

  test("a stored foreign packing reference is never synced into or deleted", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const item = await aliceItem(f);
    await plantAttachment(f, item, "packingItem", f.bobPacking, "packing_entry");

    await asAlice.mutation(api.workflow.update, {
      id: item,
      title: "overwritten",
      status: "not_started",
    });
    let packing = await f.t.run((ctx) => ctx.db.get(f.bobPacking));
    expect(packing?.label).toBe("Bob's wig");
    expect(packing?.checked).toBe(true);
    expect(packing?.workflowItemId).toBeUndefined();

    await asAlice.mutation(api.workflow.remove, { id: item });
    packing = await f.t.run((ctx) => ctx.db.get(f.bobPacking));
    expect(packing).not.toBeNull();
  });

  test("the planner does not resolve names or progress of stored foreign references", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const item = await aliceItem(f);
    await plantAttachment(f, item, "build", f.bobBuild, "context");
    await plantAttachment(f, item, "convention", f.bobConvention, "context");

    const planner = await asAlice.query(api.workflow.listPlanner, {});
    expect(planner).toHaveLength(1);
    expect(planner[0].buildName).toBeNull();
    expect(planner[0].conventionName).toBeNull();
    expect(JSON.stringify(planner)).not.toMatch(/Bob secret/);

    // Progress sources: Bob's packing item is checked; it must not count toward Alice's task.
    await f.t.run(async (ctx) => {
      await ctx.db.insert("workflowAttachments", {
        userId: ALICE,
        workflowItemId: item,
        entityType: "build",
        entityId: f.aliceBuild,
        entityKey: `build:${f.aliceBuild}`,
        role: "primary",
      });
    });
    await plantAttachment(f, item, "packingItem", f.bobPacking, "progress_source");
    const tree = await asAlice.query(api.workflow.listBuildTree, { buildId: f.aliceBuild });
    expect(tree?.items).toHaveLength(1);
    expect(tree?.items[0].progressPercent).toBe(0);
  });

  test("a planted dedupe key cannot capture another user's packing sync", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const asBob = f.t.withIdentity({ subject: BOB });

    // The boundary refuses reserved generator keys outright.
    await expect(
      asAlice.mutation(api.workflow.create, {
        title: "trap",
        dedupeKey: `packing:${f.bobPacking}`,
      })
    ).rejects.toThrow(/reserved/i);

    // A stored row carrying one is ignored by Bob's own sync.
    const trap = await aliceItem(f, { dedupeKey: `packing:${f.bobPacking}` });
    await asBob.mutation(api.conventions.updatePackingItem, {
      id: f.bobPacking,
      label: "Bob's wig v2",
    });
    const trapAfter = await f.t.run((ctx) => ctx.db.get(trap));
    expect(trapAfter?.title).toBe("Alice task");
    const trapAttachments = await f.t.run((ctx) =>
      ctx.db
        .query("workflowAttachments")
        .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", trap))
        .collect()
    );
    expect(trapAttachments).toEqual([]);
    const packing = await f.t.run((ctx) => ctx.db.get(f.bobPacking));
    const bobItem = packing?.workflowItemId
      ? await f.t.run((ctx) => ctx.db.get(packing.workflowItemId!))
      : null;
    expect(bobItem?.userId).toBe(BOB);
    expect(bobItem?.title).toBe("Bob's wig v2");
  });

  test("packing entry points refuse a foreign build", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    await expect(
      asAlice.mutation(api.conventions.addManualPackingItem, {
        conventionId: f.aliceConvention,
        label: "x",
        buildId: f.bobBuild,
      })
    ).rejects.toThrow(/not authorized|not found/i);
    await expect(
      asAlice.mutation(api.conventions.replacePlan, {
        conventionId: f.aliceConvention,
        plan: [{ date: "2026-10-01", buildId: f.bobBuild }],
      })
    ).rejects.toThrow(/not authorized|not found/i);
  });

  test("regenerating packing skips a stored plan that points at a foreign build", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    await f.t.run(async (ctx) => {
      await ctx.db.insert("conventionDayPlans", {
        userId: ALICE,
        conventionId: f.aliceConvention,
        date: "2026-10-01",
        buildId: f.bobBuild,
      });
    });
    const created = await asAlice.mutation(api.conventions.regeneratePacking, {
      conventionId: f.aliceConvention,
    });
    expect(created).toEqual([]);
    const packing = await asAlice.query(api.conventions.getPacking, {
      conventionId: f.aliceConvention,
    });
    expect(JSON.stringify(packing)).not.toMatch(/Bob secret/);
  });
});

describe("legitimate workflow flows keep working", () => {
  test("an owner attaches their own build, node, convention and packing item", async () => {
    const f = await fixture();
    const asBob = f.t.withIdentity({ subject: BOB });
    const created = await asBob.mutation(api.workflow.create, {
      title: "Bob task",
      attachments: [
        { entityType: "build", entityId: f.bobBuild, role: "primary", buildContextId: f.bobBuild },
        {
          entityType: "cosplayNode",
          entityId: f.bobNode,
          role: "progress_source",
          buildContextId: f.bobBuild,
        },
        { entityType: "convention", entityId: f.bobConvention, role: "context" },
        { entityType: "packingItem", entityId: f.bobPacking, role: "packing_entry" },
        { entityType: "plannerBucket", entityId: "this-week", role: "planner_bucket" },
      ],
    });
    expect(created).not.toBeNull();
    const planner = await asBob.query(api.workflow.listPlanner, {});
    expect(planner[0].buildName).toBe("Bob secret build");
    expect(planner[0].conventionName).toBe("Bob secret con");

    await asBob.mutation(api.workflow.update, { id: created!._id, title: "Renamed" });
    expect((await f.t.run((ctx) => ctx.db.get(f.bobPacking)))?.label).toBe("Renamed");
    await asBob.mutation(api.workflow.remove, { id: created!._id });
    expect(await f.t.run((ctx) => ctx.db.get(f.bobPacking))).toBeNull();
  });

  test("a build editor still edits the owner's build task", async () => {
    const f = await fixture();
    const asBob = f.t.withIdentity({ subject: BOB });
    const asAlice = f.t.withIdentity({ subject: ALICE });
    await f.t.run(async (ctx) => {
      await ctx.db.insert("buildCollaborators", {
        buildId: f.bobBuild,
        userId: ALICE,
        role: "editor",
      });
    });
    const created = await asBob.mutation(api.workflow.create, {
      title: "Bob build task",
      attachments: [{ entityType: "build", entityId: f.bobBuild, role: "primary" }],
    });
    const updated = await asAlice.mutation(api.workflow.update, {
      id: created!._id,
      title: "Edited by Alice",
      attachments: [{ entityType: "build", entityId: f.bobBuild, role: "primary" }],
    });
    expect(updated?.title).toBe("Edited by Alice");
    // The editor can file her own task under the build she edits.
    const own = await asAlice.mutation(api.workflow.create, {
      title: "Alice on Bob build",
      attachments: [
        { entityType: "build", entityId: f.bobBuild, role: "primary", buildContextId: f.bobBuild },
      ],
    });
    expect(own?.userId).toBe(ALICE);
  });

  test("an owner's packing list still drives its workflow items", async () => {
    const f = await fixture();
    const asBob = f.t.withIdentity({ subject: BOB });
    await asBob.mutation(api.conventions.replacePlan, {
      conventionId: f.bobConvention,
      plan: [{ date: "2026-09-01", buildId: f.bobBuild }],
    });
    const generated = await asBob.mutation(api.conventions.regeneratePacking, {
      conventionId: f.bobConvention,
    });
    expect(generated.map((row) => row?.label)).toEqual(["Bob secret helmet"]);
    const manual = await asBob.mutation(api.conventions.addManualPackingItem, {
      conventionId: f.bobConvention,
      label: "Snacks",
      buildId: f.bobBuild,
    });
    expect(manual?.workflowItemId).toBeDefined();
    await asBob.mutation(api.conventions.updatePackingItem, { id: manual!._id, checked: true });
    const item = await f.t.run((ctx) => ctx.db.get(manual!.workflowItemId!));
    expect(item?.status).toBe("done");
    await asBob.mutation(api.conventions.deletePackingItem, { id: manual!._id });
    expect(await f.t.run((ctx) => ctx.db.get(manual!._id))).toBeNull();
  });
});

describe("group convention days only link the linking admin's own conventions", () => {
  test("setDays and addDay reject another user's convention without echoing its dates", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    for (const call of [
      () =>
        asAlice.mutation(api.groupConventionDays.setDays, {
          groupId: f.aliceGroup,
          conventionId: f.bobConvention,
          dates: ["2026-09-02"],
        }),
      () =>
        asAlice.mutation(api.groupConventionDays.setDays, {
          groupId: f.aliceGroup,
          conventionId: f.bobConvention,
          dates: ["2020-01-01"],
        }),
      () =>
        asAlice.mutation(api.groupConventionDays.addDay, {
          groupId: f.aliceGroup,
          conventionId: f.bobConvention,
          date: "2026-09-02",
        }),
      () =>
        asAlice.mutation(api.groupConventionDays.addDay, {
          groupId: f.aliceGroup,
          conventionId: f.bobConvention,
          date: "2020-01-01",
        }),
    ]) {
      const error = await call().then(
        () => null,
        (e: Error) => e
      );
      expect(error?.message).toMatch(/Convention not found/);
      expect(error?.message).not.toMatch(/2026-09/);
    }
    expect(await f.t.run((ctx) => ctx.db.query("groupConventionDays").collect())).toEqual([]);
  });

  test("a stored link to a non-member's convention is not listed", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    await f.t.run(async (ctx) => {
      await ctx.db.insert("groupConventionDays", {
        groupId: f.aliceGroup,
        conventionId: f.bobConvention,
        date: "2026-09-02",
      });
    });
    expect(
      await asAlice.query(api.groupConventionDays.listForGroupWithConventions, {
        groupId: f.aliceGroup,
      })
    ).toEqual([]);
    expect(
      await asAlice.query(api.groupConventionDays.listForGroup, { groupId: f.aliceGroup })
    ).toEqual([]);
  });

  test("members see the admin's own linked convention until its owner leaves", async () => {
    const f = await fixture();
    const asAlice = f.t.withIdentity({ subject: ALICE });
    const asBob = f.t.withIdentity({ subject: BOB });
    await asAlice.mutation(api.groups.addMember, {
      groupId: f.aliceGroup,
      newUserId: BOB,
      role: "member",
    });
    await asAlice.mutation(api.groupConventionDays.setDays, {
      groupId: f.aliceGroup,
      conventionId: f.aliceConvention,
      dates: ["2026-10-02", "2026-10-01"],
    });
    await asAlice.mutation(api.groupConventionDays.addDay, {
      groupId: f.aliceGroup,
      conventionId: f.aliceConvention,
      date: "2026-10-03",
    });
    expect(
      await asBob.query(api.groupConventionDays.listForGroupWithConventions, {
        groupId: f.aliceGroup,
      })
    ).toEqual([
      {
        conventionId: f.aliceConvention,
        conventionName: "Alice con",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        dates: ["2026-10-01", "2026-10-02", "2026-10-03"],
      },
    ]);
    expect(
      await asBob.query(api.groupConventionDays.listForGroup, { groupId: f.aliceGroup })
    ).toHaveLength(3);

    // Promote Bob, then the convention's owner leaves: her convention is no longer shown.
    await asAlice.mutation(api.groups.setMemberRole, {
      groupId: f.aliceGroup,
      targetUserId: BOB,
      role: "admin",
    });
    await asAlice.mutation(api.groups.removeMember, {
      groupId: f.aliceGroup,
      removeUserId: ALICE,
    });
    expect(
      await asBob.query(api.groupConventionDays.listForGroupWithConventions, {
        groupId: f.aliceGroup,
      })
    ).toEqual([]);
    expect(
      await asBob.query(api.groupConventionDays.listForGroup, { groupId: f.aliceGroup })
    ).toEqual([]);
  });
});
