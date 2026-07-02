"use client";

import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import {
  IMAGE_REF_TABLES,
  collectLocalImageRefs,
  planCloudMirror,
} from "@kyarafit/design-system/domain/imageUpload";
import { getIsOnline } from "./connectivity";
import { isIdempotentMutation } from "./idempotentMutations";
import { overlayWritesFor } from "./offlineEntityWrites";
import { offlineRuntime } from "./runtime";
import { getLocalImageStore } from "../images/localImageStore";

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

/**
 * Every local-first table returned by `sync.listChangedSince` (see `convex/sync.ts`). Warm-up must
 * hydrate ALL of them, not just builds/conventions (REQ-D63). Keep in exact parity with the query's
 * payload keys and with mobile's `WARMUP_TABLES`.
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
 * cursor (`sync.listChangedSince`) into the local store as synced rows, so registered queries paint
 * from local data even before they have ever been fetched online (REQ-D63). Hydrates EVERY
 * local-first table the query returns. Single-flight, connectivity-guarded, paged, and best-effort.
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

      let maxPageLen = 0;
      for (const table of WARMUP_TABLES) {
        const docs = res[table] ?? [];
        for (const doc of docs) {
          offlineRuntime.upsertSyncedEntityRow(table, doc._id, String(doc.userId ?? ""), doc);
        }
        if (docs.length > maxPageLen) maxPageLen = docs.length;
      }

      if (typeof res.cursor === "number" && res.cursor > cursor) {
        cursor = res.cursor;
        await offlineRuntime.setSyncCursor(cursor);
      }

      // A short page across every table means we've caught up.
      if (maxPageLen < WARMUP_PAGE_LIMIT) break;
    }
    await offlineRuntime.setLastSyncedAt(Date.now());
  } catch {
    // Best-effort; leave the cursor for the next trigger.
  } finally {
    warming = false;
  }
}

/**
 * Read an image's bytes from the on-device store, request an upload URL, and POST the bytes to it.
 * Injectable so the orchestration is unit-testable without IndexedDB or a real network (REQ-D71).
 */
export interface ImageUploadDeps {
  /** Non-deleted synced rows for a table (the local mirror of the server's docs). */
  listSyncedRows: (table: string) => Record<string, unknown>[];
  /** Write the flipped doc back to the local store as a synced row. */
  writeSyncedRow: (table: string, id: string, userId: string, doc: Record<string, unknown>) => void;
  /** Bytes for an on-device image, or null when the local binary is unavailable. */
  readImageBytes: (imageKey: string) => Promise<{ body: Blob; contentType: string } | null>;
  /** POST bytes to a Convex upload URL; returns the new `_storage` id, or null on failure. */
  uploadBytes: (uploadUrl: string, body: Blob, contentType: string) => Promise<string | null>;
}

function defaultImageUploadDeps(): ImageUploadDeps {
  return {
    listSyncedRows: (table) => offlineRuntime.listSyncedEntityRowsSync(table),
    writeSyncedRow: (table, id, userId, doc) =>
      offlineRuntime.upsertSyncedEntityRow(table, id, userId, doc),
    readImageBytes: async (imageKey) => {
      const blob = await getLocalImageStore().getBlob(imageKey);
      if (!blob) return null;
      return { body: blob, contentType: blob.type || "image/jpeg" };
    },
    uploadBytes: async (uploadUrl, body, contentType) => {
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { storageId?: unknown };
      return typeof json.storageId === "string" ? json.storageId : null;
    },
  };
}

let uploadingImages = false;

export type ImageUploadResult = { uploaded: number; failed: number };

/**
 * Paid image upload as a SYNC STEP (DATA_AND_SYNC.md §7, REQ-D71): for each `local` `ImageRef` on a
 * synced entity, upload the on-device binary to Convex storage and flip the entity's ref from
 * `local` to `cloud` via its idempotent update mutation, keeping the local copy as a cache.
 *
 * Paid-only and a hard no-op for free users — it never touches Convex (preserving the REQ-D10
 * zero-Convex-calls-for-free invariant). Single-flight and connectivity-guarded, consistent with the
 * drain loop. A per-image failure leaves the local ref intact so it is retried on the next sync
 * (local is the durable home, REQ-D70); it never blocks reads/writes.
 */
export async function uploadLocalImages(
  client: ConvexReactClient,
  tier: string | null | undefined,
  deps: ImageUploadDeps = defaultImageUploadDeps()
): Promise<ImageUploadResult> {
  // REQ-D71/D10: free users never upload — no Convex calls whatsoever.
  if (!isPaidConvexTier(tier)) return { uploaded: 0, failed: 0 };
  if (uploadingImages || !getIsOnline()) return { uploaded: 0, failed: 0 };
  uploadingImages = true;
  let uploaded = 0;
  let failed = 0;
  try {
    for (const table of IMAGE_REF_TABLES) {
      for (const original of deps.listSyncedRows(table)) {
        const sites = collectLocalImageRefs(table, original);
        if (sites.length === 0) continue;
        const entityId = String(original._id ?? "");
        const userId = String(original.userId ?? "");
        let working = original;
        let changed = false;
        for (const site of sites) {
          if (!getIsOnline()) break;
          try {
            const bytes = await deps.readImageBytes(site.imageKey);
            // No local binary to upload (e.g. evicted/missing): leave the ref for a later sync.
            if (!bytes) continue;
            const uploadUrl = (await client.mutation(
              makeFunctionReference<"mutation">("files:generateUploadUrl"),
              {} as never
            )) as string;
            const storageId = await deps.uploadBytes(uploadUrl, bytes.body, bytes.contentType);
            if (!storageId) {
              failed += 1;
              continue;
            }
            const plan = planCloudMirror(site, working, storageId);
            await client.mutation(makeFunctionReference<"mutation">(plan.fn), plan.args as never);
            working = plan.nextDoc;
            changed = true;
            uploaded += 1;
          } catch {
            // Leave the local ref intact; retried on the next sync (REQ-D70).
            failed += 1;
          }
        }
        // Persist the flipped refs locally so the next pass sees `cloud`, not `local` (no re-upload).
        if (changed) deps.writeSyncedRow(table, entityId, userId, working);
      }
    }
  } finally {
    uploadingImages = false;
  }
  return { uploaded, failed };
}

/**
 * Manual "sync now" (REQ-D64): drain the queue, warm-up, then (paid only) upload local images, in
 * the same order as the reconnect path. Connectivity-guarded by the helpers; `warmEntityRows`
 * records the last-synced timestamp on success. Failed rows are requeued first so an explicit retry
 * can clear the error state (REQ-D64). Returns the drain result so callers can surface progress.
 */
export async function syncNow(
  client: ConvexReactClient,
  opts: { tier?: string | null } = {}
): Promise<DrainResult> {
  if (getIsOnline()) await offlineRuntime.requeueFailedMutations();
  const result = await drainMutationQueue(client);
  await warmEntityRows(client);
  await uploadLocalImages(client, opts.tier ?? null);
  return result;
}
