import { describe, it, expect, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { fetchCloudCollections, mergeCollections, type CloudExportClient } from "./cloudExport";
import { buildDataBundle, emptyCollections, parseDataBundle, PORTABLE_COLLECTIONS, type PortableCollectionKey } from "./dataPortability";
import { exportRecord } from "../test/accountExportRecords";

type Args = { collection: PortableCollectionKey };
function fakeClient(respond: (args: Args) => unknown) {
  const query = vi.fn(async (ref: FunctionReference<"query">, args: Args) => {
    expect(getFunctionName(ref)).toBe("accountExport:listCollection");
    const value = respond(args);
    if (value instanceof Error) throw value;
    return value;
  });
  return { client: { query } as unknown as CloudExportClient, query };
}

describe("account archive", () => {
  it.each(PORTABLE_COLLECTIONS)("round-trips full %s records through cloud collection and bundle serialization", async (collection) => {
    const row = exportRecord(collection);
    const { client } = fakeClient((args) => args.collection === collection ? [row] : []);
    const restored = parseDataBundle(buildDataBundle(await fetchCloudCollections(client)));
    expect(restored[collection]).toEqual([row]);
  });

  it("includes non-build workflow groups alongside convention-only tasks and their notes", async () => {
    const task = exportRecord("workflowItems");
    const group = { id: "task-group", title: "Travel", kind: "group", notes: "Book early" };
    const { client } = fakeClient(({ collection }) => collection === "workflowItems" ? [task, group] : []);
    expect(parseDataBundle(buildDataBundle(await fetchCloudCollections(client))).workflowItems).toEqual([task, group]);
  });

  it("uses six workers through the default interface and reports every collection", async () => {
    let inFlight = 0;
    let maximum = 0;
    const { client, query } = fakeClient(() => []);
    query.mockImplementation(async () => {
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return [];
    });
    const progress: Array<[number, number]> = [];
    await fetchCloudCollections(client, { onProgress: (done, total) => progress.push([done, total]) });
    expect(maximum).toBe(6);
    expect(query.mock.calls.map(([, args]) => args.collection)).toEqual([...PORTABLE_COLLECTIONS]);
    expect(progress[0]).toEqual([0, PORTABLE_COLLECTIONS.length]);
    expect(progress.at(-1)).toEqual([PORTABLE_COLLECTIONS.length, PORTABLE_COLLECTIONS.length]);
  });

  it.each(PORTABLE_COLLECTIONS)("rejects rather than producing a partial archive when %s fails", async (failed) => {
    const { client } = fakeClient(({ collection }) => collection === failed ? new Error("Read failed") : []);
    await expect(fetchCloudCollections(client)).rejects.toThrow("Read failed");
  });

  it.each(PORTABLE_COLLECTIONS)("merges local-only %s rows and prefers the server for shared identities", (collection) => {
    const server = emptyCollections();
    server[collection] = [{ id: "shared", notes: "Server" }];
    const local = emptyCollections();
    local[collection] = [{ id: "shared", notes: "Stale" }, { id: "local", notes: "Draft" }];
    const restored = parseDataBundle(buildDataBundle(mergeCollections(server, local)));
    expect(restored[collection]).toEqual([{ id: "shared", notes: "Server" }, { id: "local", notes: "Draft" }]);
  });
});
