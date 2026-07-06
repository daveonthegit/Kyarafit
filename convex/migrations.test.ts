import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Backend tests for the ADDITIVE cosplayNodes build-scoping backfill (Step 2b,
// migrations:backfillCosplayNodeBuildScope). They exercise the migration end to end via the
// component's batch mutation and assert the lossless duplicate-per-build semantics + idempotency.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

type ConvexTestT = ReturnType<typeof convexTest>;

/** Run the whole backfill to completion (one batch is plenty for these tiny fixtures, but loop to be safe). */
async function runBackfill(t: ConvexTestT) {
  let cursor: string | null = null;
  // Guard against an accidental infinite loop in a test.
  for (let i = 0; i < 50; i += 1) {
    const result: { continueCursor: string; isDone: boolean; processed: number } = await t.mutation(
      internal.migrations.backfillCosplayNodeBuildScope,
      { oneBatchOnly: true, cursor, batchSize: 1000, dryRun: false }
    );
    if (result.isDone) return;
    cursor = result.continueCursor;
  }
  throw new Error("backfill did not finish within the batch loop guard");
}

async function insertBuild(t: ConvexTestT, userId: string, name: string) {
  return t.run(async (ctx) => ctx.db.insert("builds", { userId, name, status: "idea" })) as Promise<
    Id<"builds">
  >;
}

async function insertNode(
  t: ConvexTestT,
  fields: Partial<Record<string, unknown>> & { userId: string; nodeType: string; name: string }
) {
  return t.run(async (ctx) =>
    ctx.db.insert("cosplayNodes", { tags: [], ...fields } as never)
  ) as Promise<Id<"cosplayNodes">>;
}

describe("backfillCosplayNodeBuildScope: single-build node", () => {
  it("should_set_buildId_sortOrder_and_merge_buildNodeState_in_place", async () => {
    const t = convexTest(schema, modules);
    const build = await insertBuild(t, "u1", "Aerith");
    const node = await insertNode(t, {
      userId: "u1",
      nodeType: "element",
      name: "Wig",
      buildStatus: "not_started",
      pricingMode: "total",
      directCostCents: 100,
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build,
        cosplayNodeId: node,
        sortOrder: 3,
      });
      // Per-build override wins over the node's library defaults where it has a value.
      await ctx.db.insert("buildNodeStates", {
        userId: "u1",
        buildId: build,
        cosplayNodeId: node,
        buildStatus: "built",
        directCostCents: 500,
        manualOverallBucket: "complete",
      });
    });

    await runBackfill(t);

    const after = await t.run(async (ctx) => ctx.db.get(node));
    expect(after?.buildId).toBe(build);
    expect(after?.sortOrder).toBe(3);
    expect(after?.buildStatus).toBe("built"); // from buildNodeState
    expect(after?.directCostCents).toBe(500); // from buildNodeState
    expect(after?.manualOverallBucket).toBe("complete"); // from buildNodeState
    expect(after?.pricingMode).toBe("total"); // untouched: buildNodeState had no value

    const nodeCount = await t.run(
      async (ctx) => (await ctx.db.query("cosplayNodes").collect()).length
    );
    expect(nodeCount).toBe(1); // no duplicates for a single-build node
  });
});

describe("backfillCosplayNodeBuildScope: node shared across multiple builds", () => {
  it("should_keep_original_on_first_build_and_duplicate_per_additional_build_with_independent_state", async () => {
    const t = convexTest(schema, modules);
    const build1 = await insertBuild(t, "u1", "Build One");
    const build2 = await insertBuild(t, "u1", "Build Two");
    const node = await insertNode(t, {
      userId: "u1",
      nodeType: "element",
      name: "Shared Sword",
      buildStatus: "not_started",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build1,
        cosplayNodeId: node,
        sortOrder: 0,
      });
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build2,
        cosplayNodeId: node,
        sortOrder: 1,
      });
      await ctx.db.insert("buildNodeStates", {
        userId: "u1",
        buildId: build1,
        cosplayNodeId: node,
        buildStatus: "wip",
      });
      await ctx.db.insert("buildNodeStates", {
        userId: "u1",
        buildId: build2,
        cosplayNodeId: node,
        buildStatus: "built",
        directCostCents: 999,
      });
    });

    await runBackfill(t);

    const all = await t.run(async (ctx) => ctx.db.query("cosplayNodes").collect());
    expect(all).toHaveLength(2); // original + one copy for the second build

    const original = all.find((n) => n._id === node);
    const copy = all.find((n) => n._id !== node);
    expect(original?.buildId).toBe(build1);
    expect(original?.buildStatus).toBe("wip"); // build1 state
    expect(copy?.buildId).toBe(build2);
    expect(copy?.buildStatus).toBe("built"); // build2 state, independent
    expect(copy?.directCostCents).toBe(999);
    expect(copy?.name).toBe("Shared Sword"); // content copied verbatim
    // The copy has a fresh identity + deterministic marker clientId (idempotency guard).
    expect(copy?.clientId).toBe(`bnbs:${node}:${build2}`);
    expect(copy?.version).toBe(1);
  });

  it("should_duplicate_the_whole_subtree_with_remapped_parentNodeId", async () => {
    const t = convexTest(schema, modules);
    const build1 = await insertBuild(t, "u1", "Build One");
    const build2 = await insertBuild(t, "u1", "Build Two");
    const root = await insertNode(t, { userId: "u1", nodeType: "element", name: "Armor" });
    const child = await insertNode(t, { userId: "u1", nodeType: "material", name: "Foam" });
    await t.run(async (ctx) => {
      await ctx.db.insert("cosplayNodeLinks", {
        userId: "u1",
        parentNodeId: root,
        childNodeId: child,
        sortOrder: 0,
        linkMode: "owned",
      });
      // Only the root is attached to builds; the child rides along via the subtree.
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build1,
        cosplayNodeId: root,
        sortOrder: 0,
      });
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build2,
        cosplayNodeId: root,
        sortOrder: 1,
      });
    });

    await runBackfill(t);

    const all = await t.run(async (ctx) => ctx.db.query("cosplayNodes").collect());
    expect(all).toHaveLength(4); // root + child, then a duplicated root + child for build2

    // Original subtree scoped to build1 in place.
    const originalRoot = all.find((n) => n._id === root)!;
    const originalChild = all.find((n) => n._id === child)!;
    expect(originalRoot.buildId).toBe(build1);
    expect(originalRoot.parentNodeId).toBeUndefined(); // root is top-level in its build
    expect(originalChild.buildId).toBe(build1);
    expect(originalChild.parentNodeId).toBe(root); // points at original parent

    // Duplicated subtree for build2 with remapped parent pointers.
    const copyRoot = all.find((n) => n.buildId === build2 && n.parentNodeId === undefined)!;
    const copyChild = all.find((n) => n.buildId === build2 && n.parentNodeId !== undefined)!;
    expect(copyRoot._id).not.toBe(root);
    expect(copyChild._id).not.toBe(child);
    expect(copyChild.parentNodeId).toBe(copyRoot._id); // remapped to the copied parent
    expect(copyChild.parentNodeId).not.toBe(root); // NOT pointing at the original
    expect(copyRoot.name).toBe("Armor");
    expect(copyChild.name).toBe("Foam");
  });
});

describe("backfillCosplayNodeBuildScope: library-only nodes", () => {
  it("should_leave_library_only_nodes_unscoped_but_backfill_parentNodeId_from_nesting", async () => {
    const t = convexTest(schema, modules);
    const parent = await insertNode(t, { userId: "u1", nodeType: "element", name: "Lib Parent" });
    const child = await insertNode(t, { userId: "u1", nodeType: "material", name: "Lib Child" });
    await t.run(async (ctx) => {
      await ctx.db.insert("cosplayNodeLinks", {
        userId: "u1",
        parentNodeId: parent,
        childNodeId: child,
        sortOrder: 2,
        linkMode: "owned",
      });
    });

    await runBackfill(t);

    const afterParent = await t.run(async (ctx) => ctx.db.get(parent));
    const afterChild = await t.run(async (ctx) => ctx.db.get(child));
    // No build attachment => stays a library node, buildId left null.
    expect(afterParent?.buildId).toBeUndefined();
    expect(afterChild?.buildId).toBeUndefined();
    // Nesting is still valid in the library: parentNodeId is backfilled from cosplayNodeLinks.
    expect(afterChild?.parentNodeId).toBe(parent);
    expect(afterChild?.sortOrder).toBe(2);

    const nodeCount = await t.run(
      async (ctx) => (await ctx.db.query("cosplayNodes").collect()).length
    );
    expect(nodeCount).toBe(2); // never duplicated, never deleted
  });
});

describe("backfillCosplayNodeBuildScope: idempotency", () => {
  it("should_be_a_no_op_on_re_run_and_never_create_extra_copies", async () => {
    const t = convexTest(schema, modules);
    const build1 = await insertBuild(t, "u1", "Build One");
    const build2 = await insertBuild(t, "u1", "Build Two");
    const root = await insertNode(t, { userId: "u1", nodeType: "element", name: "Armor" });
    const child = await insertNode(t, { userId: "u1", nodeType: "material", name: "Foam" });
    await t.run(async (ctx) => {
      await ctx.db.insert("cosplayNodeLinks", {
        userId: "u1",
        parentNodeId: root,
        childNodeId: child,
        sortOrder: 0,
        linkMode: "owned",
      });
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build1,
        cosplayNodeId: root,
        sortOrder: 0,
      });
      await ctx.db.insert("buildCosplayLinks", {
        userId: "u1",
        buildId: build2,
        cosplayNodeId: root,
        sortOrder: 1,
      });
    });

    await runBackfill(t);
    const afterFirst = await t.run(async (ctx) => ctx.db.query("cosplayNodes").collect());
    expect(afterFirst).toHaveLength(4);
    const copyIdsFirst = afterFirst
      .filter((n) => n.buildId === build2)
      .map((n) => n._id)
      .sort();

    // Re-run: must not create a second set of copies or mutate the existing ones' identities.
    await runBackfill(t);
    const afterSecond = await t.run(async (ctx) => ctx.db.query("cosplayNodes").collect());
    expect(afterSecond).toHaveLength(4);
    const copyIdsSecond = afterSecond
      .filter((n) => n.buildId === build2)
      .map((n) => n._id)
      .sort();
    expect(copyIdsSecond).toEqual(copyIdsFirst); // same copies, no new ones
  });
});
