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
import { loadIdMap, setServerId } from "./idMap";
import {
  clearEntityOverlay,
  listPendingEntityRows,
  listSyncedEntityRows,
  upsertSyncedEntityRow,
} from "./entityRows";
import { overlayWritesFor } from "./offlineEntityWrites";
import {
  getSyncCursor,
  isBackfillComplete,
  setBackfillComplete,
  setLastSyncedAt,
  setSyncCursor,
} from "./syncCursor";
import {
  IDLE_BACKFILL,
  runUpgradeBackfill,
  setBackfillProgress,
  type BackfillDeps,
  type BackfillProgress,
} from "./backfill";
import { getLocalImageUri } from "../lib/images/localImageStore";
import { uploadUriToConvexStorage } from "../lib/uploadConvexStorage";
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
 * Read an image's bytes from the on-device store, request an upload URL, and POST the bytes to it.
 * Injectable so the orchestration is unit-testable without the file system or a real network
 * (REQ-D71). `body` is a `file://` uri that the upload helper streams to the Convex upload URL.
 */
export interface ImageUploadDeps {
  /** Non-deleted synced rows for a table (the local mirror of the server's docs). */
  listSyncedRows: (table: string) => Record<string, unknown>[];
  /** Write the flipped doc back to the local store as a synced row. */
  writeSyncedRow: (table: string, id: string, userId: string, doc: Record<string, unknown>) => void;
  /** On-device file uri for an image, or null when the local binary is unavailable. */
  readImageBytes: (imageKey: string) => Promise<{ body: string; contentType: string } | null>;
  /** POST the file at `body` to a Convex upload URL; returns the `_storage` id, or null on failure. */
  uploadBytes: (uploadUrl: string, body: string, contentType: string) => Promise<string | null>;
}

function defaultImageUploadDeps(): ImageUploadDeps {
  return {
    listSyncedRows: (table) => listSyncedEntityRows(table),
    writeSyncedRow: (table, id, userId, doc) => upsertSyncedEntityRow(table, id, userId, doc),
    readImageBytes: async (imageKey) => {
      const uri = await getLocalImageUri(imageKey);
      if (!uri) return null;
      return { body: uri, contentType: "image/jpeg" };
    },
    uploadBytes: async (uploadUrl, body, contentType) => {
      try {
        return await uploadUriToConvexStorage(body, uploadUrl, contentType);
      } catch {
        return null;
      }
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
 * (local is the durable home, REQ-D70); it never blocks reads/writes. Web mirror lives in
 * `web/src/lib/offline/syncWorker.ts`.
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
            // No local binary to upload (e.g. missing on disk): leave the ref for a later sync.
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
  if (getIsOnline()) requeueFailedMutations();
  const result = await drainMutationQueue(client);
  await warmEntityRows(client);
  await uploadLocalImages(client, opts.tier ?? null);
  return result;
}

/**
 * Wire the pure backfill orchestration to the local SQLite store + Convex. `listLocalRows` reads only
 * the NOT-YET-SYNCED local-first rows (the free-created base that never reached the cloud), stamping
 * each with its client-minted id as the dedupe `clientId`. It only READS local data — copies are
 * pushed to the cloud; nothing local is ever mutated or deleted (the REQ-D95 invariant).
 */
function defaultBackfillDeps(client: ConvexReactClient): BackfillDeps {
  return {
    listLocalRows: (table) =>
      listPendingEntityRows(table)
        .filter((row) => !row.deleted && row.doc)
        .map((row) => ({ ...(row.doc as Record<string, unknown>), clientId: row.id })),
    pushChunk: (table, rows) =>
      client.mutation(makeFunctionReference<"mutation">("tierTransition:backfillRows"), {
        table,
        rows,
      } as never) as Promise<{
        table: string;
        total: number;
        inserted: number;
        skipped: number;
        cloudCount: number;
      }>,
    isComplete: () => isBackfillComplete(),
    markComplete: () => setBackfillComplete(),
    onProgress: (progress) => setBackfillProgress(progress),
  };
}

/**
 * REQ-D95 — upgrade backfill trigger. When a user becomes paid + signed in, push the local-first
 * rows they created while FREE (never enqueued by the sync worker) up to the cloud once, deduped
 * server-side by `clientId` and marked complete per device so it never re-scans.
 *
 * Paid-only and a HARD no-op for free/signed-out users — it returns before any Convex call, so the
 * REQ-D10 zero-Convex-calls-for-free invariant holds even if it is ever invoked off the gated path.
 * Idempotent and safe to call on every reconnect: a completed device short-circuits in the store.
 */
export async function runBackfill(
  client: ConvexReactClient,
  tier: string | null | undefined,
  deps: BackfillDeps = defaultBackfillDeps(client)
): Promise<BackfillProgress> {
  // REQ-D95/D10: free users never back up — no Convex calls whatsoever.
  if (!isPaidConvexTier(tier)) return IDLE_BACKFILL;
  return runUpgradeBackfill(deps);
}
