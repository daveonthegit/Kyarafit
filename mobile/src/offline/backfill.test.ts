import { describe, it, expect, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName, makeFunctionReference } from "convex/server";
import {
  runUpgradeBackfill,
  BACKFILL_CHUNK_SIZE,
  type BackfillDeps,
  type BackfillProgress,
} from "./backfill";
import { runBackfill } from "./syncWorker";

/**
 * REQ-D95 upgrade backfill (client) — mobile mirror of web's `backfill.test.ts`. The Convex-facing
 * `runBackfill` wrapper reaches SQLite via `./db`; it is mocked to throw so tests exercise the
 * injected deps + the paid/free gate without a real store.
 */
vi.mock("./db", () => ({
  getOfflineDb: () => {
    throw new Error("db unavailable in unit test");
  },
}));

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: null,
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
}));

function makeDeps(
  rowsByTable: Record<string, number>,
  opts: { complete?: boolean } = {}
): { deps: BackfillDeps; pushed: { table: string; count: number }[]; isComplete: () => boolean } {
  let complete = opts.complete ?? false;
  const pushed: { table: string; count: number }[] = [];
  const deps: BackfillDeps = {
    listLocalRows: (table) =>
      Array.from({ length: rowsByTable[table] ?? 0 }, (_, i) => ({
        clientId: `local:${table}:${i}`,
        name: `${table}-${i}`,
      })),
    pushChunk: async (table, rows) => {
      pushed.push({ table, count: rows.length });
      return {
        table,
        total: rows.length,
        inserted: rows.length,
        skipped: 0,
        cloudCount: rows.length,
      };
    },
    isComplete: () => complete,
    markComplete: () => {
      complete = true;
    },
  };
  return { deps, pushed, isComplete: () => complete };
}

describe("runUpgradeBackfill (REQ-D95 upgrade backfill client)", () => {
  it("should_push_all_local_rows_in_chunks_and_report_progress_to_completion", async () => {
    const total = BACKFILL_CHUNK_SIZE + 3;
    const progress: BackfillProgress[] = [];
    const { deps, pushed } = makeDeps({ builds: total });
    deps.onProgress = (p) => progress.push({ ...p });

    const result = await runUpgradeBackfill(deps);

    expect(pushed).toEqual([
      { table: "builds", count: BACKFILL_CHUNK_SIZE },
      { table: "builds", count: 3 },
    ]);
    expect(result).toEqual({ running: false, done: total, total });
    expect(progress.at(-1)).toEqual({ running: false, done: total, total });
  });

  it("should_mark_complete_and_make_zero_calls_when_there_are_no_local_rows", async () => {
    const { deps, pushed, isComplete } = makeDeps({});
    await runUpgradeBackfill(deps);
    expect(pushed).toEqual([]);
    expect(isComplete()).toBe(true);
  });

  it("should_be_a_no_op_when_already_marked_complete", async () => {
    const { deps, pushed } = makeDeps({ builds: 5 }, { complete: true });
    await runUpgradeBackfill(deps);
    expect(pushed).toEqual([]);
  });
});

describe("runBackfill (REQ-D95 upgrade backfill trigger)", () => {
  it("should_make_zero_convex_calls_for_a_free_or_signed_out_user", async () => {
    const mutation = vi.fn(() => Promise.resolve(null));
    const client = { mutation } as unknown as ConvexReactClient;
    const { deps, pushed } = makeDeps({ builds: 3 });

    expect(await runBackfill(client, "FREE", deps)).toEqual({ running: false, done: 0, total: 0 });
    expect(await runBackfill(client, null, deps)).toEqual({ running: false, done: 0, total: 0 });
    expect(await runBackfill(client, undefined, deps)).toEqual({
      running: false,
      done: 0,
      total: 0,
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(pushed).toEqual([]);
  });

  it("should_push_rows_via_backfillRows_for_a_paid_user", async () => {
    const calls: { fn: string; args: unknown }[] = [];
    const mutation = vi.fn((ref: unknown, args: unknown) => {
      calls.push({ fn: getFunctionName(ref as never), args });
      const rows = (args as { rows: unknown[] }).rows;
      return Promise.resolve({
        table: "builds",
        total: rows.length,
        inserted: rows.length,
        skipped: 0,
        cloudCount: rows.length,
      });
    });
    const client = { mutation } as unknown as ConvexReactClient;

    // Real deps would read SQLite (mocked to throw); inject deps whose pushChunk uses the client.
    let complete = false;
    const deps: BackfillDeps = {
      listLocalRows: (table) =>
        table === "builds" ? [{ clientId: "local:b1", name: "Aerith" }] : [],
      pushChunk: (table, rows) =>
        client.mutation(makeFunctionReference<"mutation">("tierTransition:backfillRows"), {
          table,
          rows,
        } as never) as Promise<never>,
      isComplete: () => complete,
      markComplete: () => {
        complete = true;
      },
    };

    const result = await runBackfill(client, "PRO", deps);

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("tierTransition:backfillRows");
    expect(result).toEqual({ running: false, done: 1, total: 1 });
    expect(complete).toBe(true);
  });
});
