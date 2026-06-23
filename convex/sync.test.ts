import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Backend spec tests for the local-first incremental pull (DATA_AND_SYNC.md §6, REQ-D63).
// Exclude the local Better Auth component dir from the module glob — these tests never invoke it,
// and its modules don't need to be registered.
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

async function seedBuild(
  t: ReturnType<typeof convexTest>,
  userId: string,
  name: string,
  extra: Record<string, unknown> = {}
) {
  return t.run(async (ctx) => ctx.db.insert("builds", { userId, name, status: "idea", ...extra }));
}

describe("sync.listChangedSince (REQ-D63)", () => {
  it("should_scope_results_to_the_authenticated_user", async () => {
    const t = convexTest(schema, modules);
    await seedBuild(t, "userA", "A build");
    await seedBuild(t, "userB", "B build");

    const result = await t
      .withIdentity({ subject: "userA" })
      .query(api.sync.listChangedSince, { since: 0 });

    expect(result.builds).toHaveLength(1);
    expect(result.builds[0].name).toBe("A build");
  });

  it("should_return_nothing_for_an_unauthenticated_caller", async () => {
    const t = convexTest(schema, modules);
    await seedBuild(t, "userA", "A build");

    const result = await t.query(api.sync.listChangedSince, { since: 0 });

    expect(result.builds).toHaveLength(0);
    expect(result.conventions).toHaveLength(0);
  });

  it("should_return_all_local_first_tables_not_just_builds_and_conventions", async () => {
    // ⛔ Expected-fail until listChangedSince warms every local-first table (planner, packing,
    // elements, build media). Today it only returns builds + conventions.
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("workflowItems", {
        userId: "userA",
        title: "Sew bodice",
        kind: "task",
        category: "construction",
        status: "not_started",
        ancestorIds: [],
        sortOrder: 0,
        scopeKind: "global",
        sourceKind: "manual",
      });
    });

    const result = (await t
      .withIdentity({ subject: "userA" })
      .query(api.sync.listChangedSince, { since: 0 })) as Record<string, unknown[]>;

    expect(result.workflowItems).toBeDefined();
    expect(result.workflowItems).toHaveLength(1);
  });

  it("should_advance_cursor_on_field_edits_not_only_creates", async () => {
    // ⛔ Expected-fail until the cursor tracks updatedAt deltas. Today the cursor is _creationTime,
    // so an edit (without a new row) is invisible to an incremental pull.
    const t = convexTest(schema, modules);
    const buildId = await seedBuild(t, "userA", "Original", { version: 1 });

    const first = await t
      .withIdentity({ subject: "userA" })
      .query(api.sync.listChangedSince, { since: 0 });
    const cursor = first.cursor;

    // Edit a field after the first pull (same _creationTime, bumped version).
    await t.run(async (ctx) => {
      await ctx.db.patch(buildId, { name: "Edited", version: 2 });
    });

    const delta = await t
      .withIdentity({ subject: "userA" })
      .query(api.sync.listChangedSince, { since: cursor });

    expect(delta.builds.map((b) => b.name)).toContain("Edited");
  });
});
