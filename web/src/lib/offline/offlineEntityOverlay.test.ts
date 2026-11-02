import { describe, it, expect } from "vitest";
import {
  applyDocOverlay,
  applyListOverlay,
  type EntityOverlayRow,
} from "@kyarafit/design-system/domain/offlineEntityOverlay";

type Build = { _id: string; name: string; status?: string };

describe("applyListOverlay", () => {
  const base: Build[] = [
    { _id: "b1", name: "Alpha", status: "wip" },
    { _id: "b2", name: "Beta", status: "idea" },
  ];

  it("returns base unchanged when there are no overlays", () => {
    expect(applyListOverlay(base, [])).toEqual(base);
  });

  it("merges an edit onto an existing row, preserving order", () => {
    const overlays: EntityOverlayRow[] = [{ id: "b1", deleted: false, doc: { status: "done" } }];
    expect(applyListOverlay(base, overlays)).toEqual([
      { _id: "b1", name: "Alpha", status: "done" },
      { _id: "b2", name: "Beta", status: "idea" },
    ]);
  });

  it("appends created rows (ids not in base)", () => {
    const overlays: EntityOverlayRow[] = [
      { id: "local:x", deleted: false, doc: { name: "Gamma", status: "idea" } },
    ];
    expect(applyListOverlay(base, overlays)).toEqual([
      ...base,
      { _id: "local:x", name: "Gamma", status: "idea" },
    ]);
  });

  it("removes deleted rows", () => {
    const overlays: EntityOverlayRow[] = [{ id: "b1", deleted: true, doc: null }];
    expect(applyListOverlay(base, overlays)).toEqual([{ _id: "b2", name: "Beta", status: "idea" }]);
  });

  it("applies create-then-delete and create-then-edit in order", () => {
    expect(
      applyListOverlay(base, [
        { id: "local:x", deleted: false, doc: { name: "Temp" } },
        { id: "local:x", deleted: true, doc: null },
      ])
    ).toEqual(base);
    expect(
      applyListOverlay(base, [
        { id: "local:y", deleted: false, doc: { name: "Temp" } },
        { id: "local:y", deleted: false, doc: { status: "wip" } },
      ])
    ).toEqual([...base, { _id: "local:y", name: "Temp", status: "wip" }]);
  });

  it("does not mutate the input", () => {
    const overlays: EntityOverlayRow[] = [{ id: "b1", deleted: false, doc: { status: "done" } }];
    applyListOverlay(base, overlays);
    expect(base[0].status).toBe("wip");
  });
});

describe("applyDocOverlay", () => {
  const base: Build = { _id: "b1", name: "Alpha", status: "wip" };

  it("merges an edit onto the base doc", () => {
    expect(
      applyDocOverlay(base, [{ id: "b1", deleted: false, doc: { status: "done" } }], "b1")
    ).toEqual({ _id: "b1", name: "Alpha", status: "done" });
  });

  it("returns null for a delete overlay", () => {
    expect(applyDocOverlay(base, [{ id: "b1", deleted: true, doc: null }], "b1")).toBeNull();
  });

  it("ignores overlays for other ids", () => {
    expect(applyDocOverlay(base, [{ id: "b2", deleted: true, doc: null }], "b1")).toEqual(base);
  });

  it("builds a doc from an overlay when base is missing (offline-created)", () => {
    expect(
      applyDocOverlay<Build>(
        undefined,
        [{ id: "local:x", deleted: false, doc: { name: "New" } }],
        "local:x"
      )
    ).toEqual({ _id: "local:x", name: "New" });
  });

  it("preserves undefined while loading with no matching overlay", () => {
    expect(applyDocOverlay<Build>(undefined, [], "b1")).toBeUndefined();
  });
});
