import { describe, it, expect, vi } from "vitest";
import {
  runUpgradeBackfill,
  BACKFILL_CHUNK_SIZE,
  type BackfillDeps,
  type BackfillProgress,
} from "./backfill";

/** Build deps over an in-memory per-table row set + a mutable completion flag. */
function makeDeps(
  rowsByTable: Record<string, number>,
  opts: { complete?: boolean } = {}
): {
  deps: BackfillDeps;
  pushed: Array<{ table: string; count: number }>;
  progress: BackfillProgress[];
  isComplete: () => boolean;
} {
  let complete = opts.complete ?? false;
  const pushed: Array<{ table: string; count: number }> = [];
  const progress: BackfillProgress[] = [];
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
    onProgress: (p) => progress.push({ ...p }),
  };
  return { deps, pushed, progress, isComplete: () => complete };
}

// Spec: DATA_AND_SYNC.md §10 (REQ-D95 client glue).
describe("runUpgradeBackfill (REQ-D95 upgrade backfill client)", () => {
  it("should_push_all_local_rows_in_chunks_and_report_progress_to_completion", async () => {
    const total = BACKFILL_CHUNK_SIZE * 2 + 5; // 205 -> 3 chunks in one table
    const { deps, pushed, progress } = makeDeps({ builds: total, conventions: 1 });

    const result = await runUpgradeBackfill(deps);

    // builds: 100 + 100 + 5, conventions: 1 -> 4 chunked calls.
    expect(pushed).toEqual([
      { table: "builds", count: BACKFILL_CHUNK_SIZE },
      { table: "builds", count: BACKFILL_CHUNK_SIZE },
      { table: "builds", count: 5 },
      { table: "conventions", count: 1 },
    ]);
    expect(result).toEqual({ running: false, done: total + 1, total: total + 1 });
    // Final progress event reports done === total and running=false.
    const last = progress.at(-1)!;
    expect(last).toEqual({ running: false, done: total + 1, total: total + 1 });
    // Progress is monotonic up to the total.
    expect(progress.every((p) => p.done <= p.total)).toBe(true);
  });

  it("should_forward_the_clientId_bearing_rows_to_the_server", async () => {
    const forwarded: Array<Record<string, unknown>> = [];
    const { deps } = makeDeps({ builds: 2 });
    const spyDeps: BackfillDeps = {
      ...deps,
      pushChunk: async (table, rows) => {
        forwarded.push(...rows);
        return {
          table,
          total: rows.length,
          inserted: rows.length,
          skipped: 0,
          cloudCount: rows.length,
        };
      },
    };
    await runUpgradeBackfill(spyDeps);
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0]).toMatchObject({ clientId: "local:builds:0" });
  });

  it("should_mark_complete_and_make_zero_calls_when_there_are_no_local_rows", async () => {
    const { deps, pushed, isComplete } = makeDeps({});
    const result = await runUpgradeBackfill(deps);
    expect(pushed).toEqual([]);
    expect(isComplete()).toBe(true);
    expect(result).toEqual({ running: false, done: 0, total: 0 });
  });

  it("should_be_a_no_op_when_the_device_is_already_marked_complete", async () => {
    const { deps, pushed } = makeDeps({ builds: 50 }, { complete: true });
    const push = vi.spyOn(deps, "listLocalRows");
    const result = await runUpgradeBackfill(deps);
    expect(pushed).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(result).toEqual({ running: false, done: 0, total: 0 });
  });

  it("should_be_idempotent_when_re_run_after_completion", async () => {
    const { deps, pushed } = makeDeps({ builds: 3 });
    await runUpgradeBackfill(deps); // 1st run pushes + marks complete
    const afterFirst = pushed.length;
    await runUpgradeBackfill(deps); // 2nd run respects the marker -> no more calls
    expect(pushed.length).toBe(afterFirst);
    expect(afterFirst).toBe(1);
  });
});
