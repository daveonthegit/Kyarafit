import { describe, it, expect } from "vitest";
import {
  applyBuildTreeOverlay,
  type BuildTreeResult,
} from "@kyarafit/design-system/domain/offlineBuildTreeOverlay";
import type { EntityOverlayRow } from "@kyarafit/design-system/domain/offlineEntityOverlay";

const BUILD_ID = "b1";

function baseResult(): BuildTreeResult {
  return {
    buildId: BUILD_ID,
    items: [
      {
        _id: "root",
        parentId: null,
        ancestorIds: [],
        sortOrder: 0,
        title: "Root",
        kind: "group",
        status: "in_progress",
        progressPercent: 0,
        attachments: [{ workflowItemId: "root", entityType: "build", entityId: BUILD_ID }],
        dependencies: [],
        children: [
          {
            _id: "child",
            parentId: "root",
            ancestorIds: ["root"],
            sortOrder: 0,
            title: "Child",
            kind: "task",
            status: "not_started",
            progressPercent: 0,
            attachments: [],
            dependencies: [],
            children: [],
          },
        ],
      },
    ],
    stats: { tasksTotal: 1, tasksDone: 0, workflowProgressPercent: 0 },
  };
}

describe("applyBuildTreeOverlay", () => {
  it("returns a re-derived but equivalent tree with no overlays", () => {
    const result = applyBuildTreeOverlay(baseResult(), [], BUILD_ID);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].children).toHaveLength(1);
    expect(result.stats).toEqual({ tasksTotal: 1, tasksDone: 0, workflowProgressPercent: 0 });
  });

  it("reflects an offline edit marking a task done in stats and progress", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "child", deleted: false, doc: { _id: "child", status: "done" } },
    ];
    const result = applyBuildTreeOverlay(baseResult(), overlays, BUILD_ID);
    const child = result.items[0].children[0];
    expect(child.status).toBe("done");
    expect(child.progressPercent).toBe(100);
    expect(result.stats).toEqual({ tasksTotal: 1, tasksDone: 1, workflowProgressPercent: 100 });
  });

  it("inserts an offline-created child under an existing parent", () => {
    const overlays: EntityOverlayRow[] = [
      {
        id: "local:new",
        deleted: false,
        doc: { _id: "local:new", title: "New sub", kind: "task", parentId: "root", sortOrder: 1 },
      },
    ];
    const result = applyBuildTreeOverlay(baseResult(), overlays, BUILD_ID);
    const childIds = result.items[0].children.map((c) => c._id);
    expect(childIds).toContain("local:new");
    expect(result.stats.tasksTotal).toBe(2);
  });

  it("includes an offline-created root task that targets this build via attachments", () => {
    const overlays: EntityOverlayRow[] = [
      {
        id: "local:root2",
        deleted: false,
        doc: {
          _id: "local:root2",
          title: "Standalone",
          kind: "task",
          attachments: [{ entityType: "build", entityId: BUILD_ID }],
        },
      },
    ];
    const result = applyBuildTreeOverlay(baseResult(), overlays, BUILD_ID);
    expect(result.items.map((n) => n._id)).toContain("local:root2");
  });

  it("ignores creates that target a different build", () => {
    const overlays: EntityOverlayRow[] = [
      {
        id: "local:other",
        deleted: false,
        doc: {
          _id: "local:other",
          title: "Other build task",
          attachments: [{ entityType: "build", entityId: "other-build" }],
        },
      },
    ];
    const result = applyBuildTreeOverlay(baseResult(), overlays, BUILD_ID);
    expect(result.items.map((n) => n._id)).not.toContain("local:other");
  });

  it("removes a deleted task and updates stats", () => {
    const overlays: EntityOverlayRow[] = [{ id: "child", deleted: true, doc: null }];
    const result = applyBuildTreeOverlay(baseResult(), overlays, BUILD_ID);
    expect(result.items[0].children).toHaveLength(0);
    expect(result.stats.tasksTotal).toBe(0);
  });
});
