import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { isBackfillComplete, setBackfillComplete } from "./syncCursor";
import { unlockVault, lockVault, requireActiveVault } from "@/vault/activeVault";
import { getServerId } from "./idMap";
import { getBuildScopedWorkflow, syncGeneratedWorkflowForNode } from "@/vault/handlers/workflow";
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
    store.importRows(
      [
        {
          table: "builds",
          id: "local:build",
          doc: { userId: "owner", name: "Restored", updatedAt: 1 },
        },
        {
          table: "workflowItems",
          id: "local:task",
          doc: { userId: "owner", title: "Restored task", updatedAt: 1 },
        },
      ],
      "owner"
    );
    const query = vi.fn().mockResolvedValue({
      cursor: 10,
      builds: [{ _id: "server-build", clientId: "local:build", userId: "owner" }],
      workflowItems: [{ _id: "server-task", clientId: "local:task", userId: "owner" }],
      workflowAttachments: [
        {
          _id: "server-attachment",
          userId: "owner",
          workflowItemId: "server-task",
          entityId: "server-build",
        },
      ],
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
      workflowItemId: "local:task",
      entityId: "local:build",
    });
    expect(store.reader().get("server-element")?.buildId).toBe("local:build");
    expect(store.reader().get("server-build")).toBeNull();
  });

  it("normalizes pulled composite keys for workflow visibility and generated-task matching", async () => {
    const store = requireActiveVault();
    store.importRows(
      [
        { table: "builds", id: "local:build", doc: { userId: "owner", name: "Build" } },
        {
          table: "cosplayNodes",
          id: "local:element",
          doc: {
            userId: "owner",
            name: "Element",
            buildId: "local:build",
          },
        },
      ],
      "owner"
    );
    const query = vi.fn().mockResolvedValue({
      cursor: 10,
      builds: [{ _id: "server-build", clientId: "local:build", userId: "owner" }],
      cosplayNodes: [{ _id: "server-element", clientId: "local:element", userId: "owner" }],
      workflowItems: [
        {
          _id: "server-task",
          userId: "owner",
          title: "Work on Element",
          kind: "task",
          category: "craft",
          status: "in_progress",
          ancestorIds: [],
          sortOrder: 0,
          scopeKind: "build_specific",
          sourceKind: "automation",
          dedupeKey: "autogen:wip:server-build:server-element",
        },
      ],
      workflowAttachments: [
        {
          _id: "server-attachment",
          userId: "owner",
          workflowItemId: "server-task",
          entityType: "build",
          entityId: "server-build",
          entityKey: "build:server-build",
          role: "primary",
          buildContextId: "server-build",
        },
        {
          _id: "other-attachment",
          userId: "owner",
          workflowItemId: "server-task",
          entityType: "build",
          entityId: "server-build-extra",
          entityKey: "build:server-build-extra",
          role: "context",
        },
      ],
    });
    await warmEntityRows({ query } as unknown as ConvexReactClient);
    expect(
      getBuildScopedWorkflow({ db: store.reader() }, "local:build")?.items.map((item) => item._id)
    ).toEqual(["server-task"]);
    expect(store.reader().get("server-task")?.dedupeKey).toBe(
      "autogen:wip:local:build:local:element"
    );
    expect(store.reader().get("other-attachment")?.entityKey).toBe("build:server-build-extra");
    store.commit((db) =>
      syncGeneratedWorkflowForNode(
        { db, userId: "owner", now: 20 },
        {
          userId: "owner",
          cosplayNodeId: "local:element",
          buildId: "local:build",
          nodeName: "Element",
          buildStatus: "wip",
        }
      )
    );
    expect(
      store
        .exportRows()
        .filter((row) => row.table === "workflowItems")
        .map((row) => row.id)
    ).toEqual(["server-task"]);
  });

  it("backfills restored identities on reconnect and acknowledges their actual stored rows", async () => {
    const cloud = new Map<string, Record<string, unknown> & { _id: string; clientId: string }>([
      [
        "local:A",
        {
          _id: "server-build",
          clientId: "local:A",
          userId: "owner",
          name: "Original",
          status: "idea",
          updatedAt: 1,
        },
      ],
    ]);
    const pushed: Record<string, unknown>[] = [];
    const query = vi.fn(async (_ref: unknown, args: { since: number }) => ({
      cursor: Math.max(args.since, ...[...cloud.values()].map((doc) => Number(doc.updatedAt))),
      builds: [...cloud.values()].filter((doc) => Number(doc.updatedAt) > args.since),
    }));
    const mutation = vi.fn(async (ref: unknown, args: Record<string, unknown>) => {
      if (getFunctionName(ref as never) !== "tierTransition:backfillRows") return null;
      const { table, rows } = args as { table: string; rows: Record<string, unknown>[] };
      pushed.push(...rows);
      let inserted = 0;
      const ids = rows.map((row) => {
        const clientId = String(row.clientId);
        if (!cloud.has(clientId)) {
          cloud.set(clientId, { ...row, _id: `server-${cloud.size}`, clientId });
          inserted += 1;
        }
        return { clientId, id: cloud.get(clientId)!._id };
      });
      return {
        table,
        total: rows.length,
        inserted,
        skipped: rows.length - inserted,
        cloudCount: cloud.size,
        ids,
      };
    });
    const client = { query, mutation } as unknown as ConvexReactClient;
    await warmEntityRows(client);
    setBackfillComplete();
    const store = requireActiveVault();
    setOfflineConnectivity(false);
    store.importRows(
      [
        {
          table: "builds",
          id: "local:A",
          doc: {
            userId: "owner",
            name: "Restored",
            status: "wip",
            updatedAt: 2,
          },
        },
      ],
      "owner"
    );
    const freshId = store.commit((db) =>
      db.insert("builds", {
        userId: "owner",
        name: "Created offline",
        status: "idea",
      })
    );
    expect(isBackfillComplete()).toBe(false);
    expect(store.reader().get("server-build")?.clientId).toBe("local:A");
    setOfflineConnectivity(true);
    await syncNow(client, { tier: "PRO" });
    expect(await runBackfill(client, "PRO")).toMatchObject({ done: 2, total: 2 });
    expect(pushed.map((row) => row.clientId).sort()).toEqual(["local:A", freshId].sort());
    expect(cloud.size).toBe(2);
    expect(getServerId("server-build")).toBe("server-build");
    expect(getServerId(freshId)).toBe(cloud.get(freshId)?._id);
    const stored = getOfflineDb().getAllSync<{ id: string; synced_at: number | null }>(
      "SELECT id, synced_at FROM entity_rows WHERE table_name = 'builds' AND deleted = 0"
    );
    expect(stored.map((row) => row.id).sort()).toEqual([freshId, "server-build"].sort());
    for (const row of stored) expect(row.synced_at).toEqual(expect.any(Number));
    expect(isBackfillComplete()).toBe(true);
    await warmEntityRows(client);
    expect(store.reader().query("builds").collect()).toHaveLength(2);
    const calls = mutation.mock.calls.length;
    await runBackfill(client, "PRO");
    expect(mutation).toHaveBeenCalledTimes(calls);
  });

  it("drains normally with a confirmed matching account", async () => {
    const mutation = vi.fn().mockResolvedValue(null);
    const result = await drainMutationQueue({ mutation } as unknown as ConvexReactClient);
    expect(mutation).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
    expect(getOfflineDb().getAllSync("SELECT * FROM mutation_queue")).toEqual([]);
  });
});
