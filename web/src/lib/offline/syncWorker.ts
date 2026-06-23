"use client";

import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { getIsOnline } from "./connectivity";
import { isIdempotentMutation } from "./idempotentMutations";
import { overlayWritesFor } from "./offlineEntityWrites";
import { offlineRuntime } from "./runtime";

/**
 * The Convex-facing sync worker (queue drain + warm-up pull). The web mirror of mobile's
 * `syncWorker`. It is ONLY invoked by `SyncWorkerProvider` when `shouldRunSyncWorker(tier, signedIn)`
 * is true (paid + signed in), so a free or signed-out user never reaches this code (REQ-D60/D10).
 *
 * This is the BRIDGE — the designated online path that is allowed to import `convex/react`.
 */

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
 * Replay queued offline mutations against Convex, FIFO. Single-flight; stops on the first transient
 * failure to preserve order; bumps retry counts with capped backoff; rows past the retry ceiling are
 * marked failed (not silently dropped). Connectivity-guarded (REQ-D61).
 */
export async function drainMutationQueue(client: ConvexReactClient): Promise<DrainResult> {
  if (draining || !getIsOnline()) return { processed: 0, failed: 0 };
  draining = true;
  let processed = 0;
  let failed = 0;
  try {
    const pending = await offlineRuntime.listPendingMutations();
    const idMap = await offlineRuntime.loadIdMap();
    for (const row of pending) {
      let args: unknown;
      try {
        args = JSON.parse(row.args_json);
      } catch {
        await offlineRuntime.deleteMutation(row.id);
        continue;
      }

      try {
        const rewritten = rewriteIdsDeep(args, idMap);
        const callArgs = argsForReplay(row.fn, rewritten, row.idempotency_key);
        const result = await client.mutation(
          makeFunctionReference<"mutation">(row.fn),
          callArgs as never
        );
        if (row.client_id) {
          const serverId = serverIdFromResult(result);
          if (serverId) {
            await offlineRuntime.setServerId(row.client_id, serverId);
            idMap[row.client_id] = serverId;
          }
        }
        for (const write of overlayWritesFor(row.fn, args, row.client_id ?? undefined)) {
          offlineRuntime.clearEntityOverlay(write.table, write.id);
        }
        await offlineRuntime.deleteMutation(row.id);
        processed += 1;
      } catch {
        if (!getIsOnline()) break;
        if (shouldRetryMutation(row.retry_count + 1)) {
          await offlineRuntime.bumpMutationRetry(row.id);
        } else {
          await offlineRuntime.failMutation(row.id);
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
type ChangedSince = {
  builds?: ChangedDoc[];
  conventions?: ChangedDoc[];
  cursor: number;
};

const WARMUP_PAGE_LIMIT = 500;
const WARMUP_MAX_PAGES = 20;
let warming = false;

/**
 * Cold-start / reconnect warm-up: pull the signed-in user's documents changed since the persisted
 * cursor (`sync.listChangedSince`) into the local store as synced rows, so registered queries paint
 * from local data even before they have ever been fetched online (REQ-D63). Single-flight,
 * connectivity-guarded, paged, and best-effort.
 */
export async function warmEntityRows(client: ConvexReactClient): Promise<void> {
  if (warming || !getIsOnline()) return;
  warming = true;
  try {
    let cursor = await offlineRuntime.getSyncCursor();
    for (let page = 0; page < WARMUP_MAX_PAGES; page += 1) {
      if (!getIsOnline()) break;
      const res = (await client.query(makeFunctionReference<"query">("sync:listChangedSince"), {
        since: cursor,
        limit: WARMUP_PAGE_LIMIT,
      } as never)) as ChangedSince | null;
      if (!res) break;

      const builds = res.builds ?? [];
      const conventions = res.conventions ?? [];
      for (const doc of builds) {
        offlineRuntime.upsertSyncedEntityRow("builds", doc._id, String(doc.userId ?? ""), doc);
      }
      for (const doc of conventions) {
        offlineRuntime.upsertSyncedEntityRow("conventions", doc._id, String(doc.userId ?? ""), doc);
      }

      if (typeof res.cursor === "number" && res.cursor > cursor) {
        cursor = res.cursor;
        await offlineRuntime.setSyncCursor(cursor);
      }

      if (builds.length < WARMUP_PAGE_LIMIT && conventions.length < WARMUP_PAGE_LIMIT) break;
    }
  } catch {
    // Best-effort; leave the cursor for the next trigger.
  } finally {
    warming = false;
  }
}
