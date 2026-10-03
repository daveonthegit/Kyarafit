/**
 * REQ-D95 — upgrade backfill, CLIENT orchestration (DATA_AND_SYNC.md §10). Mobile mirror of web's
 * `backfill.ts`, kept in parity.
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
  "builds",
  "conventions",
  "cosplayNodes",
  "workflowItems",
  "packingListItems",
  "buildTasks",
  "workflowAttachments",
  "workflowDependencies",
  "conventionDayPlans",
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
  /** Additive server response; absent on older backends. Includes clientId-deduped retries. */
  ids?: { clientId: string; id: string }[];
}

export interface BackfillDeps {
  /**
   * Local-first rows for a table that have never reached the cloud (the unsynced base), each carrying
   * a stable `clientId` so the server can dedupe. Called once per table to snapshot a stable `total`.
   */
  listLocalRows: (table: BackfillTable) => (Record<string, unknown> & { clientId: string })[];
  /** Push one chunk of rows for a table to the cloud (`tierTransition.backfillRows`). */
  pushChunk: (
    table: BackfillTable,
    rows: Record<string, unknown>[]
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

type LocalRow = Record<string, unknown> & { clientId: string };
type Entry = { table: BackfillTable; row: LocalRow };
const REFERENCE_TABLES: Record<string, BackfillTable> = {
  buildId: "builds",
  buildContextId: "builds",
  parentNodeId: "cosplayNodes",
  cosplayNodeId: "cosplayNodes",
  conventionId: "conventions",
  packingListItemId: "packingListItems",
  workflowItemId: "workflowItems",
  parentId: "workflowItems",
  predecessorWorkflowItemId: "workflowItems",
  successorWorkflowItemId: "workflowItems",
  legacyBuildTaskId: "buildTasks",
};
const ENTITY_TABLES: Record<string, BackfillTable> = {
  build: "builds",
  cosplayNode: "cosplayNodes",
  convention: "conventions",
  packingItem: "packingListItems",
};
function references(entry: Entry): [string, BackfillTable][] {
  const refs = Object.entries(REFERENCE_TABLES) as [string, BackfillTable][];
  if (entry.table === "workflowAttachments" && typeof entry.row.entityType === "string") {
    const table = ENTITY_TABLES[entry.row.entityType];
    if (table) refs.push(["entityId", table]);
  }
  return refs;
}

/** Plan the whole snapshot before writes; hierarchies and cross-table dependencies may span chunks. */
function planBackfill(entries: Entry[]) {
  const aliases = new Map<BackfillTable, Map<string, Entry>>();
  for (const entry of entries) {
    let tableAliases = aliases.get(entry.table);
    if (!tableAliases) aliases.set(entry.table, (tableAliases = new Map()));
    for (const alias of [entry.row.clientId, entry.row._id]) {
      if (typeof alias !== "string") continue;
      const previous = tableAliases.get(alias);
      if (previous && previous.row.clientId !== entry.row.clientId)
        throw new Error("Ambiguous local backfill id");
      if (!previous) tableAliases.set(alias, entry);
    }
  }
  const ordered: Entry[] = [];
  const visited = new Set<Entry>();
  const visiting = new Set<Entry>();
  // Iterative traversal avoids a device stack overflow for a large/deep local library.
  for (const entry of entries) {
    const stack: { entry: Entry; finish: boolean }[] = [{ entry, finish: false }];
    while (stack.length) {
      const frame = stack.pop()!;
      if (visited.has(frame.entry)) continue;
      if (frame.finish) {
        visiting.delete(frame.entry);
        visited.add(frame.entry);
        ordered.push(frame.entry);
        continue;
      }
      if (visiting.has(frame.entry)) throw new Error("Cyclic local backfill relationship");
      visiting.add(frame.entry);
      stack.push({ entry: frame.entry, finish: true });
      for (const [field, target] of references(frame.entry).reverse()) {
        const value = frame.entry.row[field];
        const dependency = typeof value === "string" ? aliases.get(target)?.get(value) : undefined;
        if (dependency) stack.push({ entry: dependency, finish: false });
      }
    }
  }
  return { ordered, aliases };
}

// encodeURIComponent is available on both web and native (unlike TextEncoder on some devices).
function rowBytes(row: LocalRow): number {
  return encodeURIComponent(JSON.stringify(row)).replace(/%[0-9A-F]{2}/g, "x").length;
}
const MAX_CHUNK_BYTES = 512 * 1024;

/** In-memory progress mirror polled by `useSyncStatus` (no synchronous store hub on mobile). */
let currentProgress: BackfillProgress = IDLE_BACKFILL;

/** Current aggregate backfill progress for the sync-status UI. */
export function getBackfillProgress(): BackfillProgress {
  return currentProgress;
}

/** Update the backfill progress mirror (called by the orchestration's `onProgress`). */
export function setBackfillProgress(progress: BackfillProgress): void {
  currentProgress = progress;
}

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
    const entries = BACKFILL_TABLES.flatMap((table) =>
      deps.listLocalRows(table).map((row) => ({ table, row }))
    );
    const { ordered, aliases } = planBackfill(entries);
    const serverIds = new Map<Entry, string>();
    const remap = (entry: Entry): LocalRow => {
      const row = { ...entry.row };
      for (const [field, target] of references(entry)) {
        const value = row[field];
        const dependency = typeof value === "string" ? aliases.get(target)?.get(value) : undefined;
        if (dependency) row[field] = serverIds.get(dependency) ?? dependency.row.clientId;
      }
      // Cached ancestry is derived on the server; keep the snapshot untouched on the device.
      if (entry.table === "workflowItems") row.ancestorIds = [];
      return row;
    };
    const total = entries.length;
    let done = 0;
    const report = (isRunning: boolean) => deps.onProgress?.({ running: isRunning, done, total });

    if (total === 0) {
      await deps.markComplete();
      report(false);
      return { running: false, done: 0, total: 0 };
    }

    report(true);
    for (let i = 0; i < ordered.length; ) {
      const table = ordered[i].table;
      const chunk: LocalRow[] = [];
      let bytes = 2; // array brackets
      while (i + chunk.length < ordered.length && chunk.length < BACKFILL_CHUNK_SIZE) {
        const entry = ordered[i + chunk.length];
        if (entry.table !== table) break;
        const row = remap(entry);
        const size = rowBytes(row) + (chunk.length ? 1 : 0);
        if (bytes + size > MAX_CHUNK_BYTES) {
          if (!chunk.length) throw new Error("Local backfill row exceeds chunk byte limit");
          break;
        }
        chunk.push(row);
        bytes += size;
      }
      const result = await deps.pushChunk(table, chunk);
      if (result.ids) {
        const mapping = new Map(result.ids.map(({ clientId, id }) => [clientId, id]));
        for (let offset = 0; offset < chunk.length; offset++) {
          const id = mapping.get(chunk[offset].clientId);
          if (typeof id !== "string" || !id.length)
            throw new Error("Incomplete backfill id mapping");
          serverIds.set(ordered[i + offset], id);
        }
      }
      i += chunk.length;
      done += chunk.length;
      report(true);
    }
    await deps.markComplete();
    report(false);
    return { running: false, done, total };
  } finally {
    running = false;
  }
}
