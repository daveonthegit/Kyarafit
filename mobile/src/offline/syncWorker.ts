import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { shouldRetryMutation } from "@kyarafit/design-system/domain/offlineMutationQueue";
import { hasUnmappedClientId, rewriteIdsDeep } from "@kyarafit/design-system/domain/offlineIdMap";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import {
  IMAGE_REF_TABLES,
  collectLocalImageRefs,
  planCloudMirror,
} from "@kyarafit/design-system/domain/imageUpload";
import { getIsOnline } from "./connectivity";
import { getOfflineDb } from "./db";
import { syncScope } from "./syncIdentity";
import { isIdempotentMutation } from "./idempotentMutations";
import { loadIdMap, setServerId } from "./idMap";
import {
  listPendingEntityRows,
  listSyncedEntityRows,
  markEntityRowSynced,
  markEntityRowsSynced,
  upsertSyncedEntityRow,
} from "./entityRows";
import { getActiveVault } from "@/vault/activeVault";
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
  type BackfillChunkResult,
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
export { invalidateSyncSession } from "./syncIdentity";

/** Inject the queued idempotency key into the args of mutations that dedupe replays server-side. */
function argsForReplay(fn: string, args: unknown, idempotencyKey: string): unknown {
  if (isIdempotentMutation(fn) && args !== null && typeof args === "object") {
    return { ...(args as Record<string, unknown>), idempotencyKey };
  }
  return args;
}

function hasUnmappedRelationship(value: unknown, idMap: Record<string, string>): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasUnmappedRelationship(entry, idMap));
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => {
    if (["userId", "ownerId", "ownerUserId", "assigneeUserId"].includes(key)) return false;
    return key === "id" || key === "ids" || key.endsWith("Id") || key.endsWith("Ids")
      ? hasUnmappedClientId(entry, idMap)
      : hasUnmappedRelationship(entry, idMap);
  });
}

/** Pull a server document id out of a create mutation's result, if it returned a doc. */
function serverIdFromResult(result: unknown): string | null {
  if (typeof result === "string") return result;
  if (result !== null && typeof result === "object" && "_id" in result) {
    const id = (result as { _id: unknown })._id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function parseTouched(json: string | null): [string, string][] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string"
        )
      : [];
  } catch {
    return [];
  }
}

/** server id -> local id, so pulled server docs land on (and reference) the rows this vault owns. */
function reverseIdMap(): Record<string, string> {
  const reverse: Record<string, string> = {};
  for (const [clientId, serverId] of Object.entries(loadIdMap())) reverse[serverId] = clientId;
  return reverse;
}

const DRAIN_BATCH = 100;
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
  const scope = await syncScope();
  if (draining || !scope.current()) return { processed: 0, failed: 0 };
  draining = true;
  let processed = 0;
  let failed = 0;
  try {
    // Resolve optimistic client ids to their synced server ids as the pass progresses, so a queued
    // op that referenced an offline-created entity is rewritten before it is sent.
    const idMap = loadIdMap();
    // Drain batch after batch until the queue is empty or a row fails (FIFO stop).
    let stopped = false;
    while (!stopped && scope.current()) {
      const pending = listPendingMutations(DRAIN_BATCH);
      if (pending.length === 0) break;
      for (const row of pending) {
        if (!scope.current()) break;
        let args: unknown;
        try {
          args = JSON.parse(row.args_json);
        } catch {
          // Corrupt args can never succeed — park the row as failed (visible), never drop it.
          failMutation(row.id);
          failed += 1;
          continue;
        }

        try {
          if (hasUnmappedRelationship(args, idMap)) throw new Error("Unmapped queued relationship");
          const rewritten = rewriteIdsDeep(args, idMap);
          const callArgs = argsForReplay(row.fn, rewritten, row.idempotency_key);
          const result = await client.mutation(
            makeFunctionReference<"mutation">(row.fn),
            callArgs as never
          );
          scope.assertCurrent();
          // Map an offline-created entity's client id to the server id it just received, so later
          // rows in this pass (and future passes) can reference it.
          if (row.client_id && !idMap[row.client_id]) {
            const serverId = serverIdFromResult(result);
            if (serverId) {
              setServerId(row.client_id, serverId);
              idMap[row.client_id] = serverId;
            }
          }
          if (row.client_id && !idMap[row.client_id])
            throw new Error("Create has no server identity");
          // The cloud now holds this change: mark the rows it covered as acknowledged (unless a
          // later pending op still has unsent changes to them). The local rows never move.
          markEntityRowsSynced(parseTouched(row.touched_json), row.id);
          deleteMutation(row.id);
          processed += 1;
        } catch {
          if (!scope.current()) return { processed, failed };
          stopped = true;
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
      if (pending.length < DRAIN_BATCH) break;
    }
  } catch (error) {
    // Vault locked mid-pass or SQLite failure: stop; queued rows stay queued for the next trigger.
    console.warn("[sync] drain stopped", error);
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
  const scope = await syncScope();
  if (warming || !scope.current()) return;
  warming = true;
  try {
    let cursor = getSyncCursor();
    const toLocal = reverseIdMap();
    for (let page = 0; page < WARMUP_MAX_PAGES; page += 1) {
      if (!getIsOnline() || !scope.current()) break;
      const res = (await client.query(makeFunctionReference<"query">("sync:listChangedSince"), {
        since: cursor,
        limit: WARMUP_PAGE_LIMIT,
      } as never)) as ChangedSince | null;
      scope.assertCurrent();
      if (!res) break;

      for (const table of WARMUP_TABLES) {
        for (const doc of res[table] ?? []) {
          if (typeof doc.clientId !== "string") continue;
          const existing = getOfflineDb().getFirstSync<{ id: string }>(
            "SELECT id FROM entity_rows WHERE table_name = ? AND id = ? AND deleted = 0",
            [table, doc.clientId]
          );
          if (existing) {
            setServerId(existing.id, doc._id);
            toLocal[doc._id] = existing.id;
          }
        }
      }
      let maxPageLen = 0;
      for (const table of WARMUP_TABLES) {
        const docs = res[table] ?? [];
        for (const doc of docs) {
          const local = rewriteIdsDeep(doc, toLocal);
          for (const field of ["entityKey", "dedupeKey"] as const) {
            if (typeof doc[field] === "string") {
              local[field] = doc[field]
                .split(":")
                .map((part) => toLocal[part] ?? part)
                .join(":");
            }
          }
          upsertSyncedEntityRow(table, local._id, String(doc.userId ?? ""), local);
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
    scope.assertCurrent();
    setLastSyncedAt(Date.now());
  } catch (error) {
    // Leave the cursor for the next trigger.
    console.warn("[sync] warm-up pull failed", error);
  } finally {
    warming = false;
    if (scope.current()) getActiveVault()?.reloadFromDisk();
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
  const scope = await syncScope();
  if (uploadingImages || !scope.current()) return { uploaded: 0, failed: 0 };
  uploadingImages = true;
  let uploaded = 0;
  let failed = 0;
  try {
    for (const table of IMAGE_REF_TABLES) {
      for (const original of deps.listSyncedRows(table)) {
        const sites = collectLocalImageRefs(table, original);
        if (sites.length === 0) continue;
        const entityId = String(original._id ?? "");
        if (hasUnmappedClientId(entityId, loadIdMap())) continue;
        const userId = String(original.userId ?? "");
        let working = original;
        let changed = false;
        for (const site of sites) {
          if (!getIsOnline() || !scope.current()) return { uploaded, failed };
          try {
            const bytes = await deps.readImageBytes(site.imageKey);
            scope.assertCurrent();
            // No local binary to upload (e.g. missing on disk): leave the ref for a later sync.
            if (!bytes) continue;
            const uploadUrl = (await client.mutation(
              makeFunctionReference<"mutation">("files:generateUploadUrl"),
              {} as never
            )) as string;
            scope.assertCurrent();
            const storageId = await deps.uploadBytes(uploadUrl, bytes.body, bytes.contentType);
            scope.assertCurrent();
            if (!storageId) {
              failed += 1;
              continue;
            }
            const plan = planCloudMirror(site, working, storageId);
            const idMap = loadIdMap();
            if (hasUnmappedRelationship(plan.args, idMap))
              throw new Error("Photo owner has no server identity");
            await client.mutation(
              makeFunctionReference<"mutation">(plan.fn),
              rewriteIdsDeep(plan.args, idMap) as never
            );
            scope.assertCurrent();
            working = plan.nextDoc;
            changed = true;
            uploaded += 1;
          } catch {
            // Leave the local ref intact; retried on the next sync (REQ-D70).
            failed += 1;
          }
        }
        // Persist the flipped refs locally so the next pass sees `cloud`, not `local` (no re-upload).
        if (changed && scope.current()) {
          deps.writeSyncedRow(table, entityId, userId, working);
          getActiveVault()?.reloadFromDisk();
        }
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
  if (!getIsOnline()) return { processed: 0, failed: 0 };
  const scope = await syncScope();
  if (!scope.current()) return { processed: 0, failed: 0 };
  requeueFailedMutations();
  const result = await drainMutationQueue(client);
  if (scope.current()) await warmEntityRows(client);
  if (scope.current()) await uploadLocalImages(client, opts.tier ?? null);
  return result;
}

/**
 * Wire the pure backfill orchestration to the local SQLite store + Convex. `listLocalRows` reads only
 * the NOT-YET-SYNCED local-first rows (the free-created base that never reached the cloud), stamping
 * each with its client-minted id as the dedupe `clientId`. It only READS local data — copies are
 * pushed to the cloud; nothing local is ever mutated or deleted (the REQ-D95 invariant).
 */
function defaultBackfillDeps(
  client: ConvexReactClient,
  scope: Awaited<ReturnType<typeof syncScope>>
): BackfillDeps {
  return {
    listLocalRows: (table) => {
      scope.assertCurrent();
      return listPendingEntityRows(table)
        .filter((row) => !row.deleted && row.doc)
        .map((row) => ({ ...(row.doc as Record<string, unknown>), clientId: row.id }));
    },
    pushChunk: async (table, rows) => {
      scope.assertCurrent();
      const result = (await client.mutation(
        makeFunctionReference<"mutation">("tierTransition:backfillRows"),
        { table, rows } as never
      )) as BackfillChunkResult;
      // Remember which server row each local row became, so later pulls land on the same local id
      // instead of duplicating it, and mark the local row acknowledged.
      scope.assertCurrent();
      for (const { clientId, id } of result.ids ?? []) {
        setServerId(clientId, id);
        markEntityRowSynced(table, clientId);
      }
      return result;
    },
    isComplete: () => {
      scope.assertCurrent();
      return isBackfillComplete();
    },
    markComplete: () => {
      scope.assertCurrent();
      setBackfillComplete();
    },
    onProgress: (progress) => {
      scope.assertCurrent();
      setBackfillProgress(progress);
    },
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
  deps?: BackfillDeps
): Promise<BackfillProgress> {
  if (!isPaidConvexTier(tier) || !getIsOnline()) return IDLE_BACKFILL;
  const scope = await syncScope();
  if (!scope.current()) return IDLE_BACKFILL;
  const source = deps ?? defaultBackfillDeps(client, scope);
  return runUpgradeBackfill({
    listLocalRows: (table) => {
      scope.assertCurrent();
      return source.listLocalRows(table);
    },
    pushChunk: async (table, rows) => {
      scope.assertCurrent();
      const result = await source.pushChunk(table, rows);
      scope.assertCurrent();
      return result;
    },
    isComplete: () => {
      scope.assertCurrent();
      return source.isComplete();
    },
    markComplete: async () => {
      scope.assertCurrent();
      await source.markComplete();
      scope.assertCurrent();
    },
    onProgress: (progress) => {
      scope.assertCurrent();
      source.onProgress?.(progress);
    },
  });
}
