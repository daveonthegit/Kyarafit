import { describe, expect, it, vi } from "vitest";
import { importBundle, type ExportableRow } from "@kyarafit/design-system/domain/importExport";
import {
  buildDataBundle,
  countRows,
  emptyCollections,
  MalformedBundleError,
  NonEmptyVaultError,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
  runImport,
  summarizeTotals,
  toExportableRows,
  type PortableCollections,
} from "./dataPortability";

function backup(): PortableCollections {
  return {
    ...emptyCollections(),
    builds: [{ id: "b", name: "Build" }],
    conventions: [{ id: "c", name: "Convention" }],
    cosplayNodes: [
      { id: "m", name: "Material", nodeType: "material", parentNodeId: "n" },
      { id: "n", name: "Element", nodeType: "element", buildId: "b", purchaseStatus: "to_buy" },
    ],
    packingListItems: [{ id: "p", conventionId: "c", buildId: "b", workflowItemId: "pack-task" }],
    workflowItems: [
      { id: "group", title: "Group", kind: "group" },
      { id: "buy", title: "Buy element", parentId: "group", status: "done",
        dedupeKey: "autogen:buy:shared:n", attachments: [
          { entityType: "cosplayNode", entityId: "n", role: "progress_source", buildContextId: "b" },
        ] },
      { id: "pack-task", title: "Pack", parentId: "buy", dedupeKey: "packing:p", attachments: [
        { entityType: "packingItem", entityId: "p", role: "primary" },
        { entityType: "convention", entityId: "c", role: "context" },
        { entityType: "build", entityId: "b", role: "context" },
      ] },
    ],
  };
}

describe("portable archive", () => {
  it("exports all collections and preserves element-generated task relationships", () => {
    const input = backup();
    const serialized = buildDataBundle(input, 0);
    expect(parseDataBundle(serialized)).toEqual(input);
    const wrapper = JSON.parse(serialized) as { collections: Record<string, string> };
    for (const key of PORTABLE_COLLECTIONS) expect(importBundle(wrapper.collections[key])).toEqual(input[key]);
    expect(countRows(input)).toBe(8);
    expect(countRows(emptyCollections())).toBe(0);
  });

  it("records the wrapper version, bundle version, and export timestamp", () => {
    const wrapper = JSON.parse(buildDataBundle(emptyCollections(), 0)) as {
      version: number; bundleVersion: number; exportedAt: string;
    };
    expect(wrapper.version).toBe(1);
    expect(wrapper.bundleVersion).toBe(1);
    expect(wrapper.exportedAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("converts document identities without dropping fields", () => {
    expect(toExportableRows([{ _id: "node", name: "Wig" }])).toEqual([
      { _id: "node", id: "node", name: "Wig" },
    ]);
  });

  it("preserves rows that already use portable IDs", () => {
    expect(toExportableRows([{ id: "portable", name: "Wig" }])).toEqual([{ id: "portable", name: "Wig" }]);
  });

  it.each([
    "not json",
    "{}",
    JSON.stringify({ version: 1, bundleVersion: 1, collections: { builds: "broken" } }),
    JSON.stringify({ version: 1, bundleVersion: 1, collections: {
      builds: JSON.stringify({ version: 1, rows: [{ name: "missing ID" }] }),
    } }),
  ])(
    "rejects malformed archives",
    (input) => expect(() => parseDataBundle(input)).toThrow(MalformedBundleError)
  );
});

describe("empty-vault restore", () => {
  it.each(PORTABLE_COLLECTIONS)("refuses existing %s rows without writing anything", async (key) => {
    const existing = emptyCollections();
    existing[key] = [{ id: "existing" }];
    const createRow = vi.fn();
    await expect(runImport({ imported: backup(), existing, createRow })).rejects.toThrow(NonEmptyVaultError);
    expect(createRow).not.toHaveBeenCalled();
  });

  it("restores the complete archive and updates generated tasks rather than duplicating them", async () => {
    const calls: { collection: string; row: ExportableRow; existingId?: string }[] = [];
    const summary = await runImport({
      imported: parseDataBundle(buildDataBundle(backup())),
      existing: emptyCollections(),
      generatedWorkflow: async () => [{ id: "generated-buy", dedupeKey: "autogen:buy:shared:new:n" }],
      createRow: (collection, row, existingId) => {
        calls.push({ collection, row, existingId });
        if (collection === "packingListItems") return { _id: "new:p", workflowItemId: "generated-pack" };
        return existingId ?? `new:${row.id}`;
      },
    });
    expect(summarizeTotals(summary)).toEqual({ added: 8, skipped: 0 });
    expect(calls.map(({ row }) => row.id)).toEqual(["b", "c", "n", "m", "p", "group", "buy", "pack-task"]);
    expect(calls.find(({ row }) => row.id === "m")?.row.parentNodeId).toBe("new:n");
    expect(calls.find(({ row }) => row.id === "n")?.row.buildId).toBe("new:b");
    expect(calls.find(({ row }) => row.id === "buy")).toMatchObject({
      existingId: "generated-buy",
      row: { parentId: "new:group", status: "done", dedupeKey: "autogen:buy:shared:new:n", attachments: [
        { entityType: "cosplayNode", entityId: "new:n", role: "progress_source", buildContextId: "new:b" },
      ] },
    });
    expect(calls.find(({ row }) => row.id === "pack-task")).toMatchObject({
      existingId: "generated-pack",
      row: { parentId: "generated-buy", dedupeKey: "packing:new:p", attachments: [
        { entityType: "packingItem", entityId: "new:p" },
        { entityType: "convention", entityId: "new:c" },
        { entityType: "build", entityId: "new:b" },
      ] },
    });
  });

  it("matches shared and build-scoped generated buy/work identities independently", async () => {
    const matched: (string | undefined)[] = [];
    await runImport({
      imported: {
        ...emptyCollections(), builds: [{ id: "b" }], cosplayNodes: [{ id: "n", nodeType: "element", buildId: "b" }],
        workflowItems: [
          { id: "shared-buy", dedupeKey: "autogen:buy:shared:n" },
          { id: "build-buy", dedupeKey: "autogen:buy:b:n" },
          { id: "work", dedupeKey: "autogen:wip:b:n", parentId: "shared-buy" },
        ],
      },
      existing: emptyCollections(),
      generatedWorkflow: async () => [
        { id: "generated-shared-buy", dedupeKey: "autogen:buy:shared:new:n" },
        { id: "generated-build-buy", dedupeKey: "autogen:buy:new:b:new:n" },
        { id: "generated-work", dedupeKey: "autogen:wip:shared:new:n" },
      ],
      createRow: (key, row, id) => {
        if (key !== "workflowItems") return `new:${row.id}`;
        matched.push(id);
        if (row.id === "work") expect(row.parentId).toBe("generated-shared-buy");
        return id;
      },
    });
    expect(matched).toEqual(["generated-shared-buy", "generated-build-buy", "generated-work"]);
  });

  it.each([
    { attachments: [{ entityType: "cosplayNode", entityId: "missing" }] },
    { attachments: [{ entityType: "cosplayNode", entityId: "b" }] },
    { attachments: [{ entityType: "unsupported", entityId: "b" }] },
    { attachments: [{ entityType: "build" }] },
    { attachments: "invalid" },
    { dueDate: "not-a-date" },
    { parentId: "task" },
    { parentId: "missing" },
    { notes: "x".repeat(10_001) },
  ])("validates the whole archive before any create", async (fields) => {
    const createRow = vi.fn();
    await expect(runImport({
      imported: { ...emptyCollections(), builds: [{ id: "b" }], workflowItems: [{ id: "task", ...fields }] },
      existing: emptyCollections(), createRow,
    })).rejects.toThrow(MalformedBundleError);
    expect(createRow).not.toHaveBeenCalled();
  });

  it.each(["cycle", "type"])("rejects invalid element parents: %s", async (kind) => {
    const createRow = vi.fn();
    await expect(runImport({
      imported: {
        ...emptyCollections(), builds: [{ id: "b" }],
        cosplayNodes: [
          { id: "parent", nodeType: kind === "type" ? "material" : "element", parentNodeId: kind === "cycle" ? "child" : undefined },
          { id: "child", nodeType: "element", parentNodeId: "parent" },
        ],
      },
      existing: emptyCollections(), createRow,
    })).rejects.toThrow(MalformedBundleError);
    expect(createRow).not.toHaveBeenCalled();
  });
});
