/**
 * REQ-D95 — upgrade backfill, CLIENT orchestration (DATA_AND_SYNC.md §10).
 *
 * The sync worker only pushes NEW writes; rows a user created while FREE were never enqueued, so on
 * upgrade they must be backfilled once. This module drains the caller's local-first rows table by
 * table into the cloud via `tierTransition.backfillRows`, aggregating a done/total progress signal.
 *
 * INVARIANT: it only READS local rows and pushes COPIES to the cloud — it never mutates or deletes
 * local data. It is deduped server-side by `clientId` (idempotent, safe to re-run) and, once the
 * whole scan completes, records a per-device marker so future launches skip it.
 *
 * OFFLINE CORE: this file is pure orchestration and never imports `convex/react`. The Convex-facing
 * wiring (and the paid/free gate that preserves the REQ-D10 zero-calls-for-free invariant) lives in
 * `./syncWorker` (`runBackfill`), which is the bridge.
 */

/**
 * The user-owned, local-first tables backfill pushes into — the exact set the sync warm-up pulls and
 * the server's `LOCAL_FIRST_TABLES`. Keep in parity with `syncWorker`'s `WARMUP_TABLES`.
 */
export const BACKFILL_TABLES = [
  "closetItems",
  "cosplayNodes",
  "builds",
  "buildTasks",
  "workflowItems",
  "workflowAttachments",
  "workflowDependencies",
  "conventions",
  "conventionDayPlans",
  "packingListItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
] as const;
export type BackfillTable = (typeof BACKFILL_TABLES)[number];

/** Aggregate progress across all tables: rows pushed so far / rows to push. */
export interface BackfillProgress {
  running: boolean;
  done: number;
  total: number;
}

export const IDLE_BACKFILL: BackfillProgress = { running: false, done: 0, total: 0 };

/** Per-chunk result from `tierTransition.backfillRows`. */
export interface BackfillChunkResult {
  table: string;
  total: number;
  inserted: number;
  skipped: number;
  cloudCount: number;
}

export interface BackfillDeps {
  /**
   * Local-first rows for a table that have never reached the cloud (the unsynced base), each carrying
   * a stable `clientId` so the server can dedupe. Called once per table to snapshot a stable `total`.
   */
  listLocalRows: (table: BackfillTable) => Array<Record<string, unknown> & { clientId: string }>;
  /** Push one chunk of rows for a table to the cloud (`tierTransition.backfillRows`). */
  pushChunk: (
    table: BackfillTable,
    rows: Array<Record<string, unknown>>
  ) => Promise<BackfillChunkResult>;
  /** Persisted per-device marker: has the one-time backfill already completed? */
  isComplete: () => Promise<boolean> | boolean;
  /** Persist the completion marker so future launches skip the scan. */
  markComplete: () => Promise<void> | void;
  /** Report aggregate progress to the status UI. */
  onProgress?: (p: BackfillProgress) => void;
}

/** Rows pushed per `backfillRows` call. Bounded so a large library streams up in chunks. */
export const BACKFILL_CHUNK_SIZE = 100;

let running = false;

/**
 * Push every not-yet-synced local-first row up to the cloud in chunks, reporting done/total, then
 * mark the device complete. Single-flight (a concurrent call no-ops) and idempotent: a completed
 * device short-circuits, and the server dedupes any rows already present so a re-run is harmless.
 * A NO-OP when there is nothing to push (marks complete so the scan never repeats).
 */
export async function runUpgradeBackfill(deps: BackfillDeps): Promise<BackfillProgress> {
  if (running) return IDLE_BACKFILL;
  if (await deps.isComplete()) return IDLE_BACKFILL;
  running = true;
  try {
    // Snapshot all rows up-front so `total` is stable while chunks stream (no re-scan per chunk).
    const perTable = BACKFILL_TABLES.map((table) => ({ table, rows: deps.listLocalRows(table) }));
    const total = perTable.reduce((n, t) => n + t.rows.length, 0);
    let done = 0;
    const report = (isRunning: boolean) => deps.onProgress?.({ running: isRunning, done, total });

    if (total === 0) {
      await deps.markComplete();
      report(false);
      return { running: false, done: 0, total: 0 };
    }

    report(true);
    for (const { table, rows } of perTable) {
      for (let i = 0; i < rows.length; i += BACKFILL_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + BACKFILL_CHUNK_SIZE);
        await deps.pushChunk(table, chunk);
        done += chunk.length;
        report(true);
      }
    }
    await deps.markComplete();
    report(false);
    return { running: false, done, total };
  } finally {
    running = false;
  }
}
