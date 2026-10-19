import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { unlockVault, lockVault, requireActiveVault } from "@/vault/activeVault";
import { getServerId } from "./idMap";
import { deleteVaultDatabase, getOfflineDb } from "./db";
import { setOfflineConnectivity } from "./connectivity";
import {
  drainMutationQueue,
  warmEntityRows,
  uploadLocalImages,
  runBackfill,
  syncNow,
} from "./syncWorker";

const h = vi.hoisted(() => ({
  token: "credential-a" as string | null,
  subject: "owner",
  listeners: new Set<() => void>(),
}));
vi.mock("@/lib/auth/bearer-storage-plugin", () => ({
  getBearerToken: () => h.token,
  subscribeBearerToken: (listener: () => void) => {
    h.listeners.add(listener);
    return () => h.listeners.delete(listener);
  },
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { getSession: async () => ({ data: { user: { id: h.subject } }, error: null }) },
}));

function changeCredential(token: string) {
  h.token = token;
  for (const listener of h.listeners) listener();
}
function enqueue(key: string) {
  getOfflineDb().runSync(
    `INSERT INTO mutation_queue (idempotency_key, op, fn, args_json, created_at, status)
    VALUES (?, 'mutation', 'builds:update', '{}', 1, 'pending')`,
    [key]
  );
}

beforeEach(async () => {
  h.token = "credential-a";
  h.subject = "owner";
  setOfflineConnectivity(true);
  await unlockVault({ subject: "owner", lastVerifiedAt: 1 });
  enqueue("first");
  enqueue("second");
});
afterEach(async () => {
  await lockVault();
  await deleteVaultDatabase("owner");
});

describe("sync credential ownership", () => {
  it("sends nothing on every sync entry point when the credential belongs to another account", async () => {
    h.subject = "other";
    const mutation = vi.fn();
    const query = vi.fn();
    const client = { mutation, query } as unknown as ConvexReactClient;
    const listLocalRows = vi.fn();
    const pushChunk = vi.fn();
    const listSyncedRows = vi.fn();
    await drainMutationQueue(client);
    await warmEntityRows(client);
    await uploadLocalImages(client, "PRO", {
      listSyncedRows,
      writeSyncedRow: vi.fn(),
      readImageBytes: vi.fn(),
      uploadBytes: vi.fn(),
    });
    await runBackfill(client, "PRO", {
      listLocalRows,
      pushChunk,
      isComplete: () => false,
      markComplete: vi.fn(),
    });
    await syncNow(client, { tier: "PRO" });
    expect(mutation).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(pushChunk).not.toHaveBeenCalled();
    expect(listLocalRows).not.toHaveBeenCalled();
    expect(listSyncedRows).not.toHaveBeenCalled();
    expect(
      getOfflineDb().getAllSync("SELECT * FROM mutation_queue WHERE status = 'pending'")
    ).toHaveLength(2);
  });

  it("aborts a pass on credential replacement, even if the same token returns", async () => {
    const mutation = vi.fn().mockImplementation(async () => {
      changeCredential("credential-b");
      changeCredential("credential-a");
      return null;
    });
    const result = await drainMutationQueue({ mutation } as unknown as ConvexReactClient);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(0);
    expect(
      getOfflineDb().getAllSync("SELECT * FROM mutation_queue WHERE status = 'pending'")
    ).toHaveLength(2);
  });

  it("reconciles restored client identities before rewriting pulled references", async () => {
    const store = requireActiveVault();
    store.importRows([
      { table: "builds", id: "local:build", doc: { userId: "owner", name: "Restored", updatedAt: 1 } },
      { table: "workflowItems", id: "local:task", doc: { userId: "owner", title: "Restored task", updatedAt: 1 } },
    ], "owner");
    const query = vi.fn().mockResolvedValue({ cursor: 10,
      builds: [{ _id: "server-build", clientId: "local:build", userId: "owner" }],
      workflowItems: [{ _id: "server-task", clientId: "local:task", userId: "owner" }],
      workflowAttachments: [{ _id: "server-attachment", userId: "owner",
        workflowItemId: "server-task", entityId: "server-build" }],
      cosplayNodes: [{ _id: "server-element", userId: "owner", buildId: "server-build" }],
    });
    const client = { query } as unknown as ConvexReactClient;
    await warmEntityRows(client);
    await warmEntityRows(client);
    expect(getServerId("local:build")).toBe("server-build");
    expect(getServerId("local:task")).toBe("server-task");
    expect(store.exportRows().filter((row) => row.table === "builds")).toHaveLength(1);
    expect(store.exportRows().filter((row) => row.table === "workflowItems")).toHaveLength(1);
    expect(store.reader().get("local:build")?.name).toBe("Restored");
    expect(store.reader().get("server-attachment")).toMatchObject({
      workflowItemId: "local:task", entityId: "local:build",
    });
    expect(store.reader().get("server-element")?.buildId).toBe("local:build");
    expect(store.reader().get("server-build")).toBeNull();
  });

  it("drains normally with a confirmed matching account", async () => {
    const mutation = vi.fn().mockResolvedValue(null);
    const result = await drainMutationQueue({ mutation } as unknown as ConvexReactClient);
    expect(mutation).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(getOfflineDb().getAllSync("SELECT * FROM mutation_queue")).toEqual([]);
  });
});
