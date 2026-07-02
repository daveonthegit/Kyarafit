import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { syncNow, warmEntityRows } from "./syncWorker";
import { offlineRuntime } from "./runtime";
import { InMemoryLocalStore } from "./localStore";
import { setOfflineConnectivity } from "./connectivity";

// Spec: DATA_AND_SYNC.md §6. Warm-up (REQ-D63) must hydrate EVERY local-first table returned by
// `sync.listChangedSince`, and the sync-status surface (REQ-D64) exposes last-synced + failed state
// with a manual "sync now" that drains the queue.

/** Every local-first table `sync.listChangedSince` returns (mirror of `convex/sync.ts`). */
const ALL_TABLES = [
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
