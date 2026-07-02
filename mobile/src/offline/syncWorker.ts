import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { getIsOnline } from "./connectivity";
import { isIdempotentMutation } from "./idempotentMutations";
import { loadIdMap, setServerId } from "./idMap";
import { clearEntityOverlay, upsertSyncedEntityRow } from "./entityRows";
import { overlayWritesFor } from "./offlineEntityWrites";
import { getSyncCursor, setLastSyncedAt, setSyncCursor } from "./syncCursor";
import {
  bumpMutationRetry,
  deleteMutation,
  failMutation,
  listPendingMutations,
  requeueFailedMutations,
} from "./mutationQueue";

/** Inject the queued idempotency key into the args of mutations that dedupe replays server-side. */
function argsForReplay(fn: string, args: unknown, idempotencyKey: string): unknown {
  if (isIdempotentMutation(fn) && args !== null && typeof args === "object") {
    return { ...(args as Record<string, unknown>), idempotencyKey };
  }
  return args;
}

/** Pull a server document id out of a create mutation's result, if it returned a doc. */
function serverIdFromResult(result: unknown): string | null {
  if (result !== null && typeof result === "object" && "_id" in result) {
    const id = (result as { _id: unknown })._id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

let draining = false;

export type DrainResult = { processed: number; failed: number };

/**
 * Replay queued offline mutations against Convex, FIFO. Single-flight (concurrent calls no-op).
 *
 * Ordering: rows are processed oldest-first, and on the first transient failure we stop the pass
 * (rather than skip ahead) so a not-yet-synced create never lets a later dependent op run out of
 * order. Successful rows are deleted; transient failures bump the retry counter (and stop the
 * pass for backoff); rows past the retry ceiling are marked `failed` so they stop blocking.
 *
 * Replay is at-least-once. Mutations listed in `idempotentMutations` carry the queued idempotency
 * key so the server dedupes a re-sent write (via the `idempotencyLedger`); others remain
 * at-least-once until they adopt `runIdempotent`.
 *
 * Connectivity-guarded: never runs while offline, and a failure that coincides with having gone
 * offline is treated as transient (not counted against the retry ceiling), so launching/operating
 * the app offline can never burn retries or drop a queued row.
 */
export async function drainMutationQueue(client: ConvexReactClient): Promise<DrainResult> {
  if (draining || !getIsOnline()) return { processed: 0, failed: 0 };
  draining = true;
  let processed = 0;
  let failed = 0;
  try {
    const pending = listPendingMutations();
    // Resolve optimistic client ids to their synced server ids as the pass progresses, so a queued
    // op that referenced an offline-created entity is rewritten before it is sent.
    const idMap = loadIdMap();
    for (const row of pending) {
      let args: unknown;
      try {
        args = JSON.parse(row.args_json);
      } catch {
        // Corrupt args can never succeed — drop the row.
        deleteMutation(row.id);
        continue;
      }

      try {
        const rewritten = rewriteIdsDeep(args, idMap);
        const callArgs = argsForReplay(row.fn, rewritten, row.idempotency_key);
        const result = await client.mutation(
          makeFunctionReference<"mutation">(row.fn),
          callArgs as never
        );
        // Map an offline-created entity's client id to the server id it just received, so later
        // rows in this pass (and future passes) can reference it.
        if (row.client_id) {
          const serverId = serverIdFromResult(result);
          if (serverId) {
            setServerId(row.client_id, serverId);
            idMap[row.client_id] = serverId;
          }
        }
        // Drop the optimistic overlay now that the live/cached server data is authoritative.
        for (const write of overlayWritesFor(row.fn, args, row.client_id ?? undefined)) {
          clearEntityOverlay(write.table, write.id);
        }
        deleteMutation(row.id);
        processed += 1;
      } catch {
        if (!getIsOnline()) {
          // Went offline mid-drain: treat as transient, don't penalize. Resume on reconnect.
          break;
        }
        if (shouldRetryMutation(row.retry_count + 1)) {
          bumpMutationRetry(row.id);
        } else {
          failMutation(row.id);
          failed += 1;
        }
        // Preserve FIFO: stop on first failure; the next trigger retries from here.
        break;
      }
    }
  } finally {
    draining = false;
  }
  return { processed, failed };
}

type ChangedDoc = { _id: string; userId?: string } & Record<string, unknown>;

/**
 * Every local-first table returned by `sync.listChangedSince` (see `convex/sync.ts`). Warm-up must
 * hydrate ALL of them, not just builds/conventions (REQ-D63). Keep in exact parity with the query's
 * payload keys and with web's `WARMUP_TABLES`.
 */
const WARMUP_TABLES = [
  "closetItems",
  "cosplayNodes",
  "elements",
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
type WarmupTable = (typeof WARMUP_TABLES)[number];
type ChangedSince = { cursor: number } & Partial<Record<WarmupTable, ChangedDoc[]>>;

const WARMUP_PAGE_LIMIT = 500;
const WARMUP_MAX_PAGES = 20;
let warming = false;

/**
 * Cold-start / reconnect warm-up: pull the signed-in user's documents changed since the persisted
 * cursor (`sync.listChangedSince`) into the local store as synced `entity_rows`, so registered
 * queries paint from local data even before they have ever been fetched online. Hydrates EVERY
 * local-first table the query returns (REQ-D63). Single-flight, connectivity-guarded, paged
 * (bounded), and best-effort — any failure leaves the cursor untouched so the next trigger retries.
 */
export async function warmEntityRows(client: ConvexReactClient): Promise<void> {
  if (warming || !getIsOnline()) return;
  warming = true;
  try {
    let cursor = getSyncCursor();
    for (let page = 0; page < WARMUP_MAX_PAGES; page += 1) {
      if (!getIsOnline()) break;
      const res = (await client.query(makeFunctionReference<"query">("sync:listChangedSince"), {
        since: cursor,
        limit: WARMUP_PAGE_LIMIT,
      } as never)) as ChangedSince | null;
      if (!res) break;

      let maxPageLen = 0;
      for (const table of WARMUP_TABLES) {
        const docs = res[table] ?? [];
        for (const doc of docs) {
          upsertSyncedEntityRow(table, doc._id, String(doc.userId ?? ""), doc);
        }
        if (docs.length > maxPageLen) maxPageLen = docs.length;
      }

      if (typeof res.cursor === "number" && res.cursor > cursor) {
        cursor = res.cursor;
        setSyncCursor(cursor);
      }

      // A short page across every table means we've caught up.
      if (maxPageLen < WARMUP_PAGE_LIMIT) break;
    }
    setLastSyncedAt(Date.now());
  } catch {
    // Best-effort; leave the cursor for the next trigger.
  } finally {
    warming = false;
  }
}

/**
 * Manual "sync now" (REQ-D64): drain the queue then warm-up, in the same order as the reconnect
 * path. Connectivity-guarded by the drain/warm helpers; `warmEntityRows` records the last-synced
 * timestamp on success. Failed rows are requeued first so an explicit retry can clear the error
 * state (REQ-D64). Returns the drain result so callers can surface progress.
 */
export async function syncNow(client: ConvexReactClient): Promise<DrainResult> {
  if (getIsOnline()) requeueFailedMutations();
  const result = await drainMutationQueue(client);
  await warmEntityRows(client);
  return result;
}
