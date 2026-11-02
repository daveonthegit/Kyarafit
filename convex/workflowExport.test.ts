import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("workflow export", () => {
  it("returns complete owned rows and relationships without exposing another account", async () => {
    const t = convexTest(schema, modules);
    const expected = await t.run(async (ctx) => {
      const fields = {
        category: "craft",
        status: "not_started",
        ancestorIds: [],
        sortOrder: 0,
        scopeKind: "shared",
        sourceKind: "manual",
      };
      const group = await ctx.db.insert("workflowItems", {
        ...fields,
        userId: "alice",
        title: "Travel",
        kind: "group",
      });
      const task = await ctx.db.insert("workflowItems", {
        ...fields,
        userId: "alice",
        title: "Book hotel",
        kind: "task",
        parentId: group,
        notes: "Near the venue",
        reminders: [{ kind: "date", date: "2026-11-01" }],
        estimatedMinutes: 30,
        priority: 2,
      });
      const other = await ctx.db.insert("workflowItems", {
        ...fields,
        userId: "bob",
        title: "Private",
        kind: "task",
        notes: "Secret",
      });
      const attachment = await ctx.db.insert("workflowAttachments", {
        userId: "alice",
        workflowItemId: task,
        entityType: "resource",
        entityId: "hotel",
        entityKey: "resource:hotel",
        role: "primary",
        progressWeight: 2,
      });
      const dependency = await ctx.db.insert("workflowDependencies", {
        userId: "alice",
        predecessorWorkflowItemId: group,
        successorWorkflowItemId: task,
        relationKind: "finish_to_start",
      });
      await ctx.db.insert("workflowAttachments", {
        userId: "bob",
        workflowItemId: other,
        entityType: "resource",
        entityId: "private",
        entityKey: "resource:private",
        role: "primary",
      });
      return {
        workflowItems: [await ctx.db.get(group), await ctx.db.get(task)],
        workflowAttachments: [await ctx.db.get(attachment)],
        workflowDependencies: [await ctx.db.get(dependency)],
      };
    });
    for (const collection of [
      "workflowItems",
      "workflowAttachments",
      "workflowDependencies",
    ] as const) {
      expect(
        await t
          .withIdentity({ subject: "alice" })
          .query(api.accountExport.listCollection, { collection })
      ).toEqual(expected[collection]);
      expect(
        await t
          .withIdentity({ subject: "empty" })
          .query(api.accountExport.listCollection, { collection })
      ).toEqual([]);
      await expect(t.query(api.accountExport.listCollection, { collection })).rejects.toThrow(
        "Unauthorized"
      );
    }
  });
});
