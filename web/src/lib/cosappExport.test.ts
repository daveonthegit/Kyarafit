import { describe, expect, it, vi } from "vitest";
import {
  EXPORT_MAX_PHOTO_BYTES,
  COSAPP_RECEIPT_ENTRY,
  LIBRARY_BUILD_NAME,
  convertKyarafitToCosapp,
  isCosappImage,
  planPhotoBatches,
  withoutPhotoFiles,
  type CosappExport,
  type KyarafitSnapshot,
} from "@kyarafit/design-system/domain/cosappExport";
import { unzipSync, strFromU8 } from "fflate";
import { buildCosappDownload, encodeCosappArchive, type CosappExportClient } from "./cosappArchive";
import {
  assertStoreConstraints,
  decodeBackup,
  emptyStore,
  mergeInto,
} from "@/test/cosappBackupParser";

// Spec: the Kyarafit → Cosapp.si converter (Settings → Backup & data → "Download for Cosapp.si").
// Rules from the Cosapp.si migration design: builds/pieces/tasks/conventions/photos carry over,
// subtasks flatten to "Parent › Step", generated tasks are dropped, cancelled tasks skipped,
// untraceable library elements go to a "From Kyarafit library" idea build.

const T0 = Date.UTC(2026, 2, 1); // creation times
const NOW = Date.UTC(2026, 10, 3); // the export's clock; never used for row stamps

function emptySnapshot(): KyarafitSnapshot {
  return {
    builds: [],
    cosplayNodes: [],
    workflowItems: [],
    workflowAttachments: [],
    conventions: [],
    conventionDayPlans: [],
    packingListItems: [],
    buildReferenceImages: [],
    buildProcessPictures: [],
    buildProgressUpdates: [],
    storedFiles: [],
  };
}

const jpeg = (storageId: string, size = 1000) => ({
  storageId,
  size,
  contentType: "image/jpeg;kfm-upload-tag=abc",
});

/** One account covering every mapping rule. */
function fixture(): KyarafitSnapshot {
  const s = emptySnapshot();
  s.builds = [
    {
      _id: "b1",
      _creationTime: T0 + 0.5,
      updatedAt: T0 + 5000,
      name: "Frieren winter",
      character: "Frieren",
      status: "wip",
      notes: "Coat first",
      imageStorageId: "s-cover",
      budgetCents: 12000,
      targetDate: "2027-07-02",
    },
    { _id: "b2", _creationTime: T0 + 1, name: "Fern", status: "idea", targetDate: "soon" },
    {
      _id: "b3",
      _creationTime: T0 + 2,
      name: "Stark",
      status: "ready",
      imageUrl: "https://example.com/stark.jpg",
    },
    { _id: "b4", _creationTime: T0 + 3, name: "Old", status: "archived" },
    { _id: "bdel", _creationTime: T0 + 4, name: "Deleted", status: "idea", deletedAt: T0 + 10 },
  ];
  s.cosplayNodes = [
    {
      _id: "n-armor",
      _creationTime: T0 + 10,
      buildId: "b1",
      sortOrder: 0,
      nodeType: "element",
      name: "Armor",
      category: "armor",
      tags: ["metal", "heavy"],
      purchaseStatus: "to_buy",
      buildStatus: "wip",
      directCostCents: 4000,
      imageStorageId: "s-armor",
    },
    // Child added after Step 2c: parent but no buildId; inherits the root's build.
    {
      _id: "n-pauldron",
      _creationTime: T0 + 11,
      parentNodeId: "n-armor",
      sortOrder: 0,
      nodeType: "element",
      name: "Pauldron",
      buildStatus: "built",
      tags: [],
    },
    {
      _id: "n-wig",
      _creationTime: T0 + 12,
      buildId: "b1",
      sortOrder: 1,
      nodeType: "element",
      name: "Wig",
      purchaseStatus: "bought",
      tags: [],
      pricingMode: "unit",
      unitCostCents: 250,
      quantity: 3,
      unit: "packs",
      sourceUrl: "https://shop.example/wig",
    },
    {
      _id: "n-foam",
      _creationTime: T0 + 13,
      buildId: "b1",
      sortOrder: 2,
      nodeType: "material",
      name: "EVA foam",
      materialStatus: "in_use",
      tags: [],
      manualOverallBucket: "complete",
    },
    // Library-only, but a task attachment's build context ties it to b2.
    {
      _id: "n-traced",
      _creationTime: T0 + 14,
      nodeType: "element",
      name: "Staff",
      tags: [],
    },
    // Library-only with nothing to trace.
    { _id: "n-lib-b", _creationTime: T0 + 16, nodeType: "element", name: "Boots", tags: [] },
    { _id: "n-lib-a", _creationTime: T0 + 15, nodeType: "element", name: "Cape", tags: [] },
    // Belongs to a deleted build.
    {
      _id: "n-gone",
      _creationTime: T0 + 17,
      buildId: "bdel",
      nodeType: "element",
      name: "X",
      tags: [],
    },
    {
      _id: "n-del",
      _creationTime: T0 + 18,
      buildId: "b1",
      nodeType: "element",
      name: "Y",
      tags: [],
      deletedAt: T0 + 20,
    },
  ];
  s.workflowItems = [
    {
      _id: "w-craft",
      _creationTime: T0 + 30,
      updatedAt: T0 + 31,
      title: "Craft coat",
      status: "in_progress",
      sortOrder: 0,
      sourceKind: "manual",
      dueDate: "2027-01-10",
      notes: "Wool",
    },
    {
      _id: "w-cut",
      _creationTime: T0 + 32,
      title: "Cut pattern",
      status: "done",
      parentId: "w-craft",
      sortOrder: 0,
      sourceKind: "manual",
    },
    {
      _id: "w-sew",
      _creationTime: T0 + 33,
      title: "Sew",
      status: "scheduled",
      parentId: "w-craft",
      sortOrder: 1,
      sourceKind: "manual",
      dueDate: "2027-13-01",
    },
    {
      _id: "w-hem",
      _creationTime: T0 + 34,
      title: "Hem",
      status: "not_started",
      parentId: "w-sew",
      sortOrder: 0,
      sourceKind: "manual",
    },
    {
      _id: "w-style",
      _creationTime: T0 + 35,
      title: "Style wig",
      status: "not_started",
      sortOrder: 1,
      sourceKind: "manual",
    },
    {
      _id: "w-badge",
      _creationTime: T0 + 36,
      title: "Print badge",
      status: "done",
      sortOrder: 2,
      sourceKind: "manual",
    },
    {
      _id: "w-general",
      _creationTime: T0 + 37,
      title: "Buy glue",
      status: "waiting",
      sortOrder: 3,
      sourceKind: "manual",
    },
    {
      _id: "w-buy",
      _creationTime: T0 + 38,
      title: "Buy Armor",
      status: "not_started",
      sortOrder: 4,
      sourceKind: "automation",
    },
    {
      _id: "w-pack",
      _creationTime: T0 + 39,
      title: "Pack Wig",
      status: "done",
      sortOrder: 5,
      sourceKind: "packing",
    },
    {
      _id: "w-cancel",
      _creationTime: T0 + 40,
      title: "Photoshoot",
      status: "cancelled",
      sortOrder: 6,
      sourceKind: "manual",
    },
    {
      _id: "w-orphan",
      _creationTime: T0 + 41,
      title: "Old task",
      status: "not_started",
      sortOrder: 7,
      sourceKind: "manual",
    },
    {
      _id: "w-staff",
      _creationTime: T0 + 42,
      title: "Paint staff",
      status: "not_started",
      sortOrder: 8,
      sourceKind: "template",
    },
  ];
  s.workflowAttachments = [
    {
      _id: "a1",
      _creationTime: T0,
      workflowItemId: "w-craft",
      entityType: "build",
      entityId: "b1",
      role: "primary",
    },
    {
      _id: "a2",
      _creationTime: T0,
      workflowItemId: "w-style",
      entityType: "cosplayNode",
      entityId: "n-wig",
      role: "progress_source",
      buildContextId: "b1",
    },
    {
      _id: "a2b",
      _creationTime: T0,
      workflowItemId: "w-style",
      entityType: "build",
      entityId: "b1",
      role: "context",
    },
    {
      _id: "a3",
      _creationTime: T0,
      workflowItemId: "w-badge",
      entityType: "convention",
      entityId: "c1",
      role: "primary",
    },
    {
      _id: "a4",
      _creationTime: T0,
      workflowItemId: "w-buy",
      entityType: "cosplayNode",
      entityId: "n-armor",
      role: "progress_source",
      buildContextId: "b1",
    },
    {
      _id: "a5",
      _creationTime: T0,
      workflowItemId: "w-orphan",
      entityType: "build",
      entityId: "bdel",
      role: "primary",
    },
    {
      _id: "a6",
      _creationTime: T0,
      workflowItemId: "w-staff",
      entityType: "cosplayNode",
      entityId: "n-traced",
      role: "progress_source",
      buildContextId: "b2",
    },
  ];
  s.conventions = [
    {
      _id: "c1",
      _creationTime: T0 + 50,
      name: "Anime Expo",
      location: "LA",
      startDate: "2027-07-02",
      endDate: "2027-07-04",
      imageStorageId: "s-con",
      archived: true,
    },
    {
      _id: "c2",
      _creationTime: T0 + 51,
      name: "Backwards",
      startDate: "2027-05-05",
      endDate: "2027-05-01",
    },
    { _id: "c3", _creationTime: T0 + 52, name: "No date", startDate: "TBD", endDate: "TBD" },
  ];
  s.conventionDayPlans = [
    {
      _id: "d1",
      _creationTime: T0 + 60,
      updatedAt: T0 + 61,
      conventionId: "c1",
      date: "2027-07-02",
      buildId: "b2",
    },
    // Newer row for the same day wins.
    {
      _id: "d2",
      _creationTime: T0 + 62,
      updatedAt: T0 + 70,
      conventionId: "c1",
      date: "2027-07-02",
      buildId: "b1",
      notes: "Meetup at 2pm",
    },
    { _id: "d3", _creationTime: T0 + 63, conventionId: "c1", date: "2027-07-03", buildId: "bdel" },
    { _id: "d4", _creationTime: T0 + 64, conventionId: "c1", date: "2027-08-01", buildId: "b1" },
  ];
  s.packingListItems = [
    {
      _id: "k-wig",
      _creationTime: T0 + 80,
      conventionId: "c1",
      cosplayNodeId: "n-wig",
      label: "Wig",
      checked: true,
      sortOrder: 0,
    },
    {
      _id: "k-charger",
      _creationTime: T0 + 81,
      conventionId: "c1",
      label: "Charger",
      notes: "USB-C",
      checked: false,
      sortOrder: 1,
    },
    // Its build (b2) is not on any day of c1 after the day-plan merge, so it stays manual.
    {
      _id: "k-staff",
      _creationTime: T0 + 82,
      conventionId: "c1",
      cosplayNodeId: "n-traced",
      label: "Staff",
      checked: true,
      sortOrder: 2,
    },
    {
      _id: "k-wig-2",
      _creationTime: T0 + 83,
      conventionId: "c1",
      cosplayNodeId: "n-wig",
      label: "Wig again",
      checked: false,
      sortOrder: 3,
    },
  ];
  s.buildReferenceImages = [
    { _id: "r1", _creationTime: T0 + 90, buildId: "b1", imageStorageId: "s-ref", sortOrder: 0 },
    {
      _id: "r2",
      _creationTime: T0 + 91,
      buildId: "b1",
      imageUrl: "https://example.com/ref.png",
      sortOrder: 1,
    },
    { _id: "r3", _creationTime: T0 + 92, buildId: "b1", imageStorageId: "s-gif", sortOrder: 2 },
  ];
  s.buildProcessPictures = [
    { _id: "g1", _creationTime: T0 + 93, buildId: "b1", imageStorageId: "s-proc", sortOrder: 0 },
    { _id: "g2", _creationTime: T0 + 94, buildId: "b1", imageStorageId: "s-huge", sortOrder: 1 },
    {
      _id: "g3",
      _creationTime: T0 + 95,
      buildId: "b1",
      imageStorageId: "s-vanished",
      sortOrder: 2,
    },
  ];
  s.buildProgressUpdates = [
    {
      _id: "u1",
      _creationTime: T0 + 96,
      buildId: "b1",
      createdAt: Date.UTC(2026, 5, 1),
      note: "Coat lining done",
      imageRefs: [
        { kind: "cloud", storageId: "s-upd", imageKey: "k1" },
        { kind: "local", uri: "file:///phone.jpg", imageKey: "k2" },
      ],
    },
    {
      _id: "u2",
      _creationTime: T0 + 97,
      buildId: "b1",
      createdAt: Date.UTC(2026, 5, 2),
      note: "Bought fabric",
      progressPercent: 40,
      imageRefs: [],
    },
  ];
  s.storedFiles = [
    jpeg("s-cover"),
    jpeg("s-armor"),
    jpeg("s-con"),
    jpeg("s-ref"),
    { storageId: "s-gif", size: 10, contentType: "image/gif" },
    jpeg("s-proc"),
    jpeg("s-huge", EXPORT_MAX_PHOTO_BYTES + 1),
    jpeg("s-upd"),
    // "s-vanished" has no metadata: the stored file is gone.
  ];
  return s;
}

function convert(snapshot = fixture()) {
  return convertKyarafitToCosapp(snapshot, { now: NOW });
}

function byId<T extends { id: string }>(rows: T[], id: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
}

function dropped(result: CosappExport, kind: string) {
  return result.receipt.dropped.find((entry) => entry.kind === kind)?.count ?? 0;
}

function reshaped(result: CosappExport, kind: string) {
  return result.receipt.reshaped.find((entry) => entry.kind === kind)?.count ?? 0;
}

describe("builds", () => {
  it("maps fields and statuses, and keeps the Kyarafit name in notes when it differs", () => {
    const { data } = convert();
    const b1 = byId(data.rows.builds, "ky-b-b1");
    expect(b1).toEqual({
      id: "ky-b-b1",
      createdAt: T0,
      updatedAt: T0 + 5000,
      deletedAt: null,
      character: "Frieren",
      series: null,
      status: "in_progress",
      targetDate: "2027-07-02",
      targetLabel: null,
      budgetCents: 12000,
      notes: expect.stringMatching(/^Frieren winter\n\nCoat first/),
    });
    const fern = byId(data.rows.builds, "ky-b-b2");
    expect(fern).toMatchObject({
      character: "Fern",
      status: "idea",
      targetDate: null,
      notes: null,
    });
    expect(byId(data.rows.builds, "ky-b-b3").status).toBe("complete");
    expect(byId(data.rows.builds, "ky-b-b4").status).toBe("archived");
  });

  it("leaves deleted builds and everything under them out", () => {
    const { data } = convert();
    expect(data.rows.builds.map((b) => b.id)).not.toContain("ky-b-bdel");
    expect(JSON.stringify(data)).not.toContain("Deleted");
    expect(data.rows.pieces.map((p) => p.id)).not.toContain("ky-p-n-gone");
    expect(data.rows.pieces.map((p) => p.id)).not.toContain("ky-p-n-del");
  });

  it("makes the build image the cover photo; an external image link goes into the notes", () => {
    const result = convert();
    const cover = byId(result.data.rows.photos, "ky-cover-b-b1");
    expect(cover).toMatchObject({
      kind: "cover",
      buildId: "ky-b-b1",
      conventionId: null,
      pieceId: null,
      fileName: "ky-cover-b-b1.jpg",
    });
    expect(result.photoFiles).toContainEqual({
      fileName: "ky-cover-b-b1.jpg",
      storageId: "s-cover",
      size: 1000,
    });
    expect(byId(result.data.rows.builds, "ky-b-b3").notes).toBe(
      "Cover image link: https://example.com/stark.jpg"
    );
  });
});

describe("pieces", () => {
  it("flattens nested parts to 'Parent › Child' in the root's build, in tree order", () => {
    const { data } = convert();
    const b1 = data.rows.pieces.filter((p) => p.buildId === "ky-b-b1");
    expect(b1.map((p) => [p.name, p.position])).toEqual([
      ["Armor", 0],
      ["Armor › Pauldron", 1],
      ["Wig", 2],
      ["EVA foam", 3],
    ]);
  });

  it("maps kind, status, cost, link and notes", () => {
    const { data } = convert();
    expect(byId(data.rows.pieces, "ky-p-n-armor")).toMatchObject({
      kind: "make",
      status: "in_progress",
      costCents: 4000,
      notes: "Category: armor\n\nTags: metal, heavy",
    });
    expect(byId(data.rows.pieces, "ky-p-n-pauldron").status).toBe("done");
    expect(byId(data.rows.pieces, "ky-p-n-wig")).toMatchObject({
      kind: "buy",
      status: "done",
      costCents: 750,
      link: "https://shop.example/wig",
      notes: "Quantity: 3 packs",
    });
    // Materials become Buy pieces; a manual overall bucket overrides the status.
    expect(byId(data.rows.pieces, "ky-p-n-foam")).toMatchObject({ kind: "buy", status: "done" });
  });

  it("puts a library element into the build a task ties it to", () => {
    const { data } = convert();
    expect(byId(data.rows.pieces, "ky-p-n-traced").buildId).toBe("ky-b-b2");
  });

  it("puts untraceable library elements into one 'From Kyarafit library' idea build", () => {
    const result = convert();
    const library = result.data.rows.builds.filter((b) => b.character === LIBRARY_BUILD_NAME);
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      id: "ky-b-library-n-lib-a",
      status: "idea",
      createdAt: T0 + 15,
    });
    expect(
      result.data.rows.pieces.filter((p) => p.buildId === library[0].id).map((p) => p.name)
    ).toEqual(["Cape", "Boots"]);
    expect(reshaped(result, "libraryPiece")).toBe(2);
  });

  it("creates no library build when every element has a build", () => {
    const s = fixture();
    s.cosplayNodes = s.cosplayNodes.filter((n) => !n._id.startsWith("n-lib"));
    expect(convert(s).data.rows.builds.some((b) => b.character === LIBRARY_BUILD_NAME)).toBe(false);
  });

  it("turns an element image into a reference photo tagged to the piece", () => {
    const { data } = convert();
    expect(byId(data.rows.photos, "ky-ph-n-n-armor")).toMatchObject({
      kind: "reference",
      buildId: "ky-b-b1",
      pieceId: "ky-p-n-armor",
    });
  });
});

describe("tasks", () => {
  it("carries hand-written tasks with title, done, due date, notes and build owner", () => {
    const { data } = convert();
    expect(byId(data.rows.tasks, "ky-t-w-craft")).toEqual({
      id: "ky-t-w-craft",
      createdAt: T0 + 30,
      updatedAt: T0 + 31,
      deletedAt: null,
      ownerKind: "build",
      buildId: "ky-b-b1",
      pieceId: null,
      conventionId: null,
      title: "Craft coat",
      done: false,
      dueDate: "2027-01-10",
      remindAt: null,
      notes: "Wool",
      position: 0,
    });
  });

  it("flattens subtasks to 'Parent › Step' right after the parent, with the parent's owner", () => {
    const result = convert();
    const b1 = result.data.rows.tasks
      .filter((t) => t.buildId === "ky-b-b1")
      .sort((a, b) => a.position - b.position);
    expect(b1.map((t) => [t.title, t.done, t.position])).toEqual([
      ["Craft coat", false, 0],
      ["Craft coat › Cut pattern", true, 1],
      ["Craft coat › Sew", false, 2],
      ["Craft coat › Sew › Hem", false, 3],
      ["Style wig", false, 4],
    ]);
    expect(byId(result.data.rows.tasks, "ky-t-w-sew").dueDate).toBeNull();
    expect(reshaped(result, "subtaskFlattened")).toBe(3);
  });

  it("links tasks to pieces, conventions or nothing", () => {
    const { data } = convert();
    expect(byId(data.rows.tasks, "ky-t-w-style")).toMatchObject({
      ownerKind: "build",
      buildId: "ky-b-b1",
      pieceId: "ky-p-n-wig",
    });
    expect(byId(data.rows.tasks, "ky-t-w-staff")).toMatchObject({
      buildId: "ky-b-b2",
      pieceId: "ky-p-n-traced",
    });
    expect(byId(data.rows.tasks, "ky-t-w-badge")).toMatchObject({
      ownerKind: "convention",
      conventionId: "ky-c-c1",
      buildId: null,
      pieceId: null,
      done: true,
    });
    expect(byId(data.rows.tasks, "ky-t-w-general")).toMatchObject({
      ownerKind: "none",
      buildId: null,
      pieceId: null,
      conventionId: null,
    });
  });

  it("drops generated Buy / Work on / Pack tasks, skips cancelled ones and deleted owners", () => {
    const result = convert();
    const ids = result.data.rows.tasks.map((t) => t.id);
    expect(ids).not.toContain("ky-t-w-buy");
    expect(ids).not.toContain("ky-t-w-pack");
    expect(ids).not.toContain("ky-t-w-cancel");
    expect(ids).not.toContain("ky-t-w-orphan");
    expect(dropped(result, "generatedTask")).toBe(2);
    expect(dropped(result, "cancelledTask")).toBe(1);
  });
});

describe("conventions, day plans and packing", () => {
  it("maps conventions, clamps a backwards end date and drops undated ones", () => {
    const result = convert();
    expect(byId(result.data.rows.conventions, "ky-c-c1")).toMatchObject({
      name: "Anime Expo",
      location: "LA",
      startDate: "2027-07-02",
      endDate: "2027-07-04",
      badgeNote: null,
      hotelNote: null,
      notes: "Archived in Kyarafit.\n\n2027-07-02: Meetup at 2pm",
    });
    expect(byId(result.data.rows.conventions, "ky-c-c2").endDate).toBe("2027-05-05");
    expect(result.data.rows.conventions.map((c) => c.id)).not.toContain("ky-c-c3");
    expect(dropped(result, "invalidConvention")).toBe(1);
  });

  it("makes the convention image a cover photo owned by the convention", () => {
    const { data } = convert();
    expect(byId(data.rows.photos, "ky-cover-c-c1")).toMatchObject({
      kind: "cover",
      buildId: null,
      pieceId: null,
      conventionId: "ky-c-c1",
    });
  });

  it("keeps one build per day (the newer row) and drops days outside the convention", () => {
    const result = convert();
    expect(result.data.rows.dayPlans).toEqual([
      {
        id: "ky-c-c1:2027-07-02",
        createdAt: T0 + 62,
        updatedAt: T0 + 70,
        deletedAt: null,
        conventionId: "ky-c-c1",
        date: "2027-07-02",
        buildId: "ky-b-b1",
      },
      expect.objectContaining({ id: "ky-c-c1:2027-07-03", buildId: null }),
    ]);
    expect(dropped(result, "duplicateDayPlan")).toBe(1);
    expect(dropped(result, "dayPlanOutsideConvention")).toBe(1);
  });

  it("keeps packing checks: pieces of planned builds as generated items, the rest manual", () => {
    const result = convert();
    expect(result.data.rows.packingItems.map((i) => [i.key, i.label, i.source, i.checked])).toEqual(
      [
        ["piece:ky-p-n-wig", "Wig", "generated", true],
        ["manual:ky-k-k-charger", "Charger (USB-C)", "manual", false],
        ["manual:ky-k-k-staff", "Staff", "manual", true],
      ]
    );
    expect(byId(result.data.rows.packingItems, "ky-k-k-wig")).toMatchObject({
      buildId: "ky-b-b1",
      pieceId: "ky-p-n-wig",
      position: 0,
    });
    expect(dropped(result, "duplicatePackingItem")).toBe(1);
  });
});

describe("photos", () => {
  it("carries reference, process and progress-update photos with captions and dates", () => {
    const { data } = convert();
    expect(byId(data.rows.photos, "ky-ph-r-r1")).toMatchObject({
      kind: "reference",
      takenAt: T0 + 90,
    });
    expect(byId(data.rows.photos, "ky-ph-g-g1")).toMatchObject({ kind: "progress", caption: null });
    expect(byId(data.rows.photos, "ky-ph-u-u1-0")).toMatchObject({
      kind: "progress",
      caption: "Coat lining done",
      takenAt: Date.UTC(2026, 5, 1),
    });
  });

  it("keeps a progress note without a photo as a dated build note line", () => {
    const { data } = convert();
    expect(byId(data.rows.builds, "ky-b-b1").notes).toContain(
      "Progress 2026-06-02 (40%): Bought fabric"
    );
    expect(byId(data.rows.builds, "ky-b-b1").notes).toContain(
      "Reference image link: https://example.com/ref.png"
    );
  });

  it("records every photo it cannot carry, by reason", () => {
    const result = convert();
    expect(dropped(result, "deviceOnlyImage")).toBe(1);
    expect(dropped(result, "unsupportedImage")).toBe(1);
    expect(dropped(result, "oversizeImage")).toBe(1);
    expect(dropped(result, "missingImage")).toBe(1);
    expect(dropped(result, "externalImage")).toBe(2);
    expect(result.receipt.dropped).toContainEqual({ kind: "socialData", count: null });
  });
});

describe("receipt and identity", () => {
  it("counts rows per table and photo files", () => {
    const result = convert();
    expect(result.receipt.counts).toEqual({
      builds: 5,
      pieces: 7,
      tasks: 8,
      photos: 6,
      conventions: 2,
      dayPlans: 2,
      packingItems: 3,
      photoFiles: 6,
    });
  });

  it("derives ids and stamps from Kyarafit rows, so a re-export is stable", () => {
    const first = convert();
    const second = convertKyarafitToCosapp(fixture(), { now: NOW + 99_999 });
    expect(second.data.rows).toEqual(first.data.rows);
    const stamps = Object.values(first.data.rows)
      .flat()
      .flatMap((row) => [row.createdAt, row.updatedAt]);
    expect(Math.max(...stamps)).toBeLessThan(NOW);
  });

  it("drops photo rows whose bytes vanished and updates the receipt", () => {
    const result = withoutPhotoFiles(convert(), new Set(["ky-ph-r-r1.jpg"]));
    expect(result.data.rows.photos.map((p) => p.id)).not.toContain("ky-ph-r-r1");
    expect(result.photoFiles.map((f) => f.fileName)).not.toContain("ky-ph-r-r1.jpg");
    expect(result.receipt.counts.photos).toBe(5);
    expect(dropped(result, "missingImage")).toBe(2);
  });

  it("plans photo fetches in size-bounded batches, one fetch per stored file", () => {
    const files = [
      { fileName: "a.jpg", storageId: "s1", size: 3 },
      { fileName: "b.jpg", storageId: "s2", size: 3 },
      { fileName: "c.jpg", storageId: "s1", size: 3 },
      { fileName: "d.jpg", storageId: "s3", size: 10 },
      { fileName: "e.jpg", storageId: "s4", size: 1 },
    ];
    expect(planPhotoBatches(files, 6)).toEqual([["s1", "s2"], ["s3"], ["s4"]]);
    expect(planPhotoBatches([], 6)).toEqual([]);
  });
});

describe("image checks", () => {
  it("keeps a file with no recorded type for the byte check instead of dropping it", () => {
    const s = fixture();
    s.storedFiles = s.storedFiles.map((f) =>
      f.storageId === "s-ref" ? { storageId: "s-ref", size: 10 } : f
    );
    expect(byId(convert(s).data.rows.photos, "ky-ph-r-r1").fileName).toBe("ky-ph-r-r1.jpg");
  });

  it("recognises the image formats Cosapp.si's restore keeps", () => {
    const bytes = (...parts: (number[] | string)[]) =>
      new Uint8Array(
        parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p))
      );
    expect(isCosappImage(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isCosappImage(bytes([0x89], "PNG", [13, 10]))).toBe(true);
    expect(isCosappImage(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe(true);
    expect(isCosappImage(bytes([0, 0, 0, 24], "ftypheic"))).toBe(true);
    expect(isCosappImage(bytes("GIF89a"))).toBe(false);
    expect(isCosappImage(bytes("%PDF-1.7"))).toBe(false);
    expect(isCosappImage(new Uint8Array())).toBe(false);
  });
});

describe("round trip through Cosapp.si's backup reader", () => {
  const bytesFor = (result: CosappExport) =>
    new Map(result.photoFiles.map((f) => [f.fileName, new Uint8Array([0xff, 0xd8, 0xff, 1])]));

  it("decodes, satisfies the store's constraints and merges once", () => {
    const result = convert();
    const archive = decodeBackup(encodeCosappArchive(result, bytesFor(result)));
    expect(archive.data.format).toBe("cosapp.si/backup");
    expect(archive.data.schemaVersion).toBe(2);
    expect(archive.data.rows).toEqual(result.data.rows);
    expect([...archive.photos.keys()].sort()).toEqual(
      result.photoFiles.map((f) => f.fileName).sort()
    );
    assertStoreConstraints(archive.data.rows);

    const store = emptyStore();
    const first = mergeInto(store, archive);
    expect(first.builds).toBe(5);
    // Importing the same file again with Merge changes nothing.
    expect(Object.values(mergeInto(store, archive)).every((n) => n === 0)).toBe(true);
  });

  it("does not overwrite an edit made in Cosapp.si when a later export is merged", () => {
    const result = convert();
    const archive = decodeBackup(encodeCosappArchive(result, bytesFor(result)));
    const store = emptyStore();
    mergeInto(store, archive);
    const edited = { ...store.builds.get("ky-b-b1")!, updatedAt: NOW, notes: "edited" } as never;
    store.builds.set("ky-b-b1", edited);
    const again = convertKyarafitToCosapp(fixture(), { now: NOW + 1 });
    mergeInto(store, decodeBackup(encodeCosappArchive(again, bytesFor(again))));
    expect((store.builds.get("ky-b-b1") as unknown as { notes: string }).notes).toBe("edited");
  });

  it("writes a valid empty backup for an account with no data", () => {
    const result = convertKyarafitToCosapp(emptySnapshot(), { now: NOW });
    const archive = decodeBackup(encodeCosappArchive(result, new Map()));
    assertStoreConstraints(archive.data.rows);
    expect(archive.data.rows.builds).toEqual([]);
  });

  it("carries the receipt in the archive without disturbing the backup", () => {
    const result = convert();
    const files = unzipSync(encodeCosappArchive(result, bytesFor(result)));
    expect(JSON.parse(strFromU8(files[COSAPP_RECEIPT_ENTRY]))).toEqual(result.receipt);
  });

  it("refuses to write an archive missing a photo's bytes", () => {
    const result = convert();
    expect(() => encodeCosappArchive(result, new Map())).toThrow(/Missing photo/);
  });
});

describe("buildCosappDownload", () => {
  it("fetches photos in batches and drops photos whose files vanished", async () => {
    const result = convert();
    const calls: string[][] = [];
    const action = vi.fn(async (_ref: unknown, args: { storageIds?: string[] }) => {
      if (!args.storageIds) return result;
      calls.push(args.storageIds);
      return args.storageIds.map((storageId) => ({
        storageId,
        bytes:
          storageId === "s-ref"
            ? null
            : storageId === "s-proc"
              ? new TextEncoder().encode("<html>not a photo</html>").buffer
              : new Uint8Array([0xff, 0xd8, 0xff, 9]).buffer,
      }));
    });
    const progress: [number, number][] = [];
    const download = await buildCosappDownload({ action } as unknown as CosappExportClient, {
      now: new Date(NOW),
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(download.fileName).toBe("kyarafit-for-cosapp-2026-11-03.cosapp");
    expect(calls.flat().sort()).toEqual(result.photoFiles.map((f) => f.storageId).sort());
    expect(progress.at(-1)).toEqual([calls.length, calls.length]);
    const archive = decodeBackup(download.bytes);
    assertStoreConstraints(archive.data.rows);
    const ids = archive.data.rows.photos.map((p) => p.id);
    expect(ids).not.toContain("ky-ph-r-r1");
    expect(ids).not.toContain("ky-ph-g-g1");
    expect(download.receipt.counts.photoFiles).toBe(4);
    expect(dropped({ receipt: download.receipt } as CosappExport, "missingImage")).toBe(2);
    expect(dropped({ receipt: download.receipt } as CosappExport, "unsupportedImage")).toBe(2);
  });
});
