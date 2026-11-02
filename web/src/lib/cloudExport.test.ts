import { describe, it, expect, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { fetchCloudCollections, mergeCollections, type CloudExportClient } from "./cloudExport";
import { buildDataBundle, emptyCollections, parseDataBundle } from "./dataPortability";

// ADR-0006: web edits live on the server, so the export must carry the account's server rows.

type Args = Record<string, unknown>;
type Respond = (name: string, args: Args) => unknown;

function fakeClient(respond: Respond) {
  const query = vi.fn(async (ref: FunctionReference<"query">, args: Args = {}) => {
    const value = respond(getFunctionName(ref), args);
    if (value instanceof Error) throw value;
    return value;
  });
  return { client: { query } as unknown as CloudExportClient, query };
}

const taskAttachment = {
  _id: "att1",
  userId: "u1",
  workflowItemId: "w1",
  entityType: "build",
  entityId: "b1",
  entityKey: "build:b1",
  role: "primary",
};

const treeNode = (row: Args, children: Args[] = []) => ({
  attachments: [],
  dependencies: [],
  blockedByCount: 0,
  isBlocked: false,
  progressPercent: 0,
  childCount: children.length,
  ...row,
  children,
});

const accountRows: Record<string, unknown> = {
  "builds:list": [
    {
      _id: "b1",
      userId: "u1",
      name: "Aerith",
      status: "wip",
      shareToken: "secret-link",
      tasksTotal: 2,
      tasksChecked: 0,
      workflowProgressPercent: 0,
      packingProgressPercent: 0,
      nodeProgressPercent: 0,
      totalCostCents: 1200,
    },
    { _id: "b2", userId: "u1", name: "Tifa", status: "planned" },
  ],
  "conventions:list": [{ _id: "c1", userId: "u1", name: "Anime Expo" }],
  "cosplayNodes:list": [
    {
      _id: "n1",
      userId: "u1",
      name: "Wig",
      tags: [],
      overallBucket: "incomplete",
      progressPercent: 0,
      totalCostCents: 1200,
      childCount: 0,
      hasIncompleteDescendants: false,
    },
  ],
  "workflow:listPlanner": [
    { _id: "w1", title: "Sew dress", progressPercent: 50 },
    {
      _id: "w2",
      title: "Book hotel",
      kind: "task",
      status: "not_started",
      conventionId: "c1",
      conventionName: "Anime Expo",
      overdue: false,
      blockedByCount: 0,
      blockedByTitles: [],
      progressPercent: 0,
    },
  ],
};

const respondAccount: Respond = (name, args) => {
  if (name === "workflow:listBuildTree") {
    if (args.buildId === "b1") {
      return {
        buildId: "b1",
        stats: {},
        items: [
          treeNode({ _id: "g1", userId: "u1", title: "Dress", kind: "group" }, [
            treeNode({
              _id: "w1",
              userId: "u1",
              title: "Sew dress",
              notes: "Pink fabric",
              kind: "task",
              parentId: "g1",
              attachments: [taskAttachment],
            }),
          ]),
        ],
      };
    }
    // The same shared task under a second build is exported once.
    return { buildId: args.buildId, stats: {}, items: [treeNode({ _id: "w1", title: "Dup" })] };
  }
  if (name === "conventions:getPacking") {
    return [{ _id: "p1", userId: "u1", conventionId: args.conventionId, label: "Wig" }];
  }
  if (!(name in accountRows)) throw new Error(`unexpected query ${name}`);
  return accountRows[name];
};

describe("fetchCloudCollections", () => {
  it("collects every portable collection from the account's server rows", async () => {
    const { client } = fakeClient(respondAccount);
    const collections = await fetchCloudCollections(client);

    expect(collections.builds).toEqual([
      { _id: "b1", id: "b1", userId: "u1", name: "Aerith", status: "wip" },
      { _id: "b2", id: "b2", userId: "u1", name: "Tifa", status: "planned" },
    ]);
    expect(collections.conventions).toEqual([
      { _id: "c1", id: "c1", userId: "u1", name: "Anime Expo" },
    ]);
    expect(collections.packingListItems).toEqual([
      { _id: "p1", id: "p1", userId: "u1", conventionId: "c1", label: "Wig" },
    ]);
    expect(collections.cosplayNodes).toEqual([
      { _id: "n1", id: "n1", userId: "u1", name: "Wig", tags: [] },
    ]);

    // Build trees are flattened to full rows with their attachment rows, minus tree-only fields.
    expect(collections.workflowItems.map((row) => row.id)).toEqual(["g1", "w1", "w2"]);
    expect(collections.workflowItems[1]).toEqual({
      _id: "w1",
      id: "w1",
      userId: "u1",
      title: "Sew dress",
      notes: "Pink fabric",
      kind: "task",
      parentId: "g1",
      attachments: [taskAttachment],
    });
    // A planner-only task keeps its stored fields and its link as an attachment.
    expect(collections.workflowItems[2]).toEqual({
      _id: "w2",
      id: "w2",
      title: "Book hotel",
      kind: "task",
      status: "not_started",
      attachments: [{ entityType: "convention", entityId: "c1" }],
    });
  });

  it("never exports a build's share-link token", async () => {
    const { client } = fakeClient(respondAccount);
    const [build] = (await fetchCloudCollections(client)).builds;
    expect(build).not.toHaveProperty("shareToken");
  });

  it("produces a bundle the importer reads back", async () => {
    const { client } = fakeClient(respondAccount);
    const restored = parseDataBundle(buildDataBundle(await fetchCloudCollections(client)));
    expect(restored.builds.map((row) => row.name)).toEqual(["Aerith", "Tifa"]);
    expect(restored.workflowItems.find((row) => row.id === "w1")?.attachments).toEqual([
      taskAttachment,
    ]);
  });

  it("runs per-build tree queries a few at a time and reports progress", async () => {
    const builds = Array.from({ length: 10 }, (_, index) => ({ _id: `b${index}`, name: "B" }));
    let inFlight = 0;
    let maxInFlight = 0;
    const { client, query } = fakeClient(() => undefined);
    query.mockImplementation(async (ref: FunctionReference<"query">) => {
      const name = getFunctionName(ref);
      if (name === "builds:list") return builds;
      if (name !== "workflow:listBuildTree") return [];
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { items: [] };
    });
    const progress: Array<[number, number]> = [];

    await fetchCloudCollections(client, {
      concurrency: 3,
      onProgress: (done, total) => progress.push([done, total]),
    });

    const treeCalls = query.mock.calls.filter(
      ([ref]) => getFunctionName(ref) === "workflow:listBuildTree"
    );
    expect(treeCalls.map(([, args]) => args)).toEqual(builds.map(({ _id }) => ({ buildId: _id })));
    expect(maxInFlight).toBe(3);
    expect(progress[0]).toEqual([0, 10]);
    expect(progress.at(-1)).toEqual([10, 10]);
  });

  it("rejects when one build's tree query fails, so no partial export is produced", async () => {
    const { client } = fakeClient((name, args) =>
      name === "workflow:listBuildTree" && args.buildId === "b2"
        ? new Error("Too many reads")
        : respondAccount(name, args)
    );
    await expect(fetchCloudCollections(client)).rejects.toThrow("Too many reads");
  });

  it("rejects when an account-wide query fails", async () => {
    const { client } = fakeClient((name, args) =>
      name === "workflow:listPlanner" ? new Error("Not authenticated") : respondAccount(name, args)
    );
    await expect(fetchCloudCollections(client)).rejects.toThrow("Not authenticated");
  });
});

describe("mergeCollections", () => {
  it("adds local-only rows and lets the server copy win for a shared id", () => {
    const server = emptyCollections();
    server.builds = [{ id: "b1", name: "Aerith (server)" }];
    const local = emptyCollections();
    local.builds = [
      { id: "b1", name: "Aerith (stale local)" },
      { id: "local-b9", name: "Offline draft" },
    ];
    local.conventions = [{ id: "local-c1", name: "Local con" }];

    const merged = mergeCollections(server, local);

    expect(merged.builds).toEqual([
      { id: "b1", name: "Aerith (server)" },
      { id: "local-b9", name: "Offline draft" },
    ]);
    expect(merged.conventions).toEqual([{ id: "local-c1", name: "Local con" }]);
    expect(merged.workflowItems).toEqual([]);
  });
});
