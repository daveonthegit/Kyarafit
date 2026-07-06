import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Step 2c REWIRE spec: build membership comes from cosplayNodes.buildId, nesting from parentNodeId,
// and per-build state from the node's OWN fields — NOT the buildCosplayLinks / buildNodeStates /
// cosplayNodeLinks join tables. These tests seed the NEW model and assert the SAME public shapes.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

type NodeSeed = {
  userId?: string;
  nodeType?: "element" | "material";
  name: string;
  tags?: string[];
  buildId?: Id<"builds">;
  parentNodeId?: Id<"cosplayNodes">;
  sortOrder?: number;
  purchaseStatus?: string;
  buildStatus?: string;
  materialStatus?: string;
  manualOverallBucket?: string;
  directCostCents?: number;
};

async function seedNode(
  t: ReturnType<typeof convexTest>,
  seed: NodeSeed
): Promise<Id<"cosplayNodes">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("cosplayNodes", {
      userId: seed.userId ?? "u1",
      nodeType: seed.nodeType ?? "element",
      name: seed.name,
      tags: seed.tags ?? [],
      buildId: seed.buildId,
      parentNodeId: seed.parentNodeId,
      sortOrder: seed.sortOrder,
      purchaseStatus: seed.purchaseStatus,
      buildStatus: seed.buildStatus,
      materialStatus: seed.materialStatus,
      manualOverallBucket: seed.manualOverallBucket,
      directCostCents: seed.directCostCents,
    })
  );
}

async function seedBuild(t: ReturnType<typeof convexTest>, userId = "u1"): Promise<Id<"builds">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("builds", { userId, name: "Build", status: "wip", visibility: "private" })
  );
}

describe("cosplayNodes.list (Step 2c)", () => {
  it("should_return_all_user_nodes_as_the_library_view_including_build_scoped_nodes", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t);
    await seedNode(t, { name: "Library node" });
    await seedNode(t, { name: "Build node", buildId });
    await seedNode(t, { name: "Other user", userId: "u2" });

    const rows = await t.query(api.cosplayNodes.list, { userId: "u1" });
    expect(rows.map((r) => r.name).sort()).toEqual(["Build node", "Library node"]);
  });

  it("should_exclude_children_when_rootsOnly_using_parentNodeId", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    await seedNode(t, { name: "Child", parentNodeId: parent, sortOrder: 0 });

    const roots = await t.query(api.cosplayNodes.list, { userId: "u1", rootsOnly: true });
    expect(roots.map((r) => r.name)).toEqual(["Parent"]);

    const all = await t.query(api.cosplayNodes.list, { userId: "u1" });
    expect(all.map((r) => r.name).sort()).toEqual(["Child", "Parent"]);
  });

  it("should_derive_overallBucket_from_the_nodes_own_fields", async () => {
    const t = convexTest(schema, modules);
    await seedNode(t, { name: "Bought", purchaseStatus: "bought" });
    await seedNode(t, { name: "Todo" });

    const rows = await t.query(api.cosplayNodes.list, { userId: "u1", sortBy: "name" });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.overallBucket]));
    expect(byName["Bought"]).toBe("complete");
    expect(byName["Todo"]).toBe("incomplete");
  });
});

describe("cosplayNodes.get (Step 2c)", () => {
  it("should_return_children_via_parentNodeId_with_child_node_id_as_linkId", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const childB = await seedNode(t, { name: "B", parentNodeId: parent, sortOrder: 1 });
    const childA = await seedNode(t, { name: "A", parentNodeId: parent, sortOrder: 0 });

    const node = await t.query(api.cosplayNodes.get, { id: parent });
    expect(node?.children.map((c) => c._id)).toEqual([childA, childB]); // ordered by sortOrder
    expect(node?.children.map((c) => c.linkId)).toEqual([childA, childB]); // linkId = child._id
    expect(node?.children.every((c) => c.linkMode === "owned")).toBe(true);
    expect(node?.childCount).toBe(2);
  });

  it("should_return_the_single_parent_via_parentNodeId_with_self_as_linkId", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const child = await seedNode(t, { name: "Child", parentNodeId: parent });

    const node = await t.query(api.cosplayNodes.get, { id: child });
    expect(node?.parents).toHaveLength(1);
    expect(node?.parents[0]._id).toBe(parent);
    expect(node?.parents[0].linkId).toBe(child); // removing the link clears THIS node's parentNodeId
  });
});

describe("cosplayNodes.listChildren (Step 2c)", () => {
  it("should_list_children_ordered_by_sortOrder", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    await seedNode(t, { name: "second", parentNodeId: parent, sortOrder: 1 });
    await seedNode(t, { name: "first", parentNodeId: parent, sortOrder: 0 });

    const children = await t.query(api.cosplayNodes.listChildren, { parentNodeId: parent });
    expect(children.map((c) => c.name)).toEqual(["first", "second"]);
  });
});

describe("cosplayNodes child-link mutations (Step 2c)", () => {
  it("should_set_parentNodeId_and_sortOrder_on_addChildLink", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const child = await seedNode(t, { name: "Child" });

    await t.mutation(api.cosplayNodes.addChildLink, {
      userId: "u1",
      parentNodeId: parent,
      childNodeId: child,
      linkMode: "owned",
    });

    const stored = await t.run(async (ctx) => ctx.db.get(child));
    expect(stored?.parentNodeId).toBe(parent);
    expect(stored?.sortOrder).toBe(0);
  });

  it("should_clear_parentNodeId_on_removeChildLink_using_the_child_node_id", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const child = await seedNode(t, { name: "Child", parentNodeId: parent, sortOrder: 0 });

    await t.mutation(api.cosplayNodes.removeChildLink, { id: child, userId: "u1" });

    const stored = await t.run(async (ctx) => ctx.db.get(child));
    expect(stored?.parentNodeId).toBeUndefined();
  });

  it("should_reorder_children_by_patching_node_sortOrder", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const a = await seedNode(t, { name: "A", parentNodeId: parent, sortOrder: 0 });
    const b = await seedNode(t, { name: "B", parentNodeId: parent, sortOrder: 1 });

    await t.mutation(api.cosplayNodes.reorderChildren, {
      parentNodeId: parent,
      userId: "u1",
      orderedLinkIds: [b, a],
    });

    const children = await t.query(api.cosplayNodes.listChildren, { parentNodeId: parent });
    expect(children.map((c) => c._id)).toEqual([b, a]);
  });
});

describe("cosplayNodes.remove cascade (Step 2c)", () => {
  it("should_reparent_children_to_roots_when_not_cascading", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const child = await seedNode(t, {
      name: "Child",
      nodeType: "material",
      parentNodeId: parent,
      sortOrder: 0,
    });

    await t.mutation(api.cosplayNodes.remove, { id: parent, userId: "u1" });

    const stored = await t.run(async (ctx) => ctx.db.get(child));
    expect(stored).not.toBeNull();
    expect(stored?.parentNodeId).toBeUndefined();
  });

  it("should_delete_owned_material_children_when_cascading", async () => {
    const t = convexTest(schema, modules);
    const parent = await seedNode(t, { name: "Parent" });
    const child = await seedNode(t, {
      name: "Child",
      nodeType: "material",
      parentNodeId: parent,
      sortOrder: 0,
    });

    await t.mutation(api.cosplayNodes.remove, { id: parent, userId: "u1", cascade: true });

    const storedChild = await t.run(async (ctx) => ctx.db.get(child));
    const storedParent = await t.run(async (ctx) => ctx.db.get(parent));
    expect(storedParent).toBeNull();
    expect(storedChild).toBeNull();
  });

  it("should_keep_a_cascaded_child_that_is_a_build_root", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t);
    const parent = await seedNode(t, { name: "Parent" });
    // Child is also scoped to a build (build root); cascade must not delete it.
    const child = await seedNode(t, {
      name: "Child",
      nodeType: "material",
      parentNodeId: parent,
      buildId,
      sortOrder: 0,
    });

    await t.mutation(api.cosplayNodes.remove, { id: parent, userId: "u1", cascade: true });

    const storedChild = await t.run(async (ctx) => ctx.db.get(child));
    expect(storedChild).not.toBeNull();
    expect(storedChild?.parentNodeId).toBeUndefined();
    expect(storedChild?.buildId).toBe(buildId);
  });
});

describe("cosplayNodes.listBuildVisualNodes (Step 2c)", () => {
  it("should_build_the_outline_from_buildId_and_parentNodeId", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t, "u1");
    const root = await seedNode(t, { name: "Root", buildId, sortOrder: 0 });
    await seedNode(t, { name: "Child", buildId, parentNodeId: root, sortOrder: 0 });
    // A node in another build must not leak in.
    const otherBuild = await seedBuild(t, "u1");
    await seedNode(t, { name: "Elsewhere", buildId: otherBuild, sortOrder: 0 });

    const asOwner = t.withIdentity({ subject: "u1" });
    const outline = await asOwner.query(api.cosplayNodes.listBuildVisualNodes, { buildId });
    expect(outline.map((n) => n.name)).toEqual(["Root", "Child"]);
    const rootRow = outline.find((n) => n.name === "Root");
    const childRow = outline.find((n) => n.name === "Child");
    expect(rootRow?.isRoot).toBe(true);
    expect(rootRow?.depth).toBe(0);
    expect(childRow?.isRoot).toBe(false);
    expect(childRow?.depth).toBe(1);
  });
});

describe("build membership via node.buildId (Step 2c)", () => {
  it("should_attach_and_detach_build_roots_by_setting_and_clearing_buildId", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t);
    const node = await seedNode(t, { name: "N" });

    await t.mutation(api.builds.addNodesToBuild, {
      userId: "u1",
      buildId,
      cosplayNodeIds: [node],
    });
    let stored = await t.run(async (ctx) => ctx.db.get(node));
    expect(stored?.buildId).toBe(buildId);

    const asOwner = t.withIdentity({ subject: "u1" });
    const rootIds = await asOwner.query(api.builds.getNodes, { buildId });
    expect(rootIds).toEqual([node]);

    await t.mutation(api.builds.removeNodeFromBuild, {
      userId: "u1",
      buildId,
      cosplayNodeId: node,
    });
    stored = await t.run(async (ctx) => ctx.db.get(node));
    expect(stored?.buildId).toBeUndefined();
  });

  it("should_report_the_owning_build_from_getBuildsUsingNode", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t);
    const node = await seedNode(t, { name: "N", buildId, sortOrder: 0 });

    const builds = await t.query(api.builds.getBuildsUsingNode, { cosplayNodeId: node });
    expect(builds.map((b) => b._id)).toEqual([buildId]);
  });

  it("should_return_build_nodes_to_the_library_when_the_build_is_deleted", async () => {
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t);
    const node = await seedNode(t, { name: "N", buildId, sortOrder: 0 });

    await t.mutation(api.builds.remove, { id: buildId, userId: "u1" });

    const stored = await t.run(async (ctx) => ctx.db.get(node));
    expect(stored).not.toBeNull();
    expect(stored?.buildId).toBeUndefined();
  });
});
