import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { unlockVault, lockVault } from "@/vault/activeVault";
import { deleteVaultDatabase, getOfflineDb } from "./db";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, warmEntityRows, uploadLocalImages, runBackfill, syncNow } from "./syncWorker";

const h = vi.hoisted(() => ({
  token: "credential-a" as string | null,
  subject: "owner",
  listeners: new Set<() => void>(),
}));
vi.mock("@/lib/auth/bearer-storage-plugin", () => ({
  getBearerToken: () => h.token,
  subscribeBearerToken: (listener: () => void) => { h.listeners.add(listener); return () => h.listeners.delete(listener); },
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { getSession: async () => ({ data: { user: { id: h.subject } }, error: null }) },
}));

function changeCredential(token: string) {
  h.token = token;
  for (const listener of h.listeners) listener();
}
function enqueue(key: string) {
  getOfflineDb().runSync(`INSERT INTO mutation_queue (idempotency_key, op, fn, args_json, created_at, status)
    VALUES (?, 'mutation', 'builds:update', '{}', 1, 'pending')`, [key]);
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
    await uploadLocalImages(client, "PRO", { listSyncedRows, writeSyncedRow: vi.fn(), readImageBytes: vi.fn(), uploadBytes: vi.fn() });
    await runBackfill(client, "PRO", { listLocalRows, pushChunk, isComplete: () => false, markComplete: vi.fn() });
    await syncNow(client, { tier: "PRO" });
    expect(mutation).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(pushChunk).not.toHaveBeenCalled();
    expect(listLocalRows).not.toHaveBeenCalled();
    expect(listSyncedRows).not.toHaveBeenCalled();
    expect(getOfflineDb().getAllSync("SELECT * FROM mutation_queue WHERE status = 'pending'")).toHaveLength(2);
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
    expect(getOfflineDb().getAllSync("SELECT * FROM mutation_queue WHERE status = 'pending'")).toHaveLength(2);
  });

  it("drains normally with a confirmed matching account", async () => {
    const mutation = vi.fn().mockResolvedValue(null);
    const result = await drainMutationQueue({ mutation } as unknown as ConvexReactClient);
    expect(mutation).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(getOfflineDb().getAllSync("SELECT * FROM mutation_queue")).toEqual([]);
  });
});
