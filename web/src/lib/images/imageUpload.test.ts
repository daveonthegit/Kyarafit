import { describe, it, expect } from "vitest";
import {
  collectLocalImageRefs,
  planCloudMirror,
  isImageRefTable,
  IMAGE_REF_TABLES,
} from "@kyarafit/design-system/domain/imageUpload";

/**
 * Paid image upload-on-sync planning (DATA_AND_SYNC.md §7, REQ-D70/D71). The pure layer: which local
 * `ImageRef`s on an entity a paid user should mirror, and the idempotent local→cloud flip mutation
 * built once bytes are uploaded. Free never uploads (REQ-D70) — enforced by the sync worker gate,
 * tested at the platform layer.
 */

describe("collectLocalImageRefs (REQ-D71)", () => {
  it("should_collect_each_local_ref_from_a_progress_update_array", () => {
    const doc = {
      _id: "pu_1",
      userId: "user_1",
      imageRefs: [
        { kind: "local", uri: "blob:1", imageKey: "local_a" },
        { kind: "url", url: "https://ex/x.png" },
        { kind: "local", uri: "blob:2", imageKey: "local_b" },
      ],
    };

    const sites = collectLocalImageRefs("buildProgressUpdates", doc);

    expect(sites.map((s) => ({ key: s.imageKey, index: s.index }))).toEqual([
      { key: "local_a", index: 0 },
      { key: "local_b", index: 2 },
    ]);
  });

  it("should_ignore_cloud_and_url_and_deleted_and_unknown_tables", () => {
    expect(
      collectLocalImageRefs("buildProgressUpdates", {
        _id: "pu_1",
        userId: "u",
        imageRefs: [{ kind: "cloud", storageId: "s1", imageKey: "k" }],
      })
    ).toEqual([]);
    expect(
      collectLocalImageRefs("buildProgressUpdates", {
        _id: "pu_1",
        userId: "u",
        imageRefs: [{ kind: "url", url: "https://ex/x.png" }],
      })
    ).toEqual([]);
    // Soft-deleted rows are never uploaded.
    expect(
      collectLocalImageRefs("buildProgressUpdates", {
        _id: "pu_1",
        userId: "u",
        deletedAt: 123,
        imageRefs: [{ kind: "local", uri: "blob:1", imageKey: "local_a" }],
      })
    ).toEqual([]);
    // Non-mirroring table.
    expect(
      collectLocalImageRefs("builds", {
        _id: "b_1",
        userId: "u",
        imageRef: { kind: "local", uri: "blob:1", imageKey: "local_a" },
      })
    ).toEqual([]);
  });

  it("marks only buildProgressUpdates as a mirroring table", () => {
    expect([...IMAGE_REF_TABLES]).toEqual(["buildProgressUpdates"]);
    expect(isImageRefTable("buildProgressUpdates")).toBe(true);
    expect(isImageRefTable("builds")).toBe(false);
  });
});

describe("planCloudMirror (REQ-D71)", () => {
  it("should_flip_one_array_entry_and_preserve_the_rest", () => {
    const doc = {
      _id: "pu_1",
      userId: "user_1",
      imageRefs: [
        { kind: "local", uri: "blob:1", imageKey: "local_a" },
        { kind: "url", url: "https://ex/x.png" },
      ],
    };
    const [site] = collectLocalImageRefs("buildProgressUpdates", doc);

    const plan = planCloudMirror(site, doc, "storage_1");

    expect(plan.fn).toBe("buildProgressUpdates:update");
    expect(plan.args.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_1", imageKey: "local_a" },
      { kind: "url", url: "https://ex/x.png" },
    ]);
  });

  it("composes multiple flips on the same array when fed the working copy", () => {
    const doc = {
      _id: "pu_1",
      userId: "user_1",
      imageRefs: [
        { kind: "local", uri: "blob:1", imageKey: "local_a" },
        { kind: "local", uri: "blob:2", imageKey: "local_b" },
      ],
    };
    const sites = collectLocalImageRefs("buildProgressUpdates", doc);

    let working: Record<string, unknown> = doc;
    working = planCloudMirror(sites[0], working, "storage_a").nextDoc;
    const second = planCloudMirror(sites[1], working, "storage_b");

    expect(second.args.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_a", imageKey: "local_a" },
      { kind: "cloud", storageId: "storage_b", imageKey: "local_b" },
    ]);
  });
});
