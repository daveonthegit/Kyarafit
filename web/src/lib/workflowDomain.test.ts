import { describe, expect, it } from "vitest";
import {
  buildWorkflowTree,
  entityKey,
  flattenWorkflowTree,
  parentAncestorIds,
} from "../../../convex/lib/workflowDomain";

describe("workflowDomain", () => {
  it("builds hierarchical trees and carries aggregate progress up", () => {
    const root = {
      _id: "root",
      userId: "user",
      title: "Build Prop",
      kind: "group",
      category: "craft",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
    };
    const child = {
      _id: "child",
      userId: "user",
      title: "Prime surface",
      kind: "task",
      category: "craft",
      status: "done",
      parentId: "root",
      ancestorIds: ["root"],
      sortOrder: 0,
      scopeKind: "shared",
      sourceKind: "manual",
    };

    const tree = buildWorkflowTree({
      items: [root, child] as any,
      attachments: [],
      dependencies: [],
    });

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].progressPercent).toBe(100);
    expect(flattenWorkflowTree(tree)).toHaveLength(2);
  });

  it("marks successors as blocked when prerequisites are incomplete", () => {
    const items = [
      {
        _id: "prep",
        userId: "user",
        title: "Assemble",
        kind: "task",
        category: "craft",
        status: "in_progress",
        ancestorIds: [],
        sortOrder: 0,
        scopeKind: "shared",
        sourceKind: "manual",
      },
      {
        _id: "paint",
        userId: "user",
        title: "Paint",
        kind: "task",
        category: "craft",
        status: "not_started",
        ancestorIds: [],
        sortOrder: 1,
        scopeKind: "shared",
        sourceKind: "manual",
      },
    ] as any;
    const dependencies = [
      {
        _id: "dep",
        userId: "user",
        predecessorWorkflowItemId: "prep",
        successorWorkflowItemId: "paint",
        relationKind: "prerequisite",
      },
    ] as any;

    const tree = buildWorkflowTree({ items, attachments: [], dependencies });
    expect(tree[1].isBlocked).toBe(true);
    expect(tree[1].blockedByCount).toBe(1);
  });

  it("derives ancestor ids and attachment keys consistently", () => {
    expect(parentAncestorIds(null as any)).toEqual([]);
    expect(parentAncestorIds({ _id: "a", ancestorIds: ["root"] } as any)).toEqual(["root", "a"]);
    expect(entityKey("build", "123")).toBe("build:123");
  });
});
