import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import {
  closeVaultDatabase,
  deleteVaultDatabase,
  enforceOfflineStorageCaps,
  getOfflineDb,
  openVaultDatabase,
  OFFLINE_QUERY_CACHE_CAP_BYTES,
  pruneOfflineTombstones,
} from "./db";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue } from "./syncWorker";

/**
 * The replication queue and the client→server id map are user intent, not cache: maintenance must
 * never evict them, and the drain must never drop a row it could not deliver.
 */

const SUBJECT = "user_queue";

function enqueue(n: number, status: "pending" | "failed" = "pending", args = "{}") {
  const db = getOfflineDb();
  for (let i = 0; i < n; i += 1) {
    db.runSync(
      `INSERT INTO mutation_queue (idempotency_key, op, fn, args_json, created_at, status, touched_json)
       VALUES (?, 'mutation', 'builds:update', ?, ?, ?, '[]')`,
      [`k-${status}-${i}-${Math.random()}`, args, i, status]
    );
  }
}

const count = (sql: string) => getOfflineDb().getFirstSync<{ c: number }>(sql)?.c ?? 0;

beforeEach(() => {
  openVaultDatabase(SUBJECT);
  setOfflineConnectivity(true);
});

afterEach(async () => {
  closeVaultDatabase();
  await deleteVaultDatabase(SUBJECT);
});

describe("queue durability", () => {
  it("maintenance never evicts pending ops, failed ops, or id mappings — only disposable cache", () => {
    enqueue(12_000);
    enqueue(5, "failed");
    const db = getOfflineDb();
    for (let i = 0; i < 2_000; i += 1) {
      db.runSync("INSERT INTO id_map (client_id, server_id, synced_at) VALUES (?, ?, ?)", [
        `local:${i}`,
        `srv${i}`,
        i,
      ]);
    }
    const big = "x".repeat(1024 * 1024);
    const cacheRows = Math.ceil(OFFLINE_QUERY_CACHE_CAP_BYTES / big.length) + 5;
    for (let i = 0; i < cacheRows; i += 1) {
      db.runSync("INSERT INTO query_cache (query_key, payload_json, fetched_at) VALUES (?, ?, ?)", [
        `q${i}`,
        big,
        i,
      ]);
    }

    enforceOfflineStorageCaps();
    pruneOfflineTombstones(Date.now() + 1);

    expect(count("SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'pending'")).toBe(12_000);
    expect(count("SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'failed'")).toBe(5);
    expect(count("SELECT COUNT(*) AS c FROM id_map")).toBe(2_000);
    expect(count("SELECT COUNT(*) AS c FROM query_cache")).toBeLessThan(cacheRows);
  });

  it("pending tombstones (unsynced deletes) survive tombstone pruning", () => {
    const db = getOfflineDb();
    db.runSync(
      `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
       VALUES ('builds', 'srv1', 'u', '{}', 1, NULL, 1), ('builds', 'srv2', 'u', '{}', 1, 1, 1)`
    );
    pruneOfflineTombstones(Date.now());
    const ids = db.getAllSync<{ id: string }>("SELECT id FROM entity_rows").map((r) => r.id);
    expect(ids).toEqual(["srv1"]);
  });

  it("drain parks undeliverable rows as failed instead of deleting them", async () => {
    enqueue(1, "pending", "{not json");
    enqueue(2);
    const client = {
      mutation: vi.fn().mockRejectedValue(new Error("server error")),
    } as unknown as ConvexReactClient;

    const result = await drainMutationQueue(client);

    expect(result.processed).toBe(0);
    expect(count("SELECT COUNT(*) AS c FROM mutation_queue")).toBe(3);
    expect(count("SELECT COUNT(*) AS c FROM mutation_queue WHERE status = 'failed'")).toBe(1);
  });

  it("drain removes a row only after the server accepted it, across multiple batches", async () => {
    enqueue(250);
    const client = { mutation: vi.fn().mockResolvedValue(null) } as unknown as ConvexReactClient;
    const result = await drainMutationQueue(client);
    expect(result.processed).toBe(250);
    expect(count("SELECT COUNT(*) AS c FROM mutation_queue")).toBe(0);
  });

  it("going offline mid-drain keeps the remaining rows queued without burning retries", async () => {
    enqueue(3);
    const client = {
      mutation: vi.fn().mockImplementation(async () => {
        setOfflineConnectivity(false);
        throw new Error("network");
      }),
    } as unknown as ConvexReactClient;
    await drainMutationQueue(client);
    expect(
      getOfflineDb().getAllSync<{ retry_count: number; status: string }>(
        "SELECT retry_count, status FROM mutation_queue"
      )
    ).toEqual([
      { retry_count: 0, status: "pending" },
      { retry_count: 0, status: "pending" },
      { retry_count: 0, status: "pending" },
    ]);
  });
});
