import { describe, it, expect, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { fetchCloudCollections, mergeCollections, type CloudExportClient } from "./cloudExport";
import { buildDataBundle, emptyCollections, parseDataBundle } from "./dataPortability";

type Args = Record<string, unknown>;
function fakeClient(respond: (name: string, args: Args) => unknown) {
  const query = vi.fn(async (ref: FunctionReference<"query">, args: Args = {}) => {
    const value = respond(getFunctionName(ref), args);
    if (value instanceof Error) throw value;
    return value;
  });
  return { client: { query } as unknown as CloudExportClient, query };
}

const workflow = [
  { _id: "g1", userId: "u1", title: "Travel", kind: "group", attachments: [], dependencies: [] },
  {
    _id: "w1", userId: "u1", title: "Book hotel", kind: "task", parentId: "g1",
    notes: "Near the venue", reminders: [{ kind: "date", date: "2026-11-01" }],
    attachments: [{ _id: "a1", entityType: "convention", entityId: "c1", role: "primary" }],
    dependencies: [{ _id: "d1", predecessorWorkflowItemId: "w2", successorWorkflowItemId: "w1", relationKind: "finish_to_start" }],
  },
];
const account: Record<string, unknown> = {
  "builds:list": [{ _id: "b1", name: "Aerith", shareToken: "secret", tasksTotal: 2 }],
  "conventions:list": [{ _id: "c1", name: "Anime Expo" }],
  "cosplayNodes:list": [{ _id: "n1", name: "Wig", progressPercent: 0 }],
  "workflow:listForExport": workflow,
  "conventions:getPacking": [{ _id: "p1", conventionId: "c1", label: "Wig" }],
};

describe("fetchCloudCollections", () => {
  it("preserves complete non-build tasks, groups and relationships through bundle export", async () => {
    const { client } = fakeClient((name) => account[name]);
    const collections = await fetchCloudCollections(client);
    const restored = parseDataBundle(buildDataBundle(collections));
    expect(restored.workflowItems).toEqual(workflow.map((row) => ({ ...row, id: row._id })));
    expect(collections.builds).toEqual([{ _id: "b1", id: "b1", name: "Aerith" }]);
    expect(collections.conventions).toEqual([{ _id: "c1", id: "c1", name: "Anime Expo" }]);
    expect(collections.cosplayNodes).toEqual([{ _id: "n1", id: "n1", name: "Wig" }]);
    expect(collections.packingListItems).toEqual([{ _id: "p1", id: "p1", conventionId: "c1", label: "Wig" }]);
  });

  it("bounds packing queries to six workers through the default interface", async () => {
    const conventions = Array.from({ length: 10 }, (_, index) => ({ _id: `c${index}` }));
    let inFlight = 0;
    let maximum = 0;
    const { client, query } = fakeClient(() => []);
    query.mockImplementation(async (ref: FunctionReference<"query">) => {
      const name = getFunctionName(ref);
      if (name === "conventions:list") return conventions;
      if (name !== "conventions:getPacking") return [];
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return [];
    });
    const progress: Array<[number, number]> = [];
    await fetchCloudCollections(client, { onProgress: (done, total) => progress.push([done, total]) });
    expect(maximum).toBe(6);
    expect(query.mock.calls.filter(([ref]) => getFunctionName(ref) === "conventions:getPacking").map(([, args]) => args)).toEqual(conventions.map(({ _id }) => ({ conventionId: _id })));
    expect(progress[0]).toEqual([0, 10]);
    expect(progress.at(-1)).toEqual([10, 10]);
  });

  it.each(["workflow:listForExport", "conventions:getPacking"])("rejects rather than exporting partial data when %s fails", async (failed) => {
    const { client } = fakeClient((name) => name === failed ? new Error("Read failed") : account[name]);
    await expect(fetchCloudCollections(client)).rejects.toThrow("Read failed");
  });
});

describe("mergeCollections", () => {
  it("retains local-only rows and prefers server rows for shared ids", () => {
    const server = emptyCollections();
    server.builds = [{ id: "b1", name: "Server" }];
    const local = emptyCollections();
    local.builds = [{ id: "b1", name: "Stale" }, { id: "b2", name: "Draft" }];
    expect(mergeCollections(server, local).builds).toEqual([{ id: "b1", name: "Server" }, { id: "b2", name: "Draft" }]);
  });
});
