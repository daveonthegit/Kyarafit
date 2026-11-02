import { describe, it, expect } from "vitest";
import {
  applyPlannerOverlay,
  type PlannerOverlayItem,
} from "@kyarafit/design-system/domain/offlinePlannerOverlay";
import type { EntityOverlayRow } from "@kyarafit/design-system/domain/offlineEntityOverlay";

const TODAY = "2026-06-16";

function task(overrides: Partial<PlannerOverlayItem> & { _id: string }): PlannerOverlayItem {
  return {
    title: "Task",
    kind: "task",
    category: "craft",
    status: "not_started",
    ancestorIds: [],
    sortOrder: 0,
    priority: 0,
    progressPercent: 0,
    buildName: null,
    ...overrides,
  };
}

describe("applyPlannerOverlay", () => {
  const base: PlannerOverlayItem[] = [
    task({ _id: "t1", title: "Cut foam", status: "not_started" }),
    task({ _id: "t2", title: "Paint", status: "in_progress", progressPercent: 50 }),
  ];

  it("returns base unchanged with no overlays", () => {
    expect(applyPlannerOverlay(base, [], TODAY)).toEqual(base);
  });

  it("merges an edit and recomputes progress + overdue", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "t1", deleted: false, doc: { _id: "t1", status: "done", dueDate: "2020-01-01" } },
    ];
    const [first] = applyPlannerOverlay(base, overlays, TODAY);
    expect(first.status).toBe("done");
    expect(first.progressPercent).toBe(100);
    expect(first.overdue).toBe(false); // terminal status is never overdue
  });

  it("marks a past-due, non-terminal task overdue", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "t2", deleted: false, doc: { _id: "t2", dueDate: "2020-01-01" } },
    ];
    const result = applyPlannerOverlay(base, overlays, TODAY);
    expect(result.find((t) => t._id === "t2")?.overdue).toBe(true);
  });

  it("appends an offline-created task with build context from attachments", () => {
    const overlays: EntityOverlayRow[] = [
      {
        id: "local:x",
        deleted: false,
        doc: {
          _id: "local:x",
          title: "New task",
          status: "not_started",
          attachments: [{ entityType: "build", entityId: "b1" }],
        },
      },
    ];
    const result = applyPlannerOverlay(base, overlays, TODAY);
    const created = result.find((t) => t._id === "local:x");
    expect(created).toMatchObject({
      _id: "local:x",
      title: "New task",
      buildId: "b1",
      buildName: null,
      blockedByCount: 0,
    });
    expect(result).toHaveLength(3);
  });

  it("removes deleted tasks and skips created groups", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "t1", deleted: true, doc: null },
      { id: "local:g", deleted: false, doc: { _id: "local:g", title: "Group", kind: "group" } },
    ];
    const result = applyPlannerOverlay(base, overlays, TODAY);
    expect(result.map((t) => t._id)).toEqual(["t2"]);
  });

  it("applies a reorder (sortOrder/parentId) to an existing task", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "t2", deleted: false, doc: { _id: "t2", parentId: "t1", sortOrder: 5 } },
    ];
    const moved = applyPlannerOverlay(base, overlays, TODAY).find((t) => t._id === "t2");
    expect(moved?.parentId).toBe("t1");
    expect(moved?.sortOrder).toBe(5);
  });
});
