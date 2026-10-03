import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { LOCAL_FIRST_TABLES } from "./tierTransition";
import { runUpgradeBackfill as webBackfill } from "../web/src/lib/offline/backfill";
import { runUpgradeBackfill as mobileBackfill } from "../mobile/src/offline/backfill";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = await ctx.db.insert("users", {
      externalId: "owner",
      email: "owner@example.com",
      tier: "PRO",
      currentUsageMb: 0,
    });
    const build = await ctx.db.insert("builds", {
      userId: "owner",
      name: "Build",
      status: "idea",
      clientId: "local-build",
    });
    const foreignBuild = await ctx.db.insert("builds", {
      userId: "other",
      name: "Other",
      status: "idea",
      visibility: "public",
    });
    const node = await ctx.db.insert("cosplayNodes", {
      userId: "owner",
      nodeType: "element",
      name: "Node",
      tags: [],
      buildId: build,
      clientId: "local-node",
    });
    const foreignNode = await ctx.db.insert("cosplayNodes", {
      userId: "other",
      nodeType: "element",
      name: "Other",
      tags: [],
    });
    const convention = await ctx.db.insert("conventions", {
      userId: "owner",
      name: "Event",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      clientId: "local-convention",
    });
    const foreignConvention = await ctx.db.insert("conventions", {
      userId: "other",
      name: "Other",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
    });
    const workflow = await ctx.db.insert("workflowItems", {
      userId: "owner",
      title: "Task",
      kind: "task",
      category: "craft",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
      clientId: "local-workflow",
    });
    const foreignWorkflow = await ctx.db.insert("workflowItems", {
      userId: "other",
      title: "Other",
      kind: "task",
      category: "craft",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
    });
    const packing = await ctx.db.insert("packingListItems", {
      userId: "owner",
      conventionId: convention,
      label: "Pack",
      checked: false,
      clientId: "local-packing",
    });
    const foreignPacking = await ctx.db.insert("packingListItems", {
      userId: "other",
      conventionId: foreignConvention,
      label: "Other",
      checked: false,
    });
    const group = await ctx.db.insert("groups", {
      name: "Group",
      createdBy: "owner",
      visibility: "private",
      createdAt: 1,
    });
    const foreignGroup = await ctx.db.insert("groups", {
      name: "Other",
      createdBy: "other",
      visibility: "public",
      createdAt: 1,
    });
    await ctx.db.insert("groupMembers", { groupId: group, userId: "owner", role: "member" });
    const template = await ctx.db.insert("workflowTemplates", {
      userId: "other",
      name: "Other",
      slug: "other",
      isBuiltIn: false,
    });
    const task = await ctx.db.insert("buildTasks", {
      userId: "other",
      label: "Other",
      sortOrder: 0,
      checked: false,
    });
    const storage = await ctx.storage.store(new Blob(["photo"], { type: "image/png" }));
    return {
      user,
      build,
      foreignBuild,
      node,
      foreignNode,
      convention,
      foreignConvention,
      workflow,
      foreignWorkflow,
      packing,
      foreignPacking,
      group,
      foreignGroup,
      template,
      task,
      storage,
    };
  });
  const shapes: Record<(typeof LOCAL_FIRST_TABLES)[number], Record<string, unknown>> = {
    builds: {
      name: "New build",
      status: "idea",
      notes: "Notes",
      budgetCents: 100,
      targetDate: "2026-10-01",
    },
    cosplayNodes: {
      nodeType: "element",
      name: "New node",
      tags: ["costume"],
      buildId: ids.build,
      parentNodeId: ids.node,
    },
    buildTasks: {
      buildId: ids.build,
      cosplayNodeId: ids.node,
      packingListItemId: ids.packing,
      label: "Task",
      sortOrder: 0,
      checked: false,
    },
    workflowItems: {
      title: "Task",
      kind: "task",
      category: "craft",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
      parentId: ids.workflow,
      reminders: [{ kind: "date", date: "2026-10-01" }],
    },
    workflowAttachments: {
      workflowItemId: ids.workflow,
      entityType: "build",
      entityId: ids.build,
      entityKey: "forged",
      role: "primary",
      buildContextId: ids.build,
    },
    workflowDependencies: {
      predecessorWorkflowItemId: ids.workflow,
      successorWorkflowItemId: "new-workflow",
      relationKind: "prerequisite",
    },
    conventions: {
      name: "Event",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      location: "Venue",
    },
    conventionDayPlans: { conventionId: ids.convention, date: "2026-10-01", buildId: ids.build },
    packingListItems: {
      conventionId: ids.convention,
      buildId: ids.build,
      cosplayNodeId: ids.node,
      workflowItemId: ids.workflow,
      label: "Pack",
      checked: false,
    },
    buildReferenceImages: {
      buildId: ids.build,
      imageUrl: "https://example.com/reference.png",
      sortOrder: 0,
    },
    buildProcessPictures: {
      buildId: ids.build,
      imageUrl: "https://example.com/process.png",
      sortOrder: 0,
    },
    buildProgressUpdates: {
      buildId: ids.build,
      createdAt: 1,
      note: "Progress",
      imageRefs: [
        { kind: "url", url: "https://example.com/photo.png" },
        { kind: "local", uri: "file:///photo.png", imageKey: "local-photo" },
      ],
      progressPercent: 50,
      publishedToFeed: false,
    },
  };
  const actor = t.withIdentity({ subject: "owner" });
  const push = (table: string, row: Record<string, unknown>, clientId = `new-${table}`) =>
    actor.mutation(api.tierTransition.backfillRows, { table, rows: [{ clientId, ...row }] });
  return { t, ids, shapes, actor, push };
}

describe("validated upgrade backfill", () => {
  it.each([
    ["web", webBackfill],
    ["mobile", mobileBackfill],
  ] as const)(
    "runs the actual %s upgrade orchestration through validated mutations and retries",
    async (_platform, run) => {
      const { t, actor } = await setup();
      const rows: Record<string, Array<Record<string, unknown> & { clientId: string }>> = {
        builds: [
          { clientId: "upgrade-build", _id: "local-build-alias", name: "Upgrade", status: "idea" },
        ],
        conventions: [
          {
            clientId: "upgrade-convention",
            _id: "local-event-alias",
            name: "Event",
            startDate: "2026-10-01",
            endDate: "2026-10-02",
          },
        ],
        cosplayNodes: [
          {
            clientId: "upgrade-child",
            name: "Child",
            nodeType: "element",
            tags: [],
            parentNodeId: "upgrade-parent",
            buildId: "local-build-alias",
          },
          {
            clientId: "upgrade-parent",
            name: "Parent",
            nodeType: "element",
            tags: [],
            buildId: "local-build-alias",
          },
        ],
        conventionDayPlans: [
          {
            clientId: "upgrade-day",
            conventionId: "local-event-alias",
            buildId: "local-build-alias",
            date: "2026-10-01",
          },
        ],
      };
      const original = structuredClone(rows);
      let completions = 0;
      const deps = {
        listLocalRows: (table: string) => rows[table] ?? [],
        isComplete: () => false,
        markComplete: () => {
          completions++;
        },
        pushChunk: (table: string, chunk: Array<Record<string, unknown>>) =>
          actor.mutation(api.tierTransition.backfillRows, { table, rows: chunk }),
      };
      expect(await run(deps)).toEqual({ running: false, done: 5, total: 5 });
      expect(await run(deps)).toEqual({ running: false, done: 5, total: 5 });
      const stored = await t.run(async (ctx) => ({
        build: await ctx.db
          .query("builds")
          .filter((q) => q.eq(q.field("clientId"), "upgrade-build"))
          .unique(),
        parent: await ctx.db
          .query("cosplayNodes")
          .filter((q) => q.eq(q.field("clientId"), "upgrade-parent"))
          .unique(),
        child: await ctx.db
          .query("cosplayNodes")
          .filter((q) => q.eq(q.field("clientId"), "upgrade-child"))
          .unique(),
        day: await ctx.db.query("conventionDayPlans").unique(),
        convention: await ctx.db
          .query("conventions")
          .filter((q) => q.eq(q.field("clientId"), "upgrade-convention"))
          .unique(),
      }));
      expect(stored.child?.buildId).toBe(stored.build?._id);
      expect(stored.child?.parentNodeId).toBe(stored.parent?._id);
      expect(stored.day?.buildId).toBe(stored.build?._id);
      expect(stored.day?.conventionId).toBe(stored.convention?._id);
      expect(rows).toEqual(original);
      expect(completions).toBe(2);
    }
  );
  it("accepts every table shape and retains the installed progress contract", async () => {
    const { t, shapes, push } = await setup();
    // Cross-table relationships use the already backfilled server id or actor-scoped clientId.
    for (const table of LOCAL_FIRST_TABLES) {
      const result = await push(
        table,
        shapes[table],
        table === "workflowItems" ? "new-workflow" : `new-${table}`
      );
      expect(result).toMatchObject({ table, inserted: 1, skipped: 0, total: 1 });
      expect(result.cloudCount).toBeGreaterThanOrEqual(1);
      const stored = await t.run((ctx) =>
        ctx.db
          .query(table)
          .withIndex("by_userId", (q) => q.eq("userId", "owner"))
          .collect()
      );
      expect(
        stored.some(
          (row) => row.clientId === (table === "workflowItems" ? "new-workflow" : `new-${table}`)
        )
      ).toBe(true);
    }
  });

  it.each(LOCAL_FIRST_TABLES)("rejects missing required shape for %s", async (table) => {
    const { push } = await setup();
    await expect(push(table, {})).rejects.toThrow(/Invalid backfill field/);
  });

  it.each([null, 12, "row", [], { clientId: 4 }, { clientId: "" }])(
    "rejects malformed row %j",
    async (row) => {
      const { actor } = await setup();
      await expect(
        actor.mutation(api.tierTransition.backfillRows, { table: "builds", rows: [row] })
      ).rejects.toThrow(/Invalid backfill/);
    }
  );

  it("bounds row count, row bytes, batch bytes, arrays and numeric values", async () => {
    const { actor, shapes, push } = await setup();
    await expect(
      actor.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: Array.from({ length: 101 }, (_, i) => ({ clientId: `b${i}`, ...shapes.builds })),
      })
    ).rejects.toThrow(/100 rows/);
    await expect(push("builds", { ...shapes.builds, notes: "x".repeat(10_001) })).rejects.toThrow(
      /Invalid backfill/
    );
    await expect(
      push("builds", { ...shapes.builds, fieldUpdatedAt: { oversized: "x".repeat(32 * 1024) } })
    ).rejects.toThrow(/row exceeds byte/);
    await expect(
      actor.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: Array.from({ length: 100 }, (_, i) => ({
          clientId: `b${i}`,
          ...shapes.builds,
          notes: "x".repeat(6000),
        })),
      })
    ).rejects.toThrow(/chunk exceeds byte/);
    await expect(
      push("cosplayNodes", { ...shapes.cosplayNodes, tags: Array(101).fill("tag") })
    ).rejects.toThrow(/Invalid backfill/);
    await expect(push("builds", { ...shapes.builds, manualProgressPercent: 101 })).rejects.toThrow(
      /Invalid backfill/
    );
    await expect(push("builds", { ...shapes.builds, budgetCents: NaN })).rejects.toThrow(
      /Invalid backfill/
    );
    await expect(push("builds", { ...shapes.builds, role: "owner" })).rejects.toThrow(
      /Invalid backfill/
    );
    await expect(
      push("buildProgressUpdates", {
        ...shapes.buildProgressUpdates,
        imageRefs: [{ kind: "cloud", storageId: 5, imageKey: "image" }],
      })
    ).rejects.toThrow(/Invalid backfill/);
  });

  it("accepts exactly the deployed 100-row chunk and skips rows without clientIds", async () => {
    const { actor, shapes } = await setup();
    const result = await actor.mutation(api.tierTransition.backfillRows, {
      table: "builds",
      rows: Array.from({ length: 100 }, (_, i) => ({ clientId: `b${i}`, ...shapes.builds })),
    });
    expect(result).toMatchObject({
      table: "builds",
      inserted: 100,
      skipped: 0,
      total: 100,
      cloudCount: 101,
    });
    expect(
      await actor.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: [shapes.builds],
      })
    ).toMatchObject({ inserted: 0, skipped: 1 });
  });

  it("dedupes within a chunk, after a lost response, and independently across tenants", async () => {
    const { t, actor, shapes } = await setup();
    const rows = [
      { ...shapes.builds, clientId: "retry" },
      { ...shapes.builds, clientId: "retry" },
    ];
    expect(
      await actor.mutation(api.tierTransition.backfillRows, { table: "builds", rows })
    ).toMatchObject({ inserted: 1, skipped: 1 });
    expect(
      await actor.mutation(api.tierTransition.backfillRows, { table: "builds", rows })
    ).toMatchObject({ inserted: 0, skipped: 2 });
    await t.run((ctx) =>
      ctx.db.insert("users", {
        externalId: "other",
        email: "other@example.com",
        tier: "PRO",
        currentUsageMb: 0,
      })
    );
    expect(
      await t
        .withIdentity({ subject: "other" })
        .mutation(api.tierTransition.backfillRows, { table: "builds", rows })
    ).toMatchObject({ inserted: 1, skipped: 1 });
  });

  it("derives ownership, sync clocks, ancestry, attachment keys and private publication", async () => {
    const { t, ids, shapes, push } = await setup();
    await push("builds", {
      ...shapes.builds,
      userId: "other",
      _id: "local-id",
      _creationTime: 1,
      version: 500,
      updatedAt: 1,
      fieldUpdatedAt: { name: 1 },
      deletedAt: 1,
      visibility: "public",
      shareToken: "forged",
      groupId: ids.group,
    });
    await push("workflowItems", {
      ...shapes.workflowItems,
      ancestorIds: [ids.foreignWorkflow],
      creatorUserId: "other",
      ownerUserId: "other",
      assigneeUserId: "other",
    });
    await push("workflowAttachments", shapes.workflowAttachments);
    await push("buildProgressUpdates", { ...shapes.buildProgressUpdates, publishedToFeed: true });
    const stored = await t.run(async (ctx) => ({
      build: await ctx.db
        .query("builds")
        .filter((q) => q.eq(q.field("clientId"), "new-builds"))
        .unique(),
      workflow: await ctx.db
        .query("workflowItems")
        .filter((q) => q.eq(q.field("clientId"), "new-workflowItems"))
        .unique(),
      attachment: await ctx.db.query("workflowAttachments").unique(),
      progress: await ctx.db.query("buildProgressUpdates").unique(),
    }));
    expect(stored.build).toMatchObject({ userId: "owner", version: 1, visibility: "private" });
    expect(stored.build?.updatedAt).toBeGreaterThan(1);
    expect(stored.build?.fieldUpdatedAt?.name).toBe(stored.build?.updatedAt);
    expect(stored.build?.deletedAt).toBeUndefined();
    expect(stored.build?.shareToken).toBeUndefined();
    expect(stored.build?.groupId).toBeUndefined();
    expect(stored.workflow).toMatchObject({
      ancestorIds: [ids.workflow],
      creatorUserId: "owner",
      ownerUserId: "owner",
      assigneeUserId: "owner",
    });
    expect(stored.attachment?.entityKey).toBe(`build:${ids.build}`);
    expect(stored.progress?.publishedToFeed).toBe(false);
  });

  it("remaps related clientIds and orders parents within a chunk without trusting cached ancestry", async () => {
    const { t, ids, shapes, actor, push } = await setup();
    await push("buildTasks", {
      ...shapes.buildTasks,
      buildId: "local-build",
      cosplayNodeId: "local-node",
      packingListItemId: "local-packing",
    });
    await t.run((ctx) => ctx.db.patch(ids.workflow, { ancestorIds: [ids.foreignWorkflow] }));
    const parent = { ...shapes.workflowItems, clientId: "parent", parentId: "local-workflow" };
    const child = { ...shapes.workflowItems, clientId: "child", parentId: "parent" };
    await actor.mutation(api.tierTransition.backfillRows, {
      table: "workflowItems",
      rows: [child, parent],
    });
    const rows = await t.run((ctx) => ctx.db.query("workflowItems").collect());
    const parentRow = rows.find((row) => row.clientId === "parent");
    const childRow = rows.find((row) => row.clientId === "child");
    expect(childRow?.parentId).toBe(parentRow?._id);
    expect(childRow?.ancestorIds).toEqual([ids.workflow, parentRow?._id]);
    const task = await t.run((ctx) =>
      ctx.db
        .query("buildTasks")
        .filter((q) => q.eq(q.field("clientId"), "new-buildTasks"))
        .unique()
    );
    expect(task).toMatchObject({
      buildId: ids.build,
      cosplayNodeId: ids.node,
      packingListItemId: ids.packing,
    });
  });

  it("rejects cross-owner, wrong-table, missing and deleted relationships, even for public rows", async () => {
    const { t, ids, shapes, push } = await setup();
    const cases = [
      ["buildTasks", "buildId", ids.foreignBuild],
      ["cosplayNodes", "parentNodeId", ids.foreignNode],
      ["buildTasks", "cosplayNodeId", ids.foreignNode],
      ["buildTasks", "packingListItemId", ids.foreignPacking],
      ["conventionDayPlans", "conventionId", ids.foreignConvention],
      ["packingListItems", "workflowItemId", ids.foreignWorkflow],
      ["workflowItems", "parentId", ids.foreignWorkflow],
      ["workflowItems", "templateId", ids.template],
      ["workflowItems", "legacyBuildTaskId", ids.task],
      ["builds", "groupId", ids.foreignGroup],
      ["workflowAttachments", "workflowItemId", ids.foreignWorkflow],
      ["workflowAttachments", "buildContextId", ids.foreignBuild],
      ["workflowDependencies", "predecessorWorkflowItemId", ids.foreignWorkflow],
      ["workflowDependencies", "successorWorkflowItemId", ids.foreignWorkflow],
      ["buildProcessPictures", "buildId", ids.foreignBuild],
      ["buildReferenceImages", "buildId", ids.foreignBuild],
      ["buildProgressUpdates", "buildId", ids.foreignBuild],
    ];
    for (const [table, field, foreign] of cases) {
      const shape = shapes[table as keyof typeof shapes];
      await expect(push(table, { ...shape, [field]: foreign })).rejects.toThrow(
        /backfill relationship/
      );
    }
    for (const value of [ids.convention, "missing-local-build"]) {
      await expect(push("buildTasks", { ...shapes.buildTasks, buildId: value })).rejects.toThrow(
        /backfill relationship/
      );
    }
    await t.run((ctx) => ctx.db.patch(ids.build, { deletedAt: Date.now() }));
    await expect(push("buildTasks", shapes.buildTasks)).rejects.toThrow(/backfill relationship/);
  });

  it.each(["build", "cosplayNode", "convention", "packingItem"])(
    "checks the actual %s attachment target",
    async (entityType) => {
      const { ids, shapes, push } = await setup();
      const foreign = {
        build: ids.foreignBuild,
        cosplayNode: ids.foreignNode,
        convention: ids.foreignConvention,
        packingItem: ids.foreignPacking,
      };
      await expect(
        push("workflowAttachments", {
          ...shapes.workflowAttachments,
          entityType,
          entityId: foreign[entityType as keyof typeof foreign],
        })
      ).rejects.toThrow(/backfill relationship/);
    }
  );

  it("preserves the established editor permission but not read-only collaborator permission", async () => {
    const { t, ids, shapes, push } = await setup();
    const collaborator = await t.run((ctx) =>
      ctx.db.insert("buildCollaborators", {
        buildId: ids.foreignBuild,
        userId: "owner",
        role: "viewer",
      })
    );
    await expect(
      push("buildTasks", { ...shapes.buildTasks, buildId: ids.foreignBuild })
    ).rejects.toThrow(/backfill relationship/);
    await t.run((ctx) => ctx.db.patch(collaborator, { role: "editor" }));
    expect(
      await push("buildTasks", { ...shapes.buildTasks, buildId: ids.foreignBuild })
    ).toMatchObject({ inserted: 1 });
  });

  it("rolls back a chunk with a bad relationship and rejects same-chunk cycles", async () => {
    const { t, shapes, actor } = await setup();
    await expect(
      actor.mutation(api.tierTransition.backfillRows, {
        table: "buildTasks",
        rows: [
          { clientId: "valid", ...shapes.buildTasks },
          { clientId: "bad", ...shapes.buildTasks, buildId: "missing" },
        ],
      })
    ).rejects.toThrow(/backfill relationship/);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("buildTasks")
          .filter((q) => q.eq(q.field("userId"), "owner"))
          .collect()
      )
    ).toEqual([]);
    await expect(
      actor.mutation(api.tierTransition.backfillRows, {
        table: "workflowItems",
        rows: [
          { ...shapes.workflowItems, clientId: "a", parentId: "b" },
          { ...shapes.workflowItems, clientId: "b", parentId: "a" },
        ],
      })
    ).rejects.toThrow(/Cyclic backfill/);
  });

  it("fails closed on cloud media at the S4 seam, without inserting or charging even at cap", async () => {
    const { t, ids, shapes, actor, push } = await setup();
    await t.run((ctx) => ctx.db.patch(ids.user, { currentUsageMb: 2048 }));
    for (const table of [
      "builds",
      "cosplayNodes",
      "conventions",
      "buildReferenceImages",
      "buildProcessPictures",
    ] as const) {
      await expect(push(table, { ...shapes[table], imageStorageId: ids.storage })).rejects.toThrow(
        /ownership and quota validation/
      );
    }
    await expect(
      push("buildProgressUpdates", {
        ...shapes.buildProgressUpdates,
        imageRefs: [{ kind: "cloud", storageId: ids.storage, imageKey: "cloud-photo" }],
      })
    ).rejects.toThrow(/ownership and quota validation/);
    await expect(
      actor.mutation(api.tierTransition.backfillRows, {
        table: "builds",
        rows: [
          { clientId: "plain", ...shapes.builds },
          { clientId: "media", ...shapes.builds, imageStorageId: ids.storage },
        ],
      })
    ).rejects.toThrow(/ownership and quota validation/);
    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(ids.user),
      builds: await ctx.db.query("builds").collect(),
    }));
    expect(state.user?.currentUsageMb).toBe(2048);
    expect(state.builds).toHaveLength(2);
    // No false quota charge for retries of a pre-existing, already-owned media row.
    await t.run((ctx) => ctx.db.patch(ids.build, { imageStorageId: ids.storage }));
    expect(
      await push("builds", { ...shapes.builds, imageStorageId: ids.storage }, "local-build")
    ).toMatchObject({ inserted: 0, skipped: 1 });
    expect((await t.run((ctx) => ctx.db.get(ids.user)))?.currentUsageMb).toBe(2048);
  });
});
