import { describe, expect, it, vi } from "vitest";
import { runUpgradeBackfill, type BackfillDeps } from "./backfill";

type Row = Record<string, unknown> & { clientId: string };
function fixture(rows: Record<string, Row[]>) {
  const calls: { table: string; rows: Record<string, unknown>[] }[] = [];
  const markComplete = vi.fn();
  const deps: BackfillDeps = {
    listLocalRows: (table) => rows[table] ?? [],
    isComplete: () => false,
    markComplete,
    pushChunk: async (table, chunk) => {
      calls.push({ table, rows: chunk });
      return {
        table,
        total: chunk.length,
        inserted: chunk.length,
        skipped: 0,
        cloudCount: chunk.length,
        ids: chunk.map((row) => ({
          clientId: row.clientId as string,
          id: `server:${table}:${row.clientId}`,
        })),
      };
    },
  };
  return { calls, deps, markComplete };
}

describe("upgrade backfill dependency and id mapping contract", () => {
  it("orders dependencies and remaps copies without changing local records", async () => {
    const rows = {
      builds: [{ clientId: "build", _id: "local-build", name: "Build" }],
      conventions: [{ clientId: "event", _id: "local-event" }],
      cosplayNodes: [{ clientId: "node", _id: "local-node", buildId: "local-build" }],
      workflowItems: [{ clientId: "workflow", _id: "local-workflow", ancestorIds: ["cached"] }],
      packingListItems: [
        {
          clientId: "packing",
          _id: "local-packing",
          conventionId: "local-event",
          workflowItemId: "local-workflow",
        },
      ],
      buildTasks: [
        {
          clientId: "task",
          buildId: "local-build",
          cosplayNodeId: "local-node",
          packingListItemId: "local-packing",
        },
      ],
      workflowAttachments: [
        {
          clientId: "attachment",
          workflowItemId: "local-workflow",
          entityType: "cosplayNode",
          entityId: "local-node",
          buildContextId: "local-build",
        },
      ],
      conventionDayPlans: [
        { clientId: "day", conventionId: "local-event", buildId: "local-build" },
      ],
    };
    const before = structuredClone(rows);
    const { calls, deps, markComplete } = fixture(rows);
    expect(await runUpgradeBackfill(deps)).toEqual({ running: false, done: 8, total: 8 });
    expect(calls.map((call) => call.table)).toEqual([
      "builds",
      "conventions",
      "cosplayNodes",
      "workflowItems",
      "packingListItems",
      "buildTasks",
      "workflowAttachments",
      "conventionDayPlans",
    ]);
    expect(calls[2].rows[0].buildId).toBe("server:builds:build");
    expect(calls[3].rows[0].ancestorIds).toEqual([]);
    expect(calls[4].rows[0]).toMatchObject({
      conventionId: "server:conventions:event",
      workflowItemId: "server:workflowItems:workflow",
    });
    expect(calls[5].rows[0]).toMatchObject({
      buildId: "server:builds:build",
      cosplayNodeId: "server:cosplayNodes:node",
      packingListItemId: "server:packingListItems:packing",
    });
    expect(calls[6].rows[0]).toMatchObject({
      workflowItemId: "server:workflowItems:workflow",
      entityId: "server:cosplayNodes:node",
      buildContextId: "server:builds:build",
    });
    expect(rows).toEqual(before);
    expect(markComplete).toHaveBeenCalledOnce();
  });

  it("orders a reversed hierarchy across the chunk boundary", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({
      clientId: `node-${i}`,
      ...(i ? { parentNodeId: `node-${i - 1}` } : {}),
    })).reverse();
    const { calls, deps } = fixture({ cosplayNodes: rows });
    await runUpgradeBackfill(deps);
    expect(calls.map((call) => call.rows.length)).toEqual([100, 100, 5]);
    expect(calls[0].rows[0].clientId).toBe("node-0");
    expect(calls[1].rows[0]).toMatchObject({
      clientId: "node-100",
      parentNodeId: "server:cosplayNodes:node-99",
    });
    expect(calls[2].rows[0]).toMatchObject({
      clientId: "node-200",
      parentNodeId: "server:cosplayNodes:node-199",
    });
  });

  it("accepts an older response without ids and canonicalizes local aliases for server fallback", async () => {
    const { deps, calls } = fixture({
      builds: [{ clientId: "build", _id: "local-build" }],
      cosplayNodes: [{ clientId: "node", buildId: "local-build" }],
    });
    deps.pushChunk = async (table, rows) => {
      calls.push({ table, rows });
      return {
        table,
        total: rows.length,
        inserted: rows.length,
        skipped: 0,
        cloudCount: rows.length,
      };
    };
    await runUpgradeBackfill(deps);
    expect(calls[1].rows[0].buildId).toBe("build");
  });

  it("uses ids from skipped retries after a lost response", async () => {
    const { deps, calls, markComplete } = fixture({
      builds: [{ clientId: "build" }],
      cosplayNodes: [{ clientId: "node", buildId: "build" }],
    });
    let lostResponse = true;
    deps.pushChunk = async (table, rows) => {
      calls.push({ table, rows });
      if (lostResponse) {
        lostResponse = false;
        throw new Error("lost response");
      }
      return {
        table,
        total: rows.length,
        inserted: 0,
        skipped: rows.length,
        cloudCount: rows.length,
        ids: rows.map((row) => ({
          clientId: row.clientId as string,
          id: `server:${table}:${row.clientId}`,
        })),
      };
    };
    await expect(runUpgradeBackfill(deps)).rejects.toThrow("lost response");
    expect(markComplete).not.toHaveBeenCalled();
    await runUpgradeBackfill(deps);
    expect(calls[2].rows[0].buildId).toBe("server:builds:build");
    expect(markComplete).toHaveBeenCalledOnce();
  });

  it("rejects cycles before writes and incomplete server mappings before completion", async () => {
    const cycle = fixture({
      workflowItems: [
        { clientId: "a", parentId: "b" },
        { clientId: "b", parentId: "a" },
      ],
    });
    await expect(runUpgradeBackfill(cycle.deps)).rejects.toThrow(/Cyclic/);
    expect(cycle.calls).toEqual([]);
    expect(cycle.markComplete).not.toHaveBeenCalled();
    const incomplete = fixture({ builds: [{ clientId: "build" }] });
    incomplete.deps.pushChunk = async (table) => ({
      table,
      total: 1,
      inserted: 1,
      skipped: 0,
      cloudCount: 1,
      ids: [],
    });
    await expect(runUpgradeBackfill(incomplete.deps)).rejects.toThrow(/Incomplete/);
    expect(incomplete.markComplete).not.toHaveBeenCalled();
  });

  it("splits chunks by UTF-8 bytes as well as row count", async () => {
    const { deps, calls } = fixture({
      builds: Array.from({ length: 100 }, (_, i) => ({
        clientId: `build-${i}`,
        notes: "文".repeat(9000),
      })),
    });
    await runUpgradeBackfill(deps);
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.flatMap((call) => call.rows)).toHaveLength(100);
    for (const call of calls)
      expect(new TextEncoder().encode(JSON.stringify(call.rows)).length).toBeLessThanOrEqual(
        512 * 1024
      );
  });
});
