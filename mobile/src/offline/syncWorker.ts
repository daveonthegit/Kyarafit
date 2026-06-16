import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { getIsOnline } from "./connectivity";
import { isIdempotentMutation } from "./idempotentMutations";
import { loadIdMap, setServerId } from "./idMap";
import { clearEntityOverlay, upsertSyncedEntityRow } from "./entityRows";
import { overlayWritesFor } from "./offlineEntityWrites";
import { getSyncCursor, setSyncCursor } from "./syncCursor";
import {
  bumpMutationRetry,
  deleteMutation,
  failMutation,
  listPendingMutations,
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
type ChangedSince = { builds: ChangedDoc[]; conventions: ChangedDoc[]; cursor: number };

const WARMUP_PAGE_LIMIT = 500;
const WARMUP_MAX_PAGES = 20;
let warming = false;

/**
 * Cold-start / reconnect warm-up: pull the signed-in user's documents changed since the persisted
 * cursor (`sync.listChangedSince`) into the local store as synced `entity_rows`, so registered
 * queries paint from local data even before they have ever been fetched online. Single-flight,
 * connectivity-guarded, paged (bounded), and best-effort — any failure leaves the cursor untouched
 * so the next trigger retries.
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

      for (const doc of res.builds) {
        upsertSyncedEntityRow("builds", doc._id, String(doc.userId ?? ""), doc);
      }
      for (const doc of res.conventions) {
        upsertSyncedEntityRow("conventions", doc._id, String(doc.userId ?? ""), doc);
      }

      if (typeof res.cursor === "number" && res.cursor > cursor) {
        cursor = res.cursor;
        setSyncCursor(cursor);
      }

      // A short page on both tables means we've caught up.
      if (res.builds.length < WARMUP_PAGE_LIMIT && res.conventions.length < WARMUP_PAGE_LIMIT) {
        break;
      }
    }
  } catch {
    // Best-effort; leave the cursor for the next trigger.
  } finally {
    warming = false;
  }
}
