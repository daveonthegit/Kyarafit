import { describe, expect, it } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import type { VaultDoc } from "@/vault/store";

// The harness clock starts at 1_700_000_000_000 ms = 2023-11-14 UTC.

type Vault = ReturnType<typeof makeTestVault>;

function createConvention(vault: Vault, overrides: Record<string, unknown> = {}): VaultDoc {
  return vault.mutate<VaultDoc>("conventions:create", {
    name: "Anime Expo",
    location: "LA",
    startDate: "2024-07-04",
    endDate: "2024-07-07",
    ...overrides,
  });
}

function seedBuildWithRoots(vault: Vault, rootNames: string[]): string {
  return vault.store.commit((db) => {
    const buildId = db.insert("builds", { userId: vault.subject, name: "Link", status: "wip" });
    rootNames.forEach((name, i) => {
      const rootId = db.insert("cosplayNodes", {
        userId: vault.subject,
        buildId,
        nodeType: "item",
        name,
        tags: [],
        sortOrder: rootNames.length - i,
      });
      // A nested child is not a root and must not be packed separately.
      db.insert("cosplayNodes", {
        userId: vault.subject,
        buildId,
        parentNodeId: rootId,
        nodeType: "item",
        name: `${name} strap`,
        tags: [],
      });
    });
    return buildId;
  });
}

describe("conventions CRUD", () => {
  it("creates, updates, lists and archives conventions", () => {
    const vault = makeTestVault();
    const expo = createConvention(vault, {
      name: "  Anime Expo ",
      imageUrl: "kyarafit-image:img_x",
    });
    expect(expo).toMatchObject({
      name: "Anime Expo",
      location: "LA",
      userId: vault.subject,
      imageUrl: "kyarafit-image:img_x",
      version: 1,
    });

    expect(() => createConvention(vault, { startDate: "July 4" })).toThrow(
      "Start date must be in YYYY-MM-DD format"
    );

    vault.tick();
    const updated = vault.mutate<VaultDoc>("conventions:update", {
      id: expo._id,
      location: "Los Angeles",
      imageUrl: null,
      idempotencyKey: "ignored",
    });
    expect(updated.location).toBe("Los Angeles");
    expect("imageUrl" in updated).toBe(false);
    expect(updated.version).toBe(2);

    expect(vault.query<VaultDoc>("conventions:get", { id: expo._id })._id).toBe(expo._id);
    expect(vault.query("conventions:get", { id: "local:missing" })).toBeNull();

    const other = createConvention(vault, { name: "Katsucon" });
    vault.mutate("conventions:archiveMany", { ids: [other._id, "local:missing"], archived: true });
    const list = vault.query<VaultDoc[]>("conventions:list");
    expect(list.map((c) => [c.name, c.archived ?? false])).toEqual([
      ["Anime Expo", false],
      ["Katsucon", true],
    ]);

    expect(() => vault.mutate("conventions:update", { id: "local:missing", name: "x" })).toThrow(
      "Not found or not authorized"
    );
  });

  it("replaces the day plan and derives build events and outfit counts", () => {
    const vault = makeTestVault();
    const buildId = seedBuildWithRoots(vault, []);
    const later = createConvention(vault, {
      name: "Later",
      startDate: "2024-09-01",
      endDate: "2024-09-02",
    });
    const sooner = createConvention(vault, {
      name: "Sooner",
      startDate: "2024-03-01",
      endDate: "2024-03-02",
    });
    createConvention(vault, { name: "Past", startDate: "2020-01-01", endDate: "2020-01-02" });

    vault.mutate("conventions:replacePlan", {
      conventionId: later._id,
      plan: [{ date: "2024-09-01", buildId }],
    });
    const plan = vault.mutate<VaultDoc[]>("conventions:replacePlan", {
      conventionId: sooner._id,
      plan: [
        { date: "2024-03-01", buildId, notes: " day one " },
        { date: "2024-03-02", buildId },
        { date: "2024-03-02" },
      ],
    });
    expect(plan.map((p) => p.notes)).toEqual(["day one", undefined, undefined]);
    expect(
      vault.query<VaultDoc[]>("conventions:getPlan", { conventionId: sooner._id })
    ).toHaveLength(3);

    // Replacing again drops the previous rows.
    vault.mutate("conventions:replacePlan", {
      conventionId: sooner._id,
      plan: [{ date: "2024-03-01", buildId }],
    });
    expect(
      vault.query<VaultDoc[]>("conventions:getPlan", { conventionId: sooner._id })
    ).toHaveLength(1);

    expect(vault.query("conventions:getEventForBuild", { buildId })).toEqual({
      name: "Sooner",
      startDate: "2024-03-01",
    });

    const upcoming = vault.query<{ convention: VaultDoc; outfitCount: number }[]>(
      "conventions:listUpcomingWithPlanCounts",
      {}
    );
    expect(upcoming.map((u) => [u.convention.name, u.outfitCount])).toEqual([
      ["Sooner", 1],
      ["Later", 1],
    ]);
    expect(
      vault.query<unknown[]>("conventions:listUpcomingWithPlanCounts", { limit: 1 })
    ).toHaveLength(1);
  });
});

describe("packing", () => {
  it("regenerates build packing from the day plan and keeps manual items", () => {
    const vault = makeTestVault();
    const buildId = seedBuildWithRoots(vault, ["Wig", "Sword"]);
    const con = createConvention(vault);
    vault.mutate("conventions:replacePlan", {
      conventionId: con._id,
      plan: [
        { date: "2024-07-04", buildId },
        { date: "2024-07-05", buildId },
      ],
    });
    const manual = vault.mutate<VaultDoc>("conventions:addManualPackingItem", {
      conventionId: con._id,
      label: "Phone charger",
    });
    expect(manual).toMatchObject({ entryKind: "manual", sourceKind: "manual", checked: false });
    expect(typeof manual.workflowItemId).toBe("string");

    const generated = vault.mutate<VaultDoc[]>("conventions:regeneratePacking", {
      conventionId: con._id,
    });
    // Root nodes only, ordered by sortOrder (Sword=1 before Wig=2), deduped across plan days.
    expect(generated.map((item) => [item.label, item.date, item.sortOrder])).toEqual([
      ["Sword", "2024-07-04", 0],
      ["Wig", "2024-07-04", 1],
    ]);
    for (const item of generated) {
      expect(item.entryKind).toBe("generated");
      const task = vault.store.reader().get(String(item.workflowItemId));
      expect(task?.title).toBe(`Pack ${item.label}`);
    }

    // Regenerating replaces generated rows (and their tasks) but keeps the manual one.
    const firstTaskId = String(generated[0].workflowItemId);
    vault.mutate("conventions:regeneratePacking", { conventionId: con._id });
    const packing = vault.query<VaultDoc[]>("conventions:getPacking", { conventionId: con._id });
    expect(packing.map((p) => p.label).sort()).toEqual(["Phone charger", "Sword", "Wig"]);
    expect(vault.store.reader().get(firstTaskId)).toBeNull();
  });

  it("checks items through their packing task and deletes them with it", () => {
    const vault = makeTestVault();
    const con = createConvention(vault);
    const item = vault.mutate<VaultDoc>("conventions:addManualPackingItem", {
      conventionId: con._id,
      label: "Badge",
      date: "2024-07-04",
    });

    const checked = vault.mutate<VaultDoc>("conventions:updatePackingItem", {
      id: item._id,
      checked: true,
      notes: "lanyard too",
    });
    expect(checked.checked).toBe(true);
    expect(checked.notes).toBe("lanyard too");
    const taskId = String(checked.workflowItemId);
    expect(vault.store.reader().get(taskId)?.status).toBe("done");
    expect(
      vault.query<VaultDoc[]>("conventions:getPacking", { conventionId: con._id })[0].checked
    ).toBe(true);

    vault.mutate("conventions:updatePackingItem", { id: item._id, checked: false });
    expect(vault.store.reader().get(taskId)?.status).toBe("not_started");

    vault.mutate("conventions:deletePackingItem", { id: item._id });
    expect(vault.query("conventions:getPacking", { conventionId: con._id })).toEqual([]);
    expect(vault.store.reader().get(taskId)).toBeNull();
  });

  it("removing a convention cascades to its plans, packing items and packing tasks", () => {
    const vault = makeTestVault();
    const buildId = seedBuildWithRoots(vault, ["Wig"]);
    const con = createConvention(vault);
    const keep = createConvention(vault, { name: "Keep" });
    vault.mutate("conventions:replacePlan", {
      conventionId: con._id,
      plan: [{ date: "2024-07-04", buildId }],
    });
    vault.mutate("conventions:addManualPackingItem", { conventionId: con._id, label: "Snacks" });
    vault.mutate("conventions:regeneratePacking", { conventionId: con._id });

    vault.mutate("conventions:remove", { id: con._id });

    const reader = vault.store.reader();
    expect(
      reader
        .query("conventions")
        .collect()
        .map((c) => c._id)
    ).toEqual([keep._id]);
    expect(reader.query("conventionDayPlans").collect()).toEqual([]);
    expect(reader.query("packingListItems").collect()).toEqual([]);
    expect(
      reader
        .query("workflowItems")
        .collect()
        .filter((w) => w.category === "pack")
    ).toEqual([]);
    // Build content itself is untouched.
    expect(reader.get(buildId)?.name).toBe("Link");

    vault.mutate("conventions:removeMany", { ids: [keep._id, "local:missing"] });
    expect(vault.query("conventions:list")).toEqual([]);
  });

  it("listWithDetails embeds plans and packing state", () => {
    const vault = makeTestVault();
    const con = createConvention(vault);
    vault.mutate("conventions:replacePlan", {
      conventionId: con._id,
      plan: [{ date: "2024-07-04" }],
    });
    vault.mutate("conventions:addManualPackingItem", { conventionId: con._id, label: "Water" });
    const details = vault.query<(VaultDoc & { plans: VaultDoc[]; packing: VaultDoc[] })[]>(
      "conventions:listWithDetails"
    );
    expect(details).toHaveLength(1);
    expect(details[0].plans).toHaveLength(1);
    expect(details[0].packing.map((p) => [p.label, p.checked])).toEqual([["Water", false]]);
  });
});
