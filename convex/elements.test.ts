import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Backend spec tests for the canonical Element model (PRODUCT_SPEC.md §4.2, DATA_AND_SYNC.md §3.1,
// REQ-040/041/042/044). The Better Auth component dir is excluded from the module glob.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function makeBuild(t: ReturnType<typeof convexTest>, userId: string, name: string) {
  const build = await t.mutation(api.builds.create, { userId, name, status: "idea" });
  if (!build) throw new Error("build create failed");
  return build._id;
}

describe("elements ownership & build scoping (REQ-040)", () => {
  it("should_scope_listByBuild_to_the_owner", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    await t.mutation(api.elements.create, { userId: "u1", buildId: buildA, name: "Wig" });

    const mine = await t.query(api.elements.listByBuild, { buildId: buildA, userId: "u1" });
    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Wig");

    // A different user cannot read another user's build elements.
    const theirs = await t.query(api.elements.listByBuild, { buildId: buildA, userId: "u2" });
    expect(theirs).toHaveLength(0);
  });

  it("should_only_list_elements_belonging_to_the_requested_build", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const buildB = await makeBuild(t, "u1", "B");
    await t.mutation(api.elements.create, { userId: "u1", buildId: buildA, name: "In A" });
    await t.mutation(api.elements.create, { userId: "u1", buildId: buildB, name: "In B 1" });
    await t.mutation(api.elements.create, { userId: "u1", buildId: buildB, name: "In B 2" });

    const inA = await t.query(api.elements.listByBuild, { buildId: buildA, userId: "u1" });
    const inB = await t.query(api.elements.listByBuild, { buildId: buildB, userId: "u1" });
    expect(inA.map((e) => e.name)).toEqual(["In A"]);
    expect(inB.map((e) => e.name).sort()).toEqual(["In B 1", "In B 2"]);
  });

  it("should_reject_creating_an_element_in_another_users_build", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    await expect(
      t.mutation(api.elements.create, { userId: "u2", buildId: buildA, name: "Hijack" })
    ).rejects.toThrow(/not found or not authorized/i);
  });
});

describe("elements sub-element hierarchy (REQ-041)", () => {
  it("should_set_the_parent_on_a_sub_element_and_list_children", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const parent = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Wig",
    });
    const child = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Fiber",
      parentElementId: parent!._id,
    });
    expect(child!.parentElementId).toBe(parent!._id);

    const children = await t.query(api.elements.listChildren, {
      parentElementId: parent!._id,
      userId: "u1",
    });
    expect(children.map((c) => c.name)).toEqual(["Fiber"]);
  });
});

describe("elements duplicateToBuild independence (REQ-042)", () => {
  it("should_copy_into_target_build_with_new_identity_and_cleared_parent", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const buildB = await makeBuild(t, "u1", "B");
    const parent = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Wig",
    });
    const source = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Fiber",
      parentElementId: parent!._id,
      unitCostCents: 500,
    });

    const copy = await t.mutation(api.elements.duplicateToBuild, {
      userId: "u1",
      sourceElementId: source!._id,
      targetBuildId: buildB,
    });

    expect(copy!._id).not.toBe(source!._id);
    expect(copy!.buildId).toBe(buildB);
    expect(copy!.parentElementId).toBeUndefined();
    expect(copy!.name).toBe("Fiber");
    expect(copy!.unitCostCents).toBe(500);

    // Source is untouched and still in build A under its parent.
    const stillInA = await t.query(api.elements.get, { id: source!._id, userId: "u1" });
    expect(stillInA!.buildId).toBe(buildA);
    expect(stillInA!.parentElementId).toBe(parent!._id);
  });

  it("should_reject_duplicating_into_a_build_the_user_does_not_own", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const buildOther = await makeBuild(t, "u2", "Other");
    const source = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Wig",
    });
    await expect(
      t.mutation(api.elements.duplicateToBuild, {
        userId: "u1",
        sourceElementId: source!._id,
        targetBuildId: buildOther,
      })
    ).rejects.toThrow(/not found or not authorized/i);
  });
});

describe("elements cycle prevention (REQ-044)", () => {
  it("should_reject_reparenting_an_element_under_its_own_descendant", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const parent = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Wig",
    });
    const child = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Fiber",
      parentElementId: parent!._id,
    });

    await expect(
      t.mutation(api.elements.update, {
        id: parent!._id,
        userId: "u1",
        parentElementId: child!._id,
      })
    ).rejects.toThrow(/cycle/i);
  });

  it("should_reject_setting_an_element_as_its_own_parent", async () => {
    const t = convexTest(schema, modules);
    const buildA = await makeBuild(t, "u1", "A");
    const el = await t.mutation(api.elements.create, {
      userId: "u1",
      buildId: buildA,
      name: "Wig",
    });
    await expect(
      t.mutation(api.elements.update, {
        id: el!._id,
        userId: "u1",
        parentElementId: el!._id,
      })
    ).rejects.toThrow(/cycle/i);
  });
});
