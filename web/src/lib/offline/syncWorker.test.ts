import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import {
  runBackfill,
  syncNow,
  uploadLocalImages,
  warmEntityRows,
  type ImageUploadDeps,
} from "./syncWorker";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";

// Spec: DATA_AND_SYNC.md §6. Warm-up (REQ-D63) must hydrate EVERY local-first table returned by
// `sync.listChangedSince`, and the sync-status surface (REQ-D64) exposes last-synced + failed state
// with a manual "sync now" that drains the queue.

/** Every local-first table `sync.listChangedSince` returns (mirror of `convex/sync.ts`). */
const ALL_TABLES = [
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

function fakeClientReturningAllTables(): ConvexReactClient {
  // One doc per table, cursor > 0 so it persists; short pages so warm-up stops after one page.
  const payload: Record<string, unknown> = { cursor: 10 };
  for (const table of ALL_TABLES) {
    payload[table] = [{ _id: `${table}_1`, userId: "user_1", name: table }];
  }
  return {
    query: vi.fn(() => Promise.resolve(payload)),
    mutation: vi.fn(() => Promise.resolve(null)),
  } as unknown as ConvexReactClient;
}

beforeEach(() => {
  offlineRuntime.setStore(new InMemoryLocalStore());
  setOfflineConnectivity(true);
});

describe("warmEntityRows (REQ-D63)", () => {
  it("should_return_changed_rows_for_all_local_first_tables", async () => {
    const client = fakeClientReturningAllTables();

    await warmEntityRows(client);

    // Every table the server returned must be hydrated locally — not just builds/conventions.
    for (const table of ALL_TABLES) {
      const rows = offlineRuntime.listSyncedEntityRowsSync(table);
      expect(rows, `expected a synced row for table "${table}"`).toHaveLength(1);
      expect(rows[0]._id).toBe(`${table}_1`);
    }
  });

  it("advances and persists the cursor from the payload", async () => {
    const client = fakeClientReturningAllTables();
    await warmEntityRows(client);
    expect(await offlineRuntime.getSyncCursor()).toBe(10);
  });

  it("records the last-synced timestamp on success (REQ-D64)", async () => {
    const client = fakeClientReturningAllTables();
    expect(await offlineRuntime.getLastSyncedAt()).toBeNull();

    await warmEntityRows(client);

    expect(await offlineRuntime.getLastSyncedAt()).not.toBeNull();
  });
});

describe("syncNow (REQ-D64)", () => {
  it("should_show_pending_badge_and_last_synced", async () => {
    // A queued offline write shows as pending until it drains; a manual sync then drains it and
    // stamps the last-synced time.
    await offlineRuntime.enqueueMutation("builds:create", { userId: "u" }, "key-1", "local:1");
    expect(await offlineRuntime.countPendingMutations()).toBe(1);

    const client = {
      query: vi.fn(() => Promise.resolve({ cursor: 1 })),
      mutation: vi.fn(() => Promise.resolve({ _id: "srv_1" })),
    } as unknown as ConvexReactClient;

    await syncNow(client);

    expect(client.mutation).toHaveBeenCalledTimes(1);
    expect(await offlineRuntime.countPendingMutations()).toBe(0);
    expect(await offlineRuntime.getLastSyncedAt()).not.toBeNull();
  });

  it("should_surface_failed_sync_state", async () => {
    // A row past the retry ceiling is marked failed and surfaced (not silently dropped)...
    await offlineRuntime.enqueueMutation("builds:create", { userId: "u" }, "key-2", "local:2");
    const [pending] = await offlineRuntime.listPendingMutations();
    await offlineRuntime.failMutation(pending.id);

    expect(await offlineRuntime.countFailedMutations()).toBe(1);
    expect(await offlineRuntime.countPendingMutations()).toBe(0);

    // ...and a manual "sync now" requeues it and retries (actionable error state).
    const client = {
      query: vi.fn(() => Promise.resolve({ cursor: 1 })),
      mutation: vi.fn(() => Promise.resolve({ _id: "srv_2" })),
    } as unknown as ConvexReactClient;

    await syncNow(client);

    expect(client.mutation).toHaveBeenCalledTimes(1);
    expect(await offlineRuntime.countFailedMutations()).toBe(0);
    expect(await offlineRuntime.countPendingMutations()).toBe(0);
  });
});

// Spec: DATA_AND_SYNC.md §7 (REQ-D70/D71). Paid image upload is a sync step: on drain, a local
// ImageRef is uploaded to Convex storage and flipped to `cloud`, keeping the local copy as cache.
// Free users NEVER upload (REQ-D10 zero-Convex-calls invariant); upload failures preserve the local
// ref for retry (REQ-D70, local is the durable home).
describe("uploadLocalImages (REQ-D71)", () => {
  /** A client that records mutation calls by function name and returns a canned upload URL. */
  function fakeUploadClient(
    overrides: {
      mirror?: () => unknown;
    } = {}
  ): { client: ConvexReactClient; calls: { fn: string; args: unknown }[] } {
    const calls: { fn: string; args: unknown }[] = [];
    const client = {
      query: vi.fn(() => Promise.resolve(null)),
      mutation: vi.fn((ref: unknown, args: unknown) => {
        const fn = getFunctionName(ref as never);
        calls.push({ fn, args });
        if (fn === "files:generateUploadUrl") return Promise.resolve("https://upload.example/x");
        return Promise.resolve(overrides.mirror ? overrides.mirror() : { _id: "x" });
      }),
    } as unknown as ConvexReactClient;
    return { client, calls };
  }

  function depsWith(
    rows: Record<string, Record<string, unknown>[]>,
    upload: ImageUploadDeps["uploadBytes"],
    written: { table: string; id: string; doc: Record<string, unknown> }[]
  ): ImageUploadDeps {
    return {
      listSyncedRows: (table) => rows[table] ?? [],
      writeSyncedRow: (table, id, _userId, doc) => written.push({ table, id, doc }),
      readImageBytes: async () => ({ body: new Blob(["bytes"]), contentType: "image/png" }),
      uploadBytes: upload,
    };
  }

  it("should_upload_local_image_and_convert_to_cloud_on_sync_for_paid", async () => {
    const { client, calls } = fakeUploadClient();
    const written: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps = depsWith(
      {
        buildProgressUpdates: [
          {
            _id: "pu_1",
            userId: "user_1",
            imageRefs: [{ kind: "local", uri: "blob:1", imageKey: "local_a" }],
          },
        ],
      },
      async () => "storage_1",
      written
    );

    const result = await uploadLocalImages(client, "PRO", deps);

    expect(result).toEqual({ uploaded: 1, failed: 0 });
    // Requested an upload URL, then flipped the ref via the idempotent progress-update mutation.
    expect(calls.map((c) => c.fn)).toEqual([
      "files:generateUploadUrl",
      "buildProgressUpdates:update",
    ]);
    expect(calls[1].args).toEqual({
      id: "pu_1",
      userId: "user_1",
      imageRefs: [{ kind: "cloud", storageId: "storage_1", imageKey: "local_a" }],
    });
    // The local mirror is flipped to cloud so a later sync does not re-upload the same image.
    expect(written).toHaveLength(1);
    expect(written[0].doc.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_1", imageKey: "local_a" },
    ]);
  });

  it("should_not_attempt_any_upload_or_convex_call_for_free_users", async () => {
    const { client, calls } = fakeUploadClient();
    const uploadBytes = vi.fn(async () => "storage_1");
    const deps = depsWith(
      {
        buildProgressUpdates: [
          {
            _id: "pu_1",
            userId: "user_1",
            imageRefs: [{ kind: "local", uri: "blob:1", imageKey: "local_a" }],
          },
        ],
      },
      uploadBytes,
      []
    );

    const result = await uploadLocalImages(client, "FREE", deps);

    expect(result).toEqual({ uploaded: 0, failed: 0 });
    expect(client.mutation).not.toHaveBeenCalled();
    expect(uploadBytes).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("should_preserve_local_ref_and_retry_next_sync_on_upload_failure", async () => {
    const { client } = fakeUploadClient();
    const written: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps = depsWith(
      {
        buildProgressUpdates: [
          {
            _id: "pu_1",
            userId: "user_1",
            imageRefs: [{ kind: "local", uri: "blob:1", imageKey: "local_a" }],
          },
        ],
      },
      async () => null, // upload POST fails
      written
    );

    const result = await uploadLocalImages(client, "PRO", deps);

    expect(result).toEqual({ uploaded: 0, failed: 1 });
    // No flip mutation, no local write-back: the local ref stays intact for the next sync.
    expect(written).toHaveLength(0);
    // A subsequent sync (upload now succeeds) uploads and flips it.
    const written2: { table: string; id: string; doc: Record<string, unknown> }[] = [];
    const deps2 = depsWith(
      {
        buildProgressUpdates: [
          {
            _id: "pu_1",
            userId: "user_1",
            imageRefs: [{ kind: "local", uri: "blob:1", imageKey: "local_a" }],
          },
        ],
      },
      async () => "storage_9",
      written2
    );
    const retry = await uploadLocalImages(client, "PRO", deps2);
    expect(retry).toEqual({ uploaded: 1, failed: 0 });
    expect(written2[0].doc.imageRefs).toEqual([
      { kind: "cloud", storageId: "storage_9", imageKey: "local_a" },
    ]);
  });
});

describe("runBackfill (REQ-D95 upgrade backfill trigger)", () => {
  function seedPendingBuilds(): void {
    offlineRuntime.setStore(new InMemoryLocalStore());
    offlineRuntime.writeEntityOverlay(
      "builds",
      "local:b1",
      "user_1",
      { _id: "local:b1", userId: "user_1", name: "Aerith", status: "idea" },
      false
    );
    offlineRuntime.writeEntityOverlay(
      "builds",
      "local:b2",
      "user_1",
      { _id: "local:b2", userId: "user_1", name: "Cloud", status: "idea" },
      false
    );
  }

  it("should_make_zero_convex_calls_for_a_free_user", async () => {
    seedPendingBuilds();
    const mutation = vi.fn(() => Promise.resolve(null));
    const client = { mutation } as unknown as ConvexReactClient;

    const result = await runBackfill(client, "FREE");

    expect(mutation).not.toHaveBeenCalled();
    expect(result).toEqual({ running: false, done: 0, total: 0 });
    // Never marks a free device complete, so a later upgrade still backfills.
    expect(await offlineRuntime.getMeta("backfill:complete")).toBeNull();
  });

  it("should_make_zero_convex_calls_when_signed_out_or_missing_tier", async () => {
    seedPendingBuilds();
    const mutation = vi.fn(() => Promise.resolve(null));
    const client = { mutation } as unknown as ConvexReactClient;

    expect(await runBackfill(client, null)).toEqual({ running: false, done: 0, total: 0 });
    expect(await runBackfill(client, undefined)).toEqual({ running: false, done: 0, total: 0 });
    expect(mutation).not.toHaveBeenCalled();
  });

  it("should_push_pending_local_rows_and_mark_complete_for_a_paid_user", async () => {
    seedPendingBuilds();
    const calls: Array<{ fn: string; args: unknown }> = [];
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

    const result = await runBackfill(client, "PRO");

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("tierTransition:backfillRows");
    const args = calls[0].args as { table: string; rows: Array<Record<string, unknown>> };
    expect(args.table).toBe("builds");
    expect(args.rows.map((r) => r.clientId).sort()).toEqual(["local:b1", "local:b2"]);
    expect(result).toEqual({ running: false, done: 2, total: 2 });
    expect(await offlineRuntime.getMeta("backfill:complete")).toBe("1");

    // Idempotent: a second run respects the per-device marker — no further Convex calls.
    await runBackfill(client, "PRO");
    expect(calls).toHaveLength(1);
  });
});
