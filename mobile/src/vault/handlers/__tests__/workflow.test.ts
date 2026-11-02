import { describe, expect, it } from "vitest";
import { makeTestVault, TEST_SUBJECT } from "@/test-support/vaultHarness";
import {
  ensurePackingWorkflowItem,
  getBuildScopedWorkflow,
  removeWorkflowItemCascade,
  syncGeneratedWorkflowForNode,
} from "../workflow";

type Doc = { _id: string } & Record<string, unknown>;
type TreeNode = Doc & { children: TreeNode[]; progressPercent: number; isBlocked: boolean };

/** A build with one root element (and a nested child element), inserted directly. */
function seedBuild(vault: ReturnType<typeof makeTestVault>) {
  return vault.store.commit((db) => {
    const buildId = db.insert("builds", { userId: TEST_SUBJECT, name: "Zelda", status: "wip" });
    const rootNode = db.insert("cosplayNodes", {
      userId: TEST_SUBJECT,
      buildId,
      nodeType: "piece",
      name: "Wig",
      tags: [],
      sortOrder: 0,
    });
    const childNode = db.insert("cosplayNodes", {
      userId: TEST_SUBJECT,
      buildId,
      parentNodeId: rootNode,
      nodeType: "piece",
      name: "Clip",
      tags: [],
      sortOrder: 0,
    });
    return { buildId, rootNode, childNode };
  });
}

function buildTask(
  vault: ReturnType<typeof makeTestVault>,
  buildId: string,
  title: string,
  extra = {}
) {
  return vault.mutate<Doc>("workflow:create", {
    userId: "ignored",
    title,
    kind: "task",
    category: "craft",
    scopeKind: "build_specific",
    attachments: [{ entityType: "build", entityId: buildId, role: "primary" }],
    ...extra,
  });
}

describe("local workflow handlers", () => {
  it("persists explicit clears and retains omitted workflow fields", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const fields = {
      notes: "Draft",
      startDate: "2027-01-01",
      targetDate: "2027-02-01",
      dueDate: "2027-03-01",
      reminders: [{ kind: "notification", date: "2027-01-02" }],
      recurrenceRule: "weekly",
    };
    const task = buildTask(vault, buildId, "Sew", fields);
    vault.mutate("workflow:update", { id: task._id, notes: null });
    expect(vault.store.reader().get(task._id)?.dueDate).toBe(fields.dueDate);
    vault.mutate("workflow:update", {
      id: task._id,
      ...Object.fromEntries(Object.keys(fields).map((key) => [key, null])),
    });
    vault.store.reloadFromDisk();
    const persisted = vault.store.reader().get(task._id)!;
    for (const key of Object.keys(fields)) expect(persisted[key]).toBeUndefined();
    expect(persisted.title).toBe("Sew");
  });
  it("creates tasks with sanitized fields, sync meta and sibling sort order", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const first = buildTask(vault, buildId, "  Cut foam  ");
    const second = buildTask(vault, buildId, "Prime");

    expect(first).toMatchObject({
      title: "Cut foam",
      kind: "task",
      status: "not_started",
      userId: TEST_SUBJECT,
      creatorUserId: TEST_SUBJECT,
      ancestorIds: [],
      sortOrder: 0,
      version: 1,
    });
    expect(second.sortOrder).toBe(1);
    const attachments = vault.store.reader().query("workflowAttachments").collect();
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({ entityKey: `build:${buildId}`, role: "primary" });

    expect(() => buildTask(vault, buildId, "x", { dueDate: "not-a-date" })).toThrow();
    expect(() =>
      vault.mutate("workflow:create", {
        title: "bad",
        attachments: [{ entityType: "spaceship", entityId: "1" }],
      })
    ).toThrow("Unsupported workflow attachment type");
  });

  it("projects the build tree with nested children and stats", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const group = buildTask(vault, buildId, "Armor", { kind: "group" });
    const child = vault.mutate<Doc>("workflow:create", {
      title: "Sand",
      kind: "task",
      parentId: group._id,
    });
    expect(child.ancestorIds).toEqual([group._id]);
    const done = buildTask(vault, buildId, "Buy wig");
    vault.mutate("workflow:update", { id: done._id, status: "done" });

    const tree = vault.query<{
      buildId: string;
      items: TreeNode[];
      stats: { tasksTotal: number; tasksDone: number; workflowProgressPercent: number };
    }>("workflow:listBuildTree", { buildId });
    expect(tree.buildId).toBe(buildId);
    expect(tree.items.map((i) => i.title).sort()).toEqual(["Armor", "Buy wig"]);
    const armor = tree.items.find((i) => i.title === "Armor")!;
    expect(armor.children.map((c) => c.title)).toEqual(["Sand"]);
    expect(tree.stats).toEqual({ tasksTotal: 2, tasksDone: 1, workflowProgressPercent: 50 });

    expect(vault.query("workflow:listBuildTree", { buildId: "missing" })).toBeNull();
    expect(getBuildScopedWorkflow({ db: vault.store.reader() }, buildId)?.items).toHaveLength(3);
  });

  it("includes tasks attached to the build's root elements, scoped to that build", () => {
    const vault = makeTestVault();
    const { buildId, rootNode } = seedBuild(vault);
    vault.mutate("workflow:create", {
      title: "Style wig",
      category: "style",
      scopeKind: "build_specific",
      attachments: [{ entityType: "cosplayNode", entityId: rootNode, buildContextId: buildId }],
    });
    vault.mutate("workflow:create", {
      title: "Shared wig care",
      scopeKind: "shared",
      attachments: [{ entityType: "cosplayNode", entityId: rootNode }],
    });

    vault.mutate("workflow:create", {
      title: "Other build's wig task",
      attachments: [
        { entityType: "cosplayNode", entityId: rootNode, buildContextId: "local:other-build" },
      ],
    });

    // Server semantics: context-free (shared) attachments on a root element are part of the
    // build's tree; attachments pinned to another build are not.
    const tree = vault.query<{ items: TreeNode[] }>("workflow:listBuildTree", { buildId });
    expect(tree.items.map((i) => i.title).sort()).toEqual(["Shared wig care", "Style wig"]);

    const nodeWorkflow = vault.query<{ shared: TreeNode[]; buildSpecific: TreeNode[] }>(
      "workflow:listNodeWorkflow",
      { cosplayNodeId: rootNode, buildId }
    );
    expect(nodeWorkflow.shared.map((i) => i.title)).toEqual(["Shared wig care"]);
    expect(nodeWorkflow.buildSpecific.map((i) => i.title)).toEqual(["Style wig"]);
    expect(
      vault.query<{ buildSpecific: unknown[] }>("workflow:listNodeWorkflow", {
        cosplayNodeId: rootNode,
      }).buildSpecific
    ).toEqual([]);
  });

  it("moves under a new parent, rewrites descendant ancestors and rejects cycles", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const a = buildTask(vault, buildId, "A", { kind: "group" });
    const b = vault.mutate<Doc>("workflow:create", { title: "B", parentId: a._id });
    const c = vault.mutate<Doc>("workflow:create", { title: "C", parentId: b._id });
    const target = buildTask(vault, buildId, "T", { kind: "group" });

    vault.mutate("workflow:move", { id: b._id, parentId: target._id, sortOrder: 4 });
    const reader = vault.store.reader();
    expect(reader.get(b._id)).toMatchObject({
      parentId: target._id,
      ancestorIds: [target._id],
      sortOrder: 4,
      version: 2,
    });
    expect(reader.get(c._id)?.ancestorIds).toEqual([target._id, b._id]);

    expect(() => vault.mutate("workflow:move", { id: target._id, parentId: target._id })).toThrow(
      "cannot parent themselves"
    );
    expect(() => vault.mutate("workflow:move", { id: target._id, parentId: c._id })).toThrow(
      "cannot move under a descendant"
    );
    expect(() =>
      vault.mutate("workflow:moveAndResequence", {
        move: { id: target._id, parentId: c._id },
        resequence: [],
      })
    ).toThrow("cannot move under a descendant");
    vault.mutate("workflow:moveAndResequence", {
      move: { id: c._id, parentId: target._id },
      resequence: [],
    });
    expect(reader.get(c._id)?.ancestorIds).toEqual([target._id]);

    vault.mutate("workflow:move", { id: b._id, parentId: null });
    expect(vault.store.reader().get(b._id)?.parentId).toBeUndefined();
    expect(vault.store.reader().get(c._id)?.ancestorIds).toEqual([target._id]);
  });

  it("moveAndResequence moves one row and renumbers siblings atomically", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const x = buildTask(vault, buildId, "X");
    const y = buildTask(vault, buildId, "Y");
    const z = buildTask(vault, buildId, "Z");

    const moved = vault.mutate<Doc>("workflow:moveAndResequence", {
      move: { id: z._id, parentId: null, sortOrder: 0 },
      resequence: [
        { id: z._id, sortOrder: 0 },
        { id: x._id, sortOrder: 1 },
        { id: y._id, sortOrder: 2 },
      ],
    });
    expect(moved.sortOrder).toBe(0);
    const reader = vault.store.reader();
    expect([x, y, z].map((d) => reader.get(d._id)?.sortOrder)).toEqual([1, 2, 0]);

    expect(() =>
      vault.mutate("workflow:moveAndResequence", {
        move: { id: x._id, parentId: "local:missing" },
        resequence: [],
      })
    ).toThrow("Parent not found");
  });

  it("sets dependencies, blocks the planner row and exposes them in the editor state", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const first = buildTask(vault, buildId, "Pattern", { dueDate: "2020-01-01" });
    const second = buildTask(vault, buildId, "Sew");

    const deps = vault.mutate<Doc[]>("workflow:setDependencies", {
      workflowItemId: second._id,
      dependencies: [{ predecessorWorkflowItemId: first._id, relationKind: "prerequisite" }],
    });
    expect(deps).toHaveLength(1);
    expect(() =>
      vault.mutate("workflow:setDependencies", {
        workflowItemId: second._id,
        dependencies: [{ predecessorWorkflowItemId: second._id, relationKind: "prerequisite" }],
      })
    ).toThrow("cannot depend on itself");
    expect(() =>
      vault.mutate("workflow:setDependencies", {
        workflowItemId: second._id,
        dependencies: [{ predecessorWorkflowItemId: first._id, relationKind: "vibes" }],
      })
    ).toThrow("Unsupported dependency kind");

    const planner = vault.query<
      {
        title: string;
        overdue: boolean;
        blockedByCount: number;
        blockedByTitles: string[];
        buildName: string | null;
        buildId?: string;
      }[]
    >("workflow:listPlanner");
    expect(planner.map((p) => p.title)).toEqual(["Pattern", "Sew"]);
    expect(planner[0]).toMatchObject({ overdue: true, buildId, buildName: "Zelda" });
    expect(planner[1]).toMatchObject({ blockedByCount: 1, blockedByTitles: ["Pattern"] });

    expect(vault.query("workflow:getItemEditorState", { id: second._id })).toEqual({
      _id: second._id,
      title: "Sew",
      notes: "",
      status: "not_started",
      kind: "task",
      category: "craft",
      dueDate: "",
      predecessorIds: [first._id],
    });
    expect(vault.query("workflow:getItemEditorState", { id: "local:none" })).toBeNull();
  });

  it("update clears nullable fields and mirrors packing items; remove cascades", () => {
    const vault = makeTestVault();
    const { buildId } = seedBuild(vault);
    const conventionAndPacking = vault.store.commit((db) => {
      const conventionId = db.insert("conventions", {
        userId: TEST_SUBJECT,
        name: "Expo",
        startDate: "2026-05-01",
        endDate: "2026-05-02",
      });
      const packingId = db.insert("packingListItems", {
        userId: TEST_SUBJECT,
        conventionId,
        buildId,
        label: "Wig",
        checked: false,
      });
      return { conventionId, packingId };
    });
    const workflowItemId = vault.store.commit((db) =>
      ensurePackingWorkflowItem(
        { db, userId: TEST_SUBJECT, now: vault.now() },
        {
          userId: TEST_SUBJECT,
          packingListItemId: conventionAndPacking.packingId,
          conventionId: conventionAndPacking.conventionId,
          buildId,
          label: "Wig",
          checked: false,
          manual: true,
        }
      )
    );
    expect(vault.store.reader().get(conventionAndPacking.packingId)).toMatchObject({
      workflowItemId,
      entryKind: "manual",
    });

    const updated = vault.mutate<Doc>("workflow:update", {
      id: workflowItemId,
      title: "Wig + net",
      status: "done",
      dueDate: "2026-04-30",
      priority: 3,
    });
    expect(updated).toMatchObject({ title: "Wig + net", status: "done", priority: 3 });
    expect(vault.store.reader().get(conventionAndPacking.packingId)).toMatchObject({
      label: "Wig + net",
      checked: true,
      date: "2026-04-30",
    });
    const cleared = vault.mutate<Doc>("workflow:update", {
      id: workflowItemId,
      priority: null,
      dueDate: "",
    });
    expect("priority" in cleared).toBe(false);
    expect("dueDate" in cleared).toBe(false);
    // Like the server, an explicit null date is "no change" (the empty string clears it).
    const unchanged = vault.mutate<Doc>("workflow:update", { id: workflowItemId, title: "Wig" });
    expect(unchanged.version).toBe((cleared.version as number) + 1);

    const child = vault.mutate<Doc>("workflow:create", { title: "Net", parentId: workflowItemId });
    const other = buildTask(vault, buildId, "Other");
    vault.mutate("workflow:setDependencies", {
      workflowItemId: other._id,
      dependencies: [{ predecessorWorkflowItemId: child._id, relationKind: "blocks" }],
    });

    vault.mutate("workflow:remove", { id: workflowItemId });
    const reader = vault.store.reader();
    expect(reader.get(workflowItemId)).toBeNull();
    expect(reader.get(child._id)).toBeNull();
    expect(reader.get(conventionAndPacking.packingId)).toBeNull();
    expect(reader.query("workflowDependencies").collect()).toEqual([]);
    expect(
      reader
        .query("workflowAttachments")
        .collect()
        .map((a) => a.workflowItemId)
    ).toEqual([other._id]);
    expect(() => vault.mutate("workflow:remove", { id: workflowItemId })).toThrow(
      "Workflow item not found"
    );
    // Cascade on a missing id is a no-op.
    vault.store.commit((db) =>
      removeWorkflowItemCascade({ db, userId: TEST_SUBJECT, now: vault.now() }, "local:gone")
    );
  });

  it("generates and dedupes automation tasks for element statuses", () => {
    const vault = makeTestVault();
    const { buildId, rootNode } = seedBuild(vault);
    const run = (input: Record<string, unknown>) =>
      vault.store.commit((db) =>
        syncGeneratedWorkflowForNode(
          { db, userId: TEST_SUBJECT, now: vault.now() },
          {
            userId: TEST_SUBJECT,
            cosplayNodeId: rootNode,
            buildId,
            nodeName: "Wig",
            category: "Wigs",
            ...input,
          }
        )
      );
    run({ purchaseStatus: "to_buy", buildStatus: "wip" });
    run({ purchaseStatus: "to_buy", buildStatus: "wip" });
    const items = vault.store.reader().query("workflowItems").collect();
    expect(items.map((i) => i.title).sort()).toEqual(["Buy Wig", "Style Wig"]);
    expect(items.find((i) => i.title === "Style Wig")).toMatchObject({
      category: "style",
      status: "in_progress",
      sourceKind: "automation",
      dedupeKey: `autogen:wip:${buildId}:${rootNode}`,
    });

    const tree = vault.query<{ items: TreeNode[] }>("workflow:listBuildTree", { buildId });
    expect(tree.items).toHaveLength(2);
  });
});
