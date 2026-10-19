import { describe, it, expect, vi } from "vitest";
import { importBundle, type ExportableRow } from "@kyarafit/design-system/domain/importExport";
import {
  buildDataBundle,
  countRows,
  emptyCollections,
  MalformedBundleError,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
  runImport,
  summarizeTotals,
  toExportableRows,
  type CreateRowFn,
  type PortableCollections,
} from "./dataPortability";

// Spec: PRODUCT_SPEC.md §4.9 (REQ-012/095/096) + DATA_AND_SYNC.md §11 (REQ-D100/101/102). Export and
// import are FREE; bundles round-trip faithfully and re-importing is idempotent.

function sampleCollections(): PortableCollections {
  return {
    ...emptyCollections(),
    builds: [
      { id: "b1", name: "Aerith", status: "wip" },
      { id: "b2", name: "Cloud", status: "idea" },
    ],
    conventions: [{ id: "c1", name: "AnimeExpo", startDate: "2026-07-01", endDate: "2026-07-04" }],
  };
}

describe("toExportableRows", () => {
  it("maps Convex _id to a portable id while preserving other fields", () => {
    const rows = toExportableRows([{ _id: "x1", name: "Tifa", budgetCents: 5000 }]);
    expect(rows).toEqual([{ _id: "x1", id: "x1", name: "Tifa", budgetCents: 5000 }]);
  });

  it("passes through rows that already carry a string id", () => {
    const rows = toExportableRows([{ id: "k1", name: "Yuffie" }]);
    expect(rows[0].id).toBe("k1");
  });
});

describe("buildDataBundle / parseDataBundle round-trip (REQ-D102)", () => {
  it("reproduces every collection without loss", () => {
    const collections = sampleCollections();
    const serialized = buildDataBundle(collections, Date.parse("2026-06-17T00:00:00.000Z"));
    const parsed = parseDataBundle(serialized);
    expect(parsed).toEqual(collections);
  });

  it("records a wrapper version, bundle version, and ISO export timestamp", () => {
    const serialized = buildDataBundle(emptyCollections(), Date.parse("2026-06-17T12:00:00.000Z"));
    const wrapper = JSON.parse(serialized) as {
      version: number;
      bundleVersion: number;
      exportedAt: string;
      collections: Record<string, string>;
    };
    expect(wrapper.version).toBe(1);
    expect(wrapper.bundleVersion).toBe(1);
    expect(wrapper.exportedAt).toBe("2026-06-17T12:00:00.000Z");
    // Each collection is itself a serialized exportBundle string.
    for (const key of PORTABLE_COLLECTIONS) {
      expect(importBundle(wrapper.collections[key])).toEqual([]);
    }
  });
});

describe("countRows", () => {
  it("sums rows across all collections", () => {
    expect(countRows(sampleCollections())).toBe(3);
    expect(countRows(emptyCollections())).toBe(0);
  });
});

describe("parseDataBundle error handling (REQ-D101, graceful failure)", () => {
  it("throws a MalformedBundleError for non-JSON input", () => {
    expect(() => parseDataBundle("not json {")).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when the bundle shape is wrong", () => {
    expect(() => parseDataBundle(JSON.stringify({ nope: true }))).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when a collection section is malformed", () => {
    const bad = JSON.stringify({ collections: { builds: "{not a bundle" } });
    expect(() => parseDataBundle(bad)).toThrow(MalformedBundleError);
  });

  it("throws a MalformedBundleError when a row is missing a string id", () => {
    const bad = JSON.stringify({
      collections: { builds: JSON.stringify({ version: 1, rows: [{ name: "no id" }] }) },
    });
    expect(() => parseDataBundle(bad)).toThrow(MalformedBundleError);
  });
});

describe("runImport idempotency (REQ-D101)", () => {
  it.each([false, true])("validates retained element types before writes (mapped=%s)", async (mapped) => {
    const createRow = vi.fn();
    const parent = { id: "source-parent", nodeType: "element" };
    await expect(runImport({
      imported: {
        ...emptyCollections(),
        builds: [{ id: "new-build" }],
        cosplayNodes: [parent, { id: "child", nodeType: "element", parentNodeId: parent.id }],
      },
      existing: {
        ...emptyCollections(),
        cosplayNodes: [{ id: mapped ? "destination-parent" : parent.id, nodeType: "material" }],
      },
      identities: mapped ? {
        read: async (_collection, id) => id === parent.id
          ? { id: "destination-parent", complete: true, row: parent } : null,
        write: async () => undefined,
      } : undefined,
      createRow,
    })).rejects.toThrow("Invalid element parent type");
    expect(createRow).not.toHaveBeenCalled();
  });

  it("validates destination types while resuming an incomplete element attachment", async () => {
    const createRow = vi.fn();
    await expect(runImport({
      imported: {
        ...emptyCollections(),
        cosplayNodes: [
          { id: "parent", nodeType: "element" },
          { id: "child", nodeType: "element", parentNodeId: "parent" },
        ],
      },
      existing: { ...emptyCollections(), cosplayNodes: [{ id: "destination", nodeType: "material" }] },
      identities: {
        read: async (_collection, id) => id === "parent"
          ? { id: "destination", complete: false, row: { id, nodeType: "element" } } : null,
        write: async () => undefined,
      },
      createRow,
    })).rejects.toThrow("Invalid element parent type");
    expect(createRow).not.toHaveBeenCalled();
  });

  it("validates the retained child type when an archived child is skipped", async () => {
    const summary = await runImport({
      imported: {
        ...emptyCollections(),
        cosplayNodes: [
          { id: "parent", nodeType: "element" },
          { id: "child", nodeType: "element", parentNodeId: "parent" },
        ],
      },
      existing: {
        ...emptyCollections(),
        cosplayNodes: [
          { id: "parent", nodeType: "material" },
          { id: "child", nodeType: "material", parentNodeId: "parent" },
        ],
      },
      createRow: () => { throw new Error("No rows should be created"); },
    });
    expect(summary.cosplayNodes).toEqual({ added: 0, skipped: 2 });
  });
  it("reconciles buy and work tasks in shared and build scopes without losing parents", async () => {
    const restored: { id: string; parentId: unknown; existingId: string | undefined }[] = [];
    await runImport({
      imported: {
        ...emptyCollections(),
        builds: [{ id: "b" }],
        cosplayNodes: [{ id: "n", nodeType: "element", buildId: "b" }],
        workflowItems: [
          { id: "shared-buy", dedupeKey: "autogen:buy:shared:n", status: "done" },
          { id: "build-buy", dedupeKey: "autogen:buy:b:n", status: "in_progress" },
          { id: "work", dedupeKey: "autogen:wip:b:n", parentId: "shared-buy", status: "done" },
        ],
      },
      existing: emptyCollections(),
      generatedWorkflow: async () => [
        { id: "generated-shared-buy", dedupeKey: "autogen:buy:shared:new:n" },
        { id: "generated-build-buy", dedupeKey: "autogen:buy:new:b:new:n" },
        { id: "generated-work", dedupeKey: "autogen:wip:shared:new:n" },
      ],
      createRow: (collection, row, existingId) => {
        if (collection !== "workflowItems") return `new:${row.id}`;
        restored.push({ id: row.id, parentId: row.parentId, existingId });
        expect(existingId).toBeDefined();
        return existingId;
      },
    });
    expect(restored).toEqual([
      { id: "shared-buy", parentId: undefined, existingId: "generated-shared-buy" },
      { id: "build-buy", parentId: undefined, existingId: "generated-build-buy" },
      { id: "work", parentId: "generated-shared-buy", existingId: "generated-work" },
    ]);
  });

  it("round-trips elements and remaps all attachment targets before restoring tasks", async () => {
    const imported = parseDataBundle(
      buildDataBundle({
        ...emptyCollections(),
        builds: [{ id: "build" }],
        conventions: [{ id: "con" }],
        cosplayNodes: [
          { id: "child", nodeType: "material", parentNodeId: "root", tags: [] },
          { id: "root", nodeType: "element", buildId: "build", tags: [] },
        ],
        packingListItems: [
          { id: "pack", conventionId: "con", buildId: "build", workflowItemId: "task" },
        ],
        workflowItems: [
          {
            id: "task",
            attachments: [
              { entityType: "build", entityId: "build" },
              { entityType: "convention", entityId: "con" },
              { entityType: "cosplayNode", entityId: "child", buildContextId: "build" },
              { entityType: "packingItem", entityId: "pack" },
            ],
          },
        ],
      })
    );
    const calls: { collection: string; row: ExportableRow }[] = [];
    await runImport({
      imported,
      existing: emptyCollections(),
      createRow: (collection, row) => {
        calls.push({ collection, row });
        return { _id: `new:${row.id}`, workflowItemId: "new:task" };
      },
    });
    expect(calls.map(({ row }) => row.id)).toEqual(["build", "con", "root", "child", "pack", "task"]);
    expect(calls.find(({ row }) => row.id === "root")?.row.buildId).toBe("new:build");
    expect(calls.find(({ row }) => row.id === "child")?.row.parentNodeId).toBe("new:root");
    expect(calls[calls.length - 1]?.row.attachments).toEqual([
      expect.objectContaining({ entityType: "build", entityId: "new:build" }),
      expect.objectContaining({ entityType: "convention", entityId: "new:con" }),
      expect.objectContaining({
        entityType: "cosplayNode",
        entityId: "new:child",
        buildContextId: "new:build",
      }),
      expect.objectContaining({ entityType: "packingItem", entityId: "new:pack" }),
    ]);
  });

  it.each([
    { attachments: [{ entityType: "cosplayNode", entityId: "missing" }] },
    { attachments: [{ entityType: "cosplayNode", entityId: "build" }] },
    { attachments: [{ entityType: "unsupported", entityId: "build" }] },
    { attachments: [{ entityType: "build" }] },
    { attachments: "invalid" },
    { dueDate: "not-a-date" },
    { parentId: "task" },
    { parentId: "missing" },
  ])("rejects invalid late workflow relationships before writing: %j", async (fields) => {
    const createRow = vi.fn();
    await expect(
      runImport({
        imported: {
          ...emptyCollections(),
          builds: [{ id: "build" }],
          workflowItems: [{ id: "task", ...fields }],
        },
        existing: emptyCollections(),
        createRow,
      })
    ).rejects.toThrow(MalformedBundleError);
    expect(createRow).not.toHaveBeenCalled();
  });

  it("validates late collection field limits before writing earlier collections", async () => {
    const createRow = vi.fn();
    await expect(runImport({
      imported: {
        ...emptyCollections(),
        builds: [{ id: "build" }],
        workflowItems: [{ id: "task", notes: "x".repeat(10_001) }],
      },
      existing: emptyCollections(),
      createRow,
    })).rejects.toThrow(MalformedBundleError);
    expect(createRow).not.toHaveBeenCalled();
  });

  it("rejects cyclic element parents before creating even the first build", async () => {
    const createRow = vi.fn();
    await expect(
      runImport({
        imported: {
          ...emptyCollections(),
          builds: [{ id: "build" }],
          cosplayNodes: [
            { id: "a", nodeType: "element", parentNodeId: "b" },
            { id: "b", nodeType: "element", parentNodeId: "a" },
          ],
        },
        existing: emptyCollections(),
        createRow,
      })
    ).rejects.toThrow("cyclic");
    expect(createRow).not.toHaveBeenCalled();
  });
  it("maps tasks to an already-restored packing item's workflow identity", async () => {
    const createRow = vi.fn<CreateRowFn>((_collection, _row, existingId) => existingId);
    await runImport({
      imported: {
        ...emptyCollections(),
        conventions: [{ id: "con" }],
        packingListItems: [{ id: "pack", conventionId: "con", workflowItemId: "source-task" }],
        workflowItems: [{ id: "source-task" }],
      },
      existing: {
        ...emptyCollections(),
        conventions: [{ id: "con" }],
        packingListItems: [{ id: "pack", conventionId: "con", workflowItemId: "actual-task" }],
      },
      createRow,
    });
    expect(createRow).toHaveBeenCalledExactlyOnceWith(
      "workflowItems",
      expect.objectContaining({ id: "source-task" }),
      "actual-task"
    );
  });
  it("restores packing before updating its automatically created workflow task", async () => {
    const imported = {
      ...emptyCollections(),
      conventions: [{ id: "con" }],
      packingListItems: [
        { id: "pack", conventionId: "con", workflowItemId: "task", label: "Tape" },
      ],
      workflowItems: [
        {
          id: "task",
          title: "Pack Tape",
          attachments: [{ entityType: "packingItem", entityId: "pack", role: "primary" }],
        },
      ],
    };
    const calls: { collection: string; row: ExportableRow; existingId?: string }[] = [];
    await runImport({
      imported,
      existing: emptyCollections(),
      createRow: (collection, row, existingId) => {
        calls.push({ collection, row, existingId });
        if (collection === "packingListItems")
          return { _id: "new-pack", workflowItemId: "new-task" };
        return existingId ?? `new-${row.id}`;
      },
    });
    expect(calls.map((call) => call.collection)).toEqual([
      "conventions",
      "packingListItems",
      "workflowItems",
    ]);
    expect(calls[2]).toMatchObject({
      existingId: "new-task",
      row: { attachments: [{ entityId: "new-pack" }] },
    });
  });
  it("remaps convention, build, workflow parent and attachment relationships", async () => {
    const imported = {
      ...emptyCollections(),
      builds: [{ id: "b" }],
      conventions: [{ id: "c" }],
      workflowItems: [
        {
          id: "child",
          parentId: "parent",
          attachments: [
            { entityType: "build", entityId: "b", role: "primary", buildContextId: "b" },
          ],
        },
        { id: "parent" },
      ],
      packingListItems: [{ id: "p", conventionId: "c", buildId: "b" }],
    };
    const created: Record<string, ExportableRow> = {};
    await runImport({
      imported,
      existing: emptyCollections(),
      createRow: (_collection, row) => {
        created[row.id] = row;
        return { _id: `restored:${row.id}` };
      },
    });
    expect(created.p).toMatchObject({ conventionId: "restored:c", buildId: "restored:b" });
    expect(created.child).toMatchObject({
      parentId: "restored:parent",
      attachments: [{ entityId: "restored:b", buildContextId: "restored:b" }],
    });
  });
  it("creates missing rows once and never duplicates on re-import", async () => {
    const store: PortableCollections = emptyCollections();
    const createRow: CreateRowFn = vi.fn(
      (collection: keyof PortableCollections, row: ExportableRow) => {
        store[collection].push(row);
        return row.id;
      }
    );

    const bundle = buildDataBundle(sampleCollections());
    const imported = parseDataBundle(bundle);

    const first = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(first)).toEqual({ added: 3, skipped: 0 });
    expect(createRow).toHaveBeenCalledTimes(3);

    // Re-import the identical bundle against the now-populated store: nothing is created.
    const callsAfterFirst = (createRow as ReturnType<typeof vi.fn>).mock.calls.length;
    const second = await runImport({ imported, existing: store, createRow });
    expect(summarizeTotals(second)).toEqual({ added: 0, skipped: 3 });
    expect(createRow).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("only creates rows whose ids are not already present", async () => {
    const existing: PortableCollections = {
      ...emptyCollections(),
      builds: [{ id: "b1", name: "Aerith" }],
    };
    const imported: PortableCollections = {
      ...emptyCollections(),
      builds: [
        { id: "b1", name: "Aerith" },
        { id: "b3", name: "Tifa" },
      ],
    };
    const created: string[] = [];
    const createRow: CreateRowFn = (_collection, row) => {
      created.push(row.id);
      return row.id;
    };
    const summary = await runImport({ imported, existing, createRow });
    expect(created).toEqual(["b3"]);
    expect(summary.builds).toEqual({ added: 1, skipped: 1 });
  });
});
