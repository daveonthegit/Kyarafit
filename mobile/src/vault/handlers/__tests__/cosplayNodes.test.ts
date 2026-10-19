import { describe, expect, it } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";

type Doc = { _id: string } & Record<string, unknown>;

function seed() {
  const vault = makeTestVault();
  const createNode = (args: Record<string, unknown>) =>
    vault.mutate<Doc>("cosplayNodes:create", { nodeType: "element", tags: [], ...args });
  return { ...vault, createNode };
}

describe("local cosplayNodes handlers", () => {
  it.each([
    ["element", "purchaseStatus", "to_buy", "bought"],
    ["element", "buildStatus", "wip", "built"],
    ["material", "materialStatus", "to_buy", "bought"],
    ["material", "materialStatus", "in_use", "complete"],
  ])("completes generated work for %s %s", (nodeType, field, active, done) => {
    const v = seed();
    const node = v.createNode({ name: "Wig", nodeType, [field]: active });
    expect(v.store.reader().query("workflowItems").collect()).toHaveLength(1);
    v.mutate("cosplayNodes:update", { id: node._id, [field]: done });
    v.store.reloadFromDisk();
    expect(v.store.reader().query("workflowItems").collect()[0].status).toBe("done");
    expect(v.query<Doc>("cosplayNodes:get", { id: node._id }).progressPercent).toBe(100);
  });

  it.each(["cosplayNodes:remove", "cosplayNodes:removeMany"])("removes generated work for deleted descendants through %s", (command) => {
    const v = seed();
    const parent = v.createNode({ name: "Parent", purchaseStatus: "to_buy" });
    const child = v.createNode({ name: "Child", buildStatus: "wip" });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: parent._id, childNodeId: child._id });
    const manual = v.mutate<Doc>("workflow:create", { title: "Manual" });
    v.mutate(command, { id: parent._id, ids: [parent._id], cascade: true });
    v.store.reloadFromDisk();
    expect(v.store.reader().get(child._id)).toBeNull();
    expect(v.store.reader().query("workflowItems").collect().map((item) => item._id)).toEqual([manual._id]);
    expect(v.store.reader().query("workflowAttachments").collect()).toEqual([]);
  });

  it.each(["element", "material"])("reconciles generated work when converting %s", (nodeType) => {
    const v = seed();
    const node = v.createNode({ name: "Wig", nodeType, ...(nodeType === "element" ? { buildStatus: "wip" } : { materialStatus: "in_use" }) });
    expect(v.store.reader().query("workflowItems").collect()).toHaveLength(1);
    v.mutate("cosplayNodes:convertType", { id: node._id, nodeType: nodeType === "element" ? "material" : "element" });
    v.store.reloadFromDisk();
    expect(v.store.reader().query("workflowItems").collect()).toEqual([]);
    expect(v.store.reader().query("workflowAttachments").collect()).toEqual([]);
  });

  it("persists explicit field clears without clearing omitted fields", () => {
    const v = seed();
    const fields = {
      category: "Wigs",
      notes: "Draft",
      sourceUrl: "https://example.com",
      pricingMode: "per_unit",
      directCostCents: 100,
      unitCostCents: 20,
      quantity: 2,
      unit: "yards",
      purchaseStatus: "to_buy",
      buildStatus: "wip",
      materialStatus: "in_use",
      manualOverallBucket: "in_progress",
      buildInstructions: "Sew",
    };
    const node = v.createNode({ name: "Wig", ...fields });
    for (const key of Object.keys(fields))
      expect(v.store.reader().get(node._id)?.[key]).toBeDefined();
    v.mutate("cosplayNodes:update", { id: node._id, notes: null });
    expect(v.store.reader().get(node._id)?.category).toBe("Wigs");
    const clears = Object.fromEntries(Object.keys(fields).map((key) => [key, null]));
    v.mutate("cosplayNodes:update", { id: node._id, ...clears });
    v.store.reloadFromDisk();
    const persisted = v.store.reader().get(node._id)!;
    for (const key of Object.keys(fields)) expect(persisted[key]).toBeUndefined();
    expect(persisted.name).toBe("Wig");
  });
  it("creates elements with sanitized fields and a local photo reference", () => {
    const v = seed();
    const node = v.createNode({
      name: "  Wig  ",
      category: "Wigs",
      tags: [" blue ", ""],
      pricingMode: "per_unit",
      unitCostCents: 250,
      quantity: 4,
      purchaseStatus: "nope",
      imageUrl: "kyarafit-image:img_wig",
    });
    expect(node).toMatchObject({
      name: "Wig",
      category: "Wigs",
      tags: ["blue"],
      userId: v.subject,
      imageUrl: "kyarafit-image:img_wig",
      version: 1,
    });
    expect(node.purchaseStatus).toBeUndefined();
    expect(() => v.createNode({ nodeType: "prop", name: "x" })).toThrow(
      "Invalid cosplay node type"
    );
    const got = v.query<Doc>("cosplayNodes:get", { id: node._id });
    expect(got).toMatchObject({ totalCostCents: 1000, children: [], parents: [] });
  });

  it("lists with type/category/search/bucket filters and sorting", () => {
    const v = seed();
    v.createNode({ name: "Boots", category: "Shoes", directCostCents: 300 });
    v.createNode({ name: "Armor", category: "Body", purchaseStatus: "bought", tags: ["metal"] });
    v.createNode({ nodeType: "material", name: "Foam", materialStatus: "in_use" });

    expect(v.query<Doc[]>("cosplayNodes:list", {}).map((n) => n.name)).toEqual([
      "Armor",
      "Boots",
      "Foam",
    ]);
    expect(
      v.query<Doc[]>("cosplayNodes:list", { nodeType: "material" }).map((n) => n.name)
    ).toEqual(["Foam"]);
    expect(v.query<Doc[]>("cosplayNodes:list", { category: "Shoes" }).map((n) => n.name)).toEqual([
      "Boots",
    ]);
    expect(v.query<Doc[]>("cosplayNodes:list", { search: "meta" }).map((n) => n.name)).toEqual([
      "Armor",
    ]);
    expect(
      v.query<Doc[]>("cosplayNodes:list", { overallBucket: "in_progress" }).map((n) => n.name)
    ).toEqual(["Foam"]);
    expect(
      v.query<Doc[]>("cosplayNodes:list", { sortBy: "cost", order: "desc" }).map((n) => n.name)
    ).toEqual(["Boots", "Foam", "Armor"]); // cost ties fall back to name, reversed by desc
  });

  it("nests children, rejects disallowed links and cycles, reorders and unlinks", () => {
    const v = seed();
    const parent = v.createNode({ name: "Costume" });
    const a = v.createNode({ name: "Cape", purchaseStatus: "bought" });
    const b = v.createNode({ name: "Belt" });
    const mat = v.createNode({ nodeType: "material", name: "Leather" });

    v.mutate("cosplayNodes:addChildLink", { parentNodeId: parent._id, childNodeId: a._id });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: parent._id, childNodeId: b._id });
    expect(() =>
      v.mutate("cosplayNodes:addChildLink", { parentNodeId: mat._id, childNodeId: a._id })
    ).toThrow("That relationship is not allowed");
    expect(() =>
      v.mutate("cosplayNodes:addChildLink", { parentNodeId: a._id, childNodeId: parent._id })
    ).toThrow("That link would create a cycle");

    let got = v.query<Doc & { children: Doc[] }>("cosplayNodes:get", { id: parent._id });
    expect(got.children.map((c) => c.name)).toEqual(["Cape", "Belt"]);
    expect(got).toMatchObject({ childCount: 2, progressPercent: 50 });
    expect(v.query<Doc>("cosplayNodes:get", { id: a._id }).parents).toEqual([
      { _id: parent._id, name: "Costume", nodeType: "element", linkId: a._id },
    ]);

    v.mutate("cosplayNodes:reorderChildren", {
      parentNodeId: parent._id,
      orderedLinkIds: [b._id, a._id],
    });
    got = v.query("cosplayNodes:get", { id: parent._id });
    expect(got.children.map((c) => c.name)).toEqual(["Belt", "Cape"]);
    expect(
      v.query<Doc[]>("cosplayNodes:listChildren", { parentNodeId: parent._id }).map((c) => c.name)
    ).toEqual(["Belt", "Cape"]);

    v.mutate("cosplayNodes:removeChildLink", { id: b._id });
    got = v.query("cosplayNodes:get", { id: parent._id });
    expect(got.children.map((c) => c.name)).toEqual(["Cape"]);
    expect(v.query<Doc[]>("cosplayNodes:list", { rootsOnly: true }).map((n) => n.name)).toEqual([
      "Belt",
      "Costume",
      "Leather",
    ]);
  });

  it("convertType clears type-specific statuses and guards material children", () => {
    const v = seed();
    const node = v.createNode({ name: "Thing", purchaseStatus: "bought" });
    const asMaterial = v.mutate<Doc>("cosplayNodes:convertType", {
      id: node._id,
      nodeType: "material",
    });
    expect(asMaterial.nodeType).toBe("material");
    expect(asMaterial.purchaseStatus).toBeUndefined();
    const sub = v.createNode({ nodeType: "material", name: "Sub" });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: node._id, childNodeId: sub._id });
    expect(() =>
      v.mutate("cosplayNodes:convertType", { id: node._id, nodeType: "element" })
    ).toThrow("Elements cannot become parents of materials");
  });

  it("update patches fields and syncs auto-generated workflow tasks", () => {
    const v = seed();
    const node = v.createNode({ name: "Wig", category: "wig" });
    const updated = v.mutate<Doc>("cosplayNodes:update", {
      id: node._id,
      buildStatus: "wip",
      tags: ["a"],
      notes: "",
      imageUrl: "kyarafit-image:img_2",
    });
    expect(updated).toMatchObject({ buildStatus: "wip", tags: ["a"], version: 2 });
    const titles = v.store
      .reader()
      .query("workflowItems")
      .collect()
      .map((i) => i.title);
    expect(titles).toContain("Style Wig");
    expect(() => v.mutate("cosplayNodes:update", { id: "missing", name: "x" })).toThrow(
      "Not found or not authorized"
    );
  });

  it("remove detaches references; cascade deletes non-root descendants", () => {
    const v = seed();
    const parent = v.createNode({ name: "Parent" });
    const child = v.createNode({ name: "Child" });
    const grandchild = v.createNode({ name: "Grandchild" });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: parent._id, childNodeId: child._id });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: child._id, childNodeId: grandchild._id });
    const packing = v.store.commit((db) =>
      db.insert("packingListItems", {
        userId: v.subject,
        conventionId: "c",
        label: "Parent",
        checked: false,
        cosplayNodeId: parent._id,
      })
    );

    v.mutate("cosplayNodes:remove", { id: parent._id, cascade: true });
    const reader = v.store.reader();
    expect(reader.get(parent._id)).toBeNull();
    expect(reader.get(child._id)).toBeNull();
    expect(reader.get(grandchild._id)).toBeNull();
    expect(reader.get(packing)?.cosplayNodeId).toBeUndefined();

    const p2 = v.createNode({ name: "P2" });
    const c2 = v.createNode({ name: "C2" });
    v.mutate("cosplayNodes:addChildLink", { parentNodeId: p2._id, childNodeId: c2._id });
    v.mutate("cosplayNodes:removeMany", { ids: [p2._id, "missing"] });
    expect(reader.get(p2._id)).toBeNull();
    expect(v.store.reader().get(c2._id)?.parentNodeId).toBeUndefined();
  });
});
