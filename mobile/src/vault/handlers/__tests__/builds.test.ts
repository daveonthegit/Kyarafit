import { describe, expect, it } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";

type Doc = { _id: string } & Record<string, unknown>;

function seed() {
  const vault = makeTestVault();
  const createBuild = (args: Record<string, unknown>) =>
    vault.mutate<Doc>("builds:create", { status: "idea", ...args });
  const createNode = (args: Record<string, unknown>) =>
    vault.mutate<Doc>("cosplayNodes:create", { nodeType: "element", tags: [], ...args });
  return { ...vault, createBuild, createNode };
}

describe("local builds handlers", () => {
  it.each(["builds:remove", "builds:removeMany"])(
    "%s removes workflow subtrees and all their relationships",
    (command) => {
      const v = seed();
      const build = v.createBuild({ name: "Delete" });
      const other = v.createBuild({ name: "Keep" });
      const group = v.mutate<Doc>("workflow:create", {
        title: "Group",
        kind: "group",
        scopeKind: "build_specific",
        attachments: [{ entityType: "build", entityId: build._id, role: "primary" }],
      });
      const child = v.mutate<Doc>("workflow:create", {
        title: "Child",
        parentId: group._id,
        attachments: [{ entityType: "build", entityId: other._id, role: "context" }],
      });
      const retained = v.mutate<Doc>("workflow:create", { title: "Retain" });
      v.mutate("workflow:setDependencies", {
        workflowItemId: retained._id,
        dependencies: [{ predecessorWorkflowItemId: child._id, relationKind: "prerequisite" }],
      });
      v.mutate(command, command === "builds:remove" ? { id: build._id } : { ids: [build._id] });
      const reader = v.store.reader();
      expect(reader.get(group._id)).toBeNull();
      expect(reader.get(child._id)).toBeNull();
      expect(reader.get(retained._id)).not.toBeNull();
      expect(reader.query("workflowAttachments").collect()).toEqual([]);
      expect(reader.query("workflowDependencies").collect()).toEqual([]);
    }
  );
  it("creates builds with server-equivalent defaults and validation", () => {
    const v = seed();
    const build = v.createBuild({
      name: "  Zelda  ",
      status: "bogus",
      visibility: "nope",
      imageUrl: "kyarafit-image:img_1",
    });
    expect(build).toMatchObject({
      name: "Zelda",
      status: "idea",
      visibility: "private",
      userId: v.subject,
      imageUrl: "kyarafit-image:img_1",
      version: 1,
    });
    expect(() => v.createBuild({ name: "x", targetDate: "not-a-date" })).toThrow();
  });

  it("lists with status filter, search and sorting", () => {
    const v = seed();
    v.createBuild({ name: "Bravo", character: "Link", status: "wip", budgetCents: 500 });
    v.createBuild({ name: "Alpha", status: "idea", budgetCents: 100 });
    v.createBuild({ name: "Charlie", character: "Zelda", status: "wip" });

    const byName = v.query<Doc[]>("builds:list", {});
    expect(byName.map((b) => b.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(byName[0]).toHaveProperty("tasksTotal", 0);
    expect(byName[0]).not.toHaveProperty("progress");

    expect(v.query<Doc[]>("builds:list", { status: "wip" }).map((b) => b.name)).toEqual([
      "Bravo",
      "Charlie",
    ]);
    expect(v.query<Doc[]>("builds:list", { search: "zel" }).map((b) => b.name)).toEqual([
      "Charlie",
    ]);
    expect(
      v.query<Doc[]>("builds:list", { sortBy: "budget", order: "desc" }).map((b) => b.name)
    ).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  it("links elements as roots, reorders and unlinks them", () => {
    const v = seed();
    const build = v.createBuild({ name: "B" });
    const a = v.createNode({ name: "A" });
    const b = v.createNode({ name: "B" });
    const c = v.createNode({ name: "C" });

    v.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [a._id, b._id] });
    expect(v.query("builds:getNodes", { buildId: build._id })).toEqual([a._id, b._id]);

    v.mutate("builds:linkNodes", { buildId: build._id, cosplayNodeIds: [c._id, a._id] });
    expect(v.query("builds:getNodes", { buildId: build._id })).toEqual([c._id, a._id]);
    expect(v.store.reader().get(b._id)?.buildId).toBeUndefined();

    v.mutate("builds:reorderRootLinks", {
      buildId: build._id,
      orderedCosplayNodeIds: [a._id, c._id],
    });
    expect(v.query("builds:getNodes", { buildId: build._id })).toEqual([a._id, c._id]);
    expect(() =>
      v.mutate("builds:reorderRootLinks", { buildId: build._id, orderedCosplayNodeIds: [a._id] })
    ).toThrow("Ordered nodes must match existing root links");

    v.mutate("builds:removeNodeFromBuild", { buildId: build._id, cosplayNodeId: a._id });
    v.mutate("builds:removeNodesFromBuild", { buildId: build._id, cosplayNodeIds: [c._id] });
    expect(v.query("builds:getNodes", { buildId: build._id })).toEqual([]);

    v.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [b._id] });
    expect(v.query<Doc[]>("builds:getBuildsUsingNode", { cosplayNodeId: b._id })).toEqual([
      expect.objectContaining({ _id: build._id, name: "B" }),
    ]);
  });

  it("derives progress, cost and summary from elements and tasks", () => {
    const v = seed();
    const build = v.createBuild({ name: "Armor", budgetCents: 10_000, targetDate: "2099-01-01" });
    const done = v.createNode({ name: "Helmet", purchaseStatus: "bought", directCostCents: 2500 });
    const todo = v.createNode({ name: "Boots", directCostCents: 1500 });
    v.mutate("builds:addNodesToBuild", {
      buildId: build._id,
      cosplayNodeIds: [done._id, todo._id],
    });
    const attach = [
      { entityType: "build", entityId: build._id, role: "primary", buildContextId: build._id },
    ];
    v.mutate("workflow:create", { title: "Sand", status: "done", attachments: attach });
    v.mutate("workflow:create", { title: "Paint", status: "not_started", attachments: attach });

    const got = v.query<Doc>("builds:get", { id: build._id });
    expect(got).toMatchObject({ tasksTotal: 2, tasksChecked: 1, workflowProgressPercent: 50 });
    expect(typeof got.progress).toBe("number");

    const summary = v.query<Doc>("builds:getSummary", { buildId: build._id });
    expect(summary).toMatchObject({
      tasksTotal: 2,
      tasksChecked: 1,
      linkedItemCount: 2,
      linkedItemsCompleteCount: 1,
      totalCostCents: 4000,
      budgetCents: 10_000,
      budgetDifferenceCents: 6000,
      targetDate: "2099-01-01",
    });
    expect(v.query("builds:getSummary", { buildId: "missing" })).toBeNull();
    expect(v.query("builds:get", { id: "missing" })).toBeNull();
  });

  it("focused build falls back to the most recent build", () => {
    const v = seed();
    expect(v.query("builds:getFocusedOrMostRecentForUser")).toBeNull();
    const first = v.createBuild({ name: "First" });
    v.tick();
    v.createBuild({ name: "Second" });
    expect(v.query<Doc>("builds:getFocusedOrMostRecentForUser").name).toBe("Second");
    v.mutate("users:setFocusedBuild", { buildId: first._id });
    expect(v.query<Doc>("builds:getFocusedOrMostRecentForUser")).toMatchObject({
      name: "First",
      tasksTotal: 0,
    });
  });

  it("updates fields, clamps focal points and bulk-updates status", () => {
    const v = seed();
    const a = v.createBuild({ name: "A" });
    const b = v.createBuild({ name: "B" });
    const updated = v.mutate<Doc>("builds:update", {
      id: a._id,
      name: "A2",
      imageFocalX: 3,
      imageUrl: null,
      status: "bad",
      visibility: "public",
    });
    expect(updated).toMatchObject({ name: "A2", imageFocalX: 1, status: "idea", version: 2 });
    expect(updated.visibility).toBe("public");
    v.mutate("builds:updateStatusMany", { ids: [a._id, b._id], status: "ready" });
    expect(v.query<Doc[]>("builds:list", { status: "ready" })).toHaveLength(2);
    expect(() => v.mutate("builds:updateStatusMany", { ids: [a._id], status: "x" })).toThrow(
      "Invalid status"
    );
    expect(() => v.mutate("builds:update", { id: "missing", name: "x" })).toThrow(
      "Build not found"
    );
  });

  it("duplicates a build with nested elements, galleries and primary tasks", () => {
    const v = seed();
    const src = v.createBuild({ name: "Src", status: "wip" });
    const parent = v.createNode({ name: "Parent" });
    const child = v.createNode({ name: "Child" });
    v.mutate("builds:addNodesToBuild", { buildId: src._id, cosplayNodeIds: [parent._id] });
    v.mutate("cosplayNodes:update", { id: child._id, name: "Child" });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: parent._id, childNodeId: child._id });
    v.store.commit((db) =>
      db.insert("buildReferenceImages", {
        userId: v.subject,
        buildId: src._id,
        imageUrl: "kyarafit-image:img_ref",
        sortOrder: 0,
      })
    );
    v.mutate("workflow:create", {
      title: "Glue",
      status: "done",
      attachments: [
        { entityType: "build", entityId: src._id, role: "primary", buildContextId: src._id },
        {
          entityType: "cosplayNode",
          entityId: parent._id,
          role: "progress_source",
          buildContextId: src._id,
        },
      ],
    });

    const copyId = v.mutate<string>("builds:duplicate", { sourceBuildId: src._id });
    const copy = v.query<Doc>("builds:get", { id: copyId });
    expect(copy).toMatchObject({
      name: "Src (copy)",
      status: "idea",
      visibility: "private",
      tasksTotal: 1,
      tasksChecked: 0,
    });
    const visual = v.query<Doc[]>("cosplayNodes:listBuildVisualNodes", { buildId: copyId });
    expect(visual.map((n) => [n.name, n.depth])).toEqual([
      ["Parent", 0],
      ["Child", 1],
    ]);
    expect(visual.every((n) => n._id !== parent._id && n._id !== child._id)).toBe(true);
    const refs = v.store
      .reader()
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", copyId))
      .collect();
    expect(refs.map((r) => r.imageUrl)).toEqual(["kyarafit-image:img_ref"]);
  });

  it("remove cascades build-scoped data and returns elements to the library", () => {
    const v = seed();
    const build = v.createBuild({ name: "Gone" });
    const node = v.createNode({ name: "Keep me" });
    v.mutate("builds:addNodesToBuild", { buildId: build._id, cosplayNodeIds: [node._id] });
    v.store.commit((db) => {
      db.insert("buildProcessPictures", { userId: v.subject, buildId: build._id, sortOrder: 0 });
      db.insert("buildTasks", {
        userId: v.subject,
        buildId: build._id,
        label: "t",
        sortOrder: 0,
        checked: false,
      });
    });
    v.mutate("workflow:create", {
      title: "Scoped",
      scopeKind: "build_specific",
      attachments: [{ entityType: "build", entityId: build._id, role: "primary" }],
    });

    v.mutate("builds:remove", { id: build._id });

    const reader = v.store.reader();
    expect(reader.get(build._id)).toBeNull();
    expect(reader.get(node._id)?.buildId).toBeUndefined();
    expect(reader.query("buildProcessPictures").collect()).toEqual([]);
    expect(reader.query("buildTasks").collect()).toEqual([]);
    expect(reader.query("workflowAttachments").collect()).toEqual([]);
    expect(reader.query("workflowItems").collect()).toEqual([]);
    expect(() => v.mutate("builds:remove", { id: build._id })).toThrow();

    const a = v.createBuild({ name: "a" });
    const b = v.createBuild({ name: "b" });
    v.mutate("builds:removeMany", { ids: [a._id, b._id, "missing"] });
    expect(v.query<Doc[]>("builds:list", {})).toEqual([]);
  });
});
