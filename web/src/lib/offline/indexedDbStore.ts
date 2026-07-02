/**
 * IndexedDB-backed `LocalStore` (DATA_AND_SYNC.md §5). The production web storage engine, using the
 * repo's existing `idb` dependency (same pattern as `web/src/lib/images/localImageStore.ts`).
 *
 * The schema mirrors mobile's SQLite tables: `query_cache`, `entity_rows`, `mutation_queue`,
 * `id_map`, `sync_meta`. Because everything callers touch goes through the `LocalStore` interface,
 * the spec's eventual OPFS + wa-sqlite engine can replace this file without changing any caller.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
import { openDB, type IDBPDatabase } from "idb";
import type {
  EnqueueMutationInput,
  LocalStore,
  PendingMutation,
  StoredEntityRow,
  StoredQueryCache,
} from "./localStore";

const DB_NAME = "kyarafit-offline";
const DB_VERSION = 1;

const QUERY_CACHE = "query_cache";
const ENTITY_ROWS = "entity_rows";
const MUTATION_QUEUE = "mutation_queue";
const ID_MAP = "id_map";
const SYNC_META = "sync_meta";
const CURSOR_KEY = "listChangedSince:cursor";
const LAST_SYNCED_KEY = "sync:lastSyncedAt";

interface MutationQueueRecord {
  id?: number;
  idempotency_key: string;
  fn: string;
  args_json: string;
  retry_count: number;
  client_id: string | null;
  status: string;
  created_at: number;
}

export class IndexedDbLocalStore implements LocalStore {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
          if (!database.objectStoreNames.contains(QUERY_CACHE)) {
            database.createObjectStore(QUERY_CACHE, { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains(ENTITY_ROWS)) {
            // Compound key [table, id] mirrors the SQLite PRIMARY KEY (table_name, id).
            database.createObjectStore(ENTITY_ROWS, { keyPath: ["table", "id"] });
          }
          if (!database.objectStoreNames.contains(MUTATION_QUEUE)) {
            const queue = database.createObjectStore(MUTATION_QUEUE, {
              keyPath: "id",
              autoIncrement: true,
            });
            queue.createIndex("idempotency_key", "idempotency_key", { unique: true });
            queue.createIndex("status", "status", { unique: false });
          }
          if (!database.objectStoreNames.contains(ID_MAP)) {
            database.createObjectStore(ID_MAP, { keyPath: "client_id" });
          }
          if (!database.objectStoreNames.contains(SYNC_META)) {
            database.createObjectStore(SYNC_META, { keyPath: "key" });
          }
        },
      });
    }
    return this.dbPromise;
  }

  async readQueryCache(key: string): Promise<StoredQueryCache | undefined> {
    const db = await this.db();
    const row = (await db.get(QUERY_CACHE, key)) as
      | { key: string; payload_json: string; fetched_at: number }
      | undefined;
    if (!row) return undefined;
    return { key: row.key, payloadJson: row.payload_json, fetchedAt: row.fetched_at };
  }

  async writeQueryCache(key: string, payloadJson: string): Promise<void> {
    const db = await this.db();
    await db.put(QUERY_CACHE, { key, payload_json: payloadJson, fetched_at: Date.now() });
  }

  async putEntityRow(row: StoredEntityRow): Promise<void> {
    const db = await this.db();
    await db.put(ENTITY_ROWS, { ...row });
  }

  async deleteEntityRow(table: string, id: string): Promise<void> {
    const db = await this.db();
    await db.delete(ENTITY_ROWS, [table, id]);
  }

  async listEntityRows(): Promise<StoredEntityRow[]> {
    const db = await this.db();
    return (await db.getAll(ENTITY_ROWS)) as StoredEntityRow[];
  }

  async enqueueMutation(input: EnqueueMutationInput): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(MUTATION_QUEUE, "readwrite");
    const index = tx.store.index("idempotency_key");
    const existing = await index.getKey(input.idempotencyKey);
    if (existing === undefined) {
      const record: MutationQueueRecord = {
        idempotency_key: input.idempotencyKey,
        fn: input.fn,
        args_json: input.argsJson,
        retry_count: 0,
        client_id: input.clientId,
        status: "pending",
        created_at: Date.now(),
      };
      await tx.store.add(record);
    }
    await tx.done;
  }

  async listPendingMutations(limit = 100): Promise<PendingMutation[]> {
    const db = await this.db();
    const all = (await db.getAll(MUTATION_QUEUE)) as MutationQueueRecord[];
    return all
      .filter((row) => row.status === "pending")
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      .slice(0, limit)
      .map((row) => ({
        id: row.id ?? 0,
        idempotency_key: row.idempotency_key,
        fn: row.fn,
        args_json: row.args_json,
        retry_count: row.retry_count,
        client_id: row.client_id,
      }));
  }

  async deleteMutation(id: number): Promise<void> {
    const db = await this.db();
    await db.delete(MUTATION_QUEUE, id);
  }

  async bumpMutationRetry(id: number): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(MUTATION_QUEUE, "readwrite");
    const row = (await tx.store.get(id)) as MutationQueueRecord | undefined;
    if (row) {
      row.retry_count += 1;
      await tx.store.put(row);
    }
    await tx.done;
  }

  async failMutation(id: number): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(MUTATION_QUEUE, "readwrite");
    const row = (await tx.store.get(id)) as MutationQueueRecord | undefined;
    if (row) {
      row.status = "failed";
      await tx.store.put(row);
    }
    await tx.done;
  }

  async countPendingMutations(): Promise<number> {
    const db = await this.db();
    const all = (await db.getAll(MUTATION_QUEUE)) as MutationQueueRecord[];
    return all.filter((row) => row.status === "pending").length;
  }

  async countFailedMutations(): Promise<number> {
    const db = await this.db();
    const all = (await db.getAll(MUTATION_QUEUE)) as MutationQueueRecord[];
    return all.filter((row) => row.status === "failed").length;
  }

  async requeueFailedMutations(): Promise<number> {
    const db = await this.db();
    const tx = db.transaction(MUTATION_QUEUE, "readwrite");
    const all = (await tx.store.getAll()) as MutationQueueRecord[];
    let n = 0;
    for (const row of all) {
      if (row.status === "failed") {
        row.status = "pending";
        row.retry_count = 0;
        await tx.store.put(row);
        n += 1;
      }
    }
    await tx.done;
    return n;
  }

  async setServerId(clientId: string, serverId: string): Promise<void> {
    const db = await this.db();
    await db.put(ID_MAP, { client_id: clientId, server_id: serverId, synced_at: Date.now() });
  }

  async loadIdMap(): Promise<Record<string, string>> {
    const db = await this.db();
    const rows = (await db.getAll(ID_MAP)) as { client_id: string; server_id: string }[];
    const map: Record<string, string> = {};
    for (const row of rows) map[row.client_id] = row.server_id;
    return map;
  }

  async getSyncCursor(): Promise<number> {
    const db = await this.db();
    const row = (await db.get(SYNC_META, CURSOR_KEY)) as { value: string } | undefined;
    const parsed = row ? Number(row.value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async setSyncCursor(cursor: number): Promise<void> {
    const db = await this.db();
    await db.put(SYNC_META, { key: CURSOR_KEY, value: String(cursor) });
  }

  async getLastSyncedAt(): Promise<number | null> {
    const db = await this.db();
    const row = (await db.get(SYNC_META, LAST_SYNCED_KEY)) as { value: string } | undefined;
    const parsed = row ? Number(row.value) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async setLastSyncedAt(ts: number): Promise<void> {
    const db = await this.db();
    await db.put(SYNC_META, { key: LAST_SYNCED_KEY, value: String(ts) });
  }

  async clearAll(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(
      [QUERY_CACHE, ENTITY_ROWS, MUTATION_QUEUE, ID_MAP, SYNC_META],
      "readwrite"
    );
    await Promise.all([
      tx.objectStore(QUERY_CACHE).clear(),
      tx.objectStore(ENTITY_ROWS).clear(),
      tx.objectStore(MUTATION_QUEUE).clear(),
      tx.objectStore(ID_MAP).clear(),
      tx.objectStore(SYNC_META).clear(),
    ]);
    await tx.done;
  }
}
