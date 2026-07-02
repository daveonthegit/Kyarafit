/**
 * OPFS + wa-sqlite `LocalStore` engine (DATA_AND_SYNC.md §5). This is the durable web storage engine
 * the spec swaps in to replace IndexedDB (`./indexedDbStore`) in capable browsers. It is selected by
 * the engine factory (`./engineSelection`) and falls back to IndexedDB where OPFS is unavailable.
 *
 * VFS CHOICE — `AccessHandlePoolVFS` (synchronous OPFS AccessHandle pool) on the MAIN THREAD:
 *   - It uses the synchronous wa-sqlite build (`dist/wa-sqlite.mjs`), so no Asyncify overhead.
 *   - It is backed by `FileSystemSyncAccessHandle`, which modern browsers expose on the main thread,
 *     so NO dedicated Web Worker + RPC is required — the simplest correct option.
 *   - It does NOT use `SharedArrayBuffer`, so it works WITHOUT cross-origin isolation. We therefore
 *     do not need COOP/COEP response headers (which would otherwise break third-party embeds/auth).
 *
 * WASM LOADING UNDER NEXT — wa-sqlite is imported dynamically inside `init()` (never at module top
 * level), so it stays out of the SSR/test bundle and only loads in the browser. The Emscripten glue
 * resolves `wa-sqlite.wasm` via `new URL("wa-sqlite.wasm", import.meta.url)`, which Next's bundler
 * (webpack/Turbopack) rewrites into an emitted asset URL and fetches at runtime.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
import type {
  EnqueueMutationInput,
  LocalStore,
  PendingMutation,
  StoredEntityRow,
  StoredQueryCache,
} from "./localStore";

/** OPFS directory that holds the SQLite database + journal files for the AccessHandle pool. */
const OPFS_DIRECTORY = "/kyarafit-offline";
/** SQLite database filename within the pool. */
const DB_FILENAME = "kyarafit.db";
const CURSOR_KEY = "listChangedSince:cursor";
const LAST_SYNCED_KEY = "sync:lastSyncedAt";

/** Logical table names (mirrors the IndexedDB object stores + mobile's SQLite tables). */
const TABLES = {
  queryCache: "query_cache",
  entityRows: "entity_rows",
  mutationQueue: "mutation_queue",
  idMap: "id_map",
  syncMeta: "sync_meta",
} as const;

/**
 * DDL for the logical store, mirroring the IndexedDB schema:
 *   - `entity_rows` keyed by (table_name, id) with a `synced` flag,
 *   - `mutation_queue` with an autoincrement id + UNIQUE idempotency_key (FIFO + dedupe),
 *   - `id_map`, `sync_meta`, `query_cache`.
 * Pure + side-effect free so it can be unit-tested in isolation.
 */
export function buildSchemaStatements(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${TABLES.queryCache} (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${TABLES.entityRows} (
      table_name TEXT NOT NULL,
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted INTEGER NOT NULL,
      synced INTEGER NOT NULL,
      PRIMARY KEY (table_name, id)
    )`,
    `CREATE TABLE IF NOT EXISTS ${TABLES.mutationQueue} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      fn TEXT NOT NULL,
      args_json TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      client_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS ${TABLES.mutationQueue}_status ON ${TABLES.mutationQueue} (status, id)`,
    `CREATE TABLE IF NOT EXISTS ${TABLES.idMap} (
      client_id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ${TABLES.syncMeta} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];
}

/** SQLite column values we read/write (text + integers only for this store). */
type SqlValue = string | number | null;

/** SQLite has no boolean type; persist booleans as 0/1 integers. */
function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: SqlValue): boolean {
  return Number(value) !== 0;
}

/** Bind parameters for an `entity_rows` upsert, in column order. Pure helper (unit-tested). */
export function entityRowToValues(row: StoredEntityRow): SqlValue[] {
  return [
    row.table,
    row.id,
    row.userId,
    row.json,
    row.updatedAt,
    boolToInt(row.deleted),
    boolToInt(row.synced),
  ];
}

/** Reconstruct a `StoredEntityRow` from a raw SQLite result row (column order matches SELECT). Pure. */
export function entityRowFromValues(values: readonly SqlValue[]): StoredEntityRow {
  return {
    table: String(values[0]),
    id: String(values[1]),
    userId: String(values[2]),
    json: String(values[3]),
    updatedAt: Number(values[4]),
    deleted: intToBool(values[5] ?? 0),
    synced: intToBool(values[6] ?? 0),
  };
}

/** Reconstruct a `PendingMutation` from a raw SQLite result row (column order matches SELECT). Pure. */
export function pendingMutationFromValues(values: readonly SqlValue[]): PendingMutation {
  const clientId = values[5];
  return {
    id: Number(values[0]),
    idempotency_key: String(values[1]),
    fn: String(values[2]),
    args_json: String(values[3]),
    retry_count: Number(values[4]),
    client_id: clientId === null || clientId === undefined ? null : String(clientId),
  };
}

/**
 * Capability probe: is the synchronous OPFS AccessHandle pool VFS usable here? Requires OPFS
 * (`navigator.storage.getDirectory`) AND `FileSystemFileHandle.createSyncAccessHandle`. Guarded for
 * SSR (`navigator`/`FileSystemFileHandle` undefined) so it is always safe to call.
 */
export function isWaSqliteOpfsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  const storage = navigator.storage as StorageManager | undefined;
  if (!storage || typeof storage.getDirectory !== "function") return false;
  if (typeof FileSystemFileHandle === "undefined") return false;
  // `createSyncAccessHandle` is newer than this TS lib's DOM types; probe the prototype defensively.
  const proto = FileSystemFileHandle.prototype as unknown as Record<string, unknown>;
  return typeof proto.createSyncAccessHandle === "function";
}

/** Minimal view of the wa-sqlite API surface we use (avoids leaking the library's `any` types). */
interface SqliteApi {
  open_v2(filename: string, flags?: number, vfs?: string): Promise<number>;
  run(db: number, sql: string, params?: SqlValue[] | null): Promise<number>;
  execWithParams(
    db: number,
    sql: string,
    params?: SqlValue[] | null
  ): Promise<{ rows: SqlValue[][]; columns: string[] }>;
  vfs_register(vfs: unknown, makeDefault?: boolean): number;
}

/**
 * SQLite-over-OPFS implementation of the platform-agnostic `LocalStore`. Every method uses
 * parameterized SQL; booleans are stored as 0/1 integers. All browser-only access (wa-sqlite WASM,
 * OPFS) happens lazily inside `init()` so importing this module is SSR/test safe.
 */
export class WaSqliteLocalStore implements LocalStore {
  private sqlite3: SqliteApi | null = null;
  private db = 0;
  private initPromise: Promise<void> | null = null;

  /** Open the database (idempotent). Must succeed before any method is used; the factory awaits it. */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.openDatabase();
    }
    return this.initPromise;
  }

  private async openDatabase(): Promise<void> {
    // Dynamic imports keep wa-sqlite + its WASM out of the SSR/test bundle (browser-only).
    const [factoryModule, sqliteModule, vfsModule] = await Promise.all([
      import("wa-sqlite/dist/wa-sqlite.mjs"),
      import("wa-sqlite"),
      import("wa-sqlite/src/examples/AccessHandlePoolVFS.js"),
    ]);

    const createModule = (
      factoryModule as unknown as {
        default: (config?: Record<string, unknown>) => Promise<unknown>;
      }
    ).default;
    const emscriptenModule = await createModule();
    const sqlite3 = sqliteModule.Factory(emscriptenModule) as unknown as SqliteApi;

    const vfs = new vfsModule.AccessHandlePoolVFS(OPFS_DIRECTORY);
    await vfs.isReady;
    sqlite3.vfs_register(vfs, true);

    const SQLITE_OPEN_CREATE = 0x04;
    const SQLITE_OPEN_READWRITE = 0x02;
    const db = await sqlite3.open_v2(DB_FILENAME, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE);

    for (const statement of buildSchemaStatements()) {
      await sqlite3.run(db, statement);
    }

    this.sqlite3 = sqlite3;
    this.db = db;
  }

  private api(): SqliteApi {
    if (!this.sqlite3) {
      throw new Error("WaSqliteLocalStore.init() must complete before use");
    }
    return this.sqlite3;
  }

  private async select(sql: string, params?: SqlValue[]): Promise<SqlValue[][]> {
    const result = await this.api().execWithParams(this.db, sql, params ?? null);
    return result.rows;
  }

  private async exec(sql: string, params?: SqlValue[]): Promise<void> {
    await this.api().run(this.db, sql, params ?? null);
  }

  // --- query cache (SWR base) ---

  async readQueryCache(key: string): Promise<StoredQueryCache | undefined> {
    const rows = await this.select(
      `SELECT payload_json, fetched_at FROM ${TABLES.queryCache} WHERE key = ?`,
      [key]
    );
    const row = rows[0];
    if (!row) return undefined;
    return { key, payloadJson: String(row[0]), fetchedAt: Number(row[1]) };
  }

  async writeQueryCache(key: string, payloadJson: string): Promise<void> {
    await this.exec(
      `INSERT INTO ${TABLES.queryCache} (key, payload_json, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload_json = excluded.payload_json, fetched_at = excluded.fetched_at`,
      [key, payloadJson, Date.now()]
    );
  }

  // --- entity rows (overlays + synced base) ---

  async putEntityRow(row: StoredEntityRow): Promise<void> {
    await this.exec(
      `INSERT INTO ${TABLES.entityRows}
         (table_name, id, user_id, json, updated_at, deleted, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(table_name, id) DO UPDATE SET
         user_id = excluded.user_id,
         json = excluded.json,
         updated_at = excluded.updated_at,
         deleted = excluded.deleted,
         synced = excluded.synced`,
      entityRowToValues(row)
    );
  }

  async deleteEntityRow(table: string, id: string): Promise<void> {
    await this.exec(`DELETE FROM ${TABLES.entityRows} WHERE table_name = ? AND id = ?`, [
      table,
      id,
    ]);
  }

  async listEntityRows(): Promise<StoredEntityRow[]> {
    const rows = await this.select(
      `SELECT table_name, id, user_id, json, updated_at, deleted, synced FROM ${TABLES.entityRows}`
    );
    return rows.map(entityRowFromValues);
  }

  // --- mutation queue ---

  async enqueueMutation(input: EnqueueMutationInput): Promise<void> {
    // UNIQUE idempotency_key + INSERT OR IGNORE => re-enqueues are dropped (mirrors the IDB engine).
    await this.exec(
      `INSERT OR IGNORE INTO ${TABLES.mutationQueue}
         (idempotency_key, fn, args_json, retry_count, client_id, status, created_at)
       VALUES (?, ?, ?, 0, ?, 'pending', ?)`,
      [input.idempotencyKey, input.fn, input.argsJson, input.clientId, Date.now()]
    );
  }

  async listPendingMutations(limit = 100): Promise<PendingMutation[]> {
    const rows = await this.select(
      `SELECT id, idempotency_key, fn, args_json, retry_count, client_id
       FROM ${TABLES.mutationQueue}
       WHERE status = 'pending'
       ORDER BY id ASC
       LIMIT ?`,
      [limit]
    );
    return rows.map(pendingMutationFromValues);
  }

  async deleteMutation(id: number): Promise<void> {
    await this.exec(`DELETE FROM ${TABLES.mutationQueue} WHERE id = ?`, [id]);
  }

  async bumpMutationRetry(id: number): Promise<void> {
    await this.exec(
      `UPDATE ${TABLES.mutationQueue} SET retry_count = retry_count + 1 WHERE id = ?`,
      [id]
    );
  }

  async failMutation(id: number): Promise<void> {
    await this.exec(`UPDATE ${TABLES.mutationQueue} SET status = 'failed' WHERE id = ?`, [id]);
  }

  async countPendingMutations(): Promise<number> {
    const rows = await this.select(
      `SELECT COUNT(*) FROM ${TABLES.mutationQueue} WHERE status = 'pending'`
    );
    return rows[0] ? Number(rows[0][0]) : 0;
  }

  async countFailedMutations(): Promise<number> {
    const rows = await this.select(
      `SELECT COUNT(*) FROM ${TABLES.mutationQueue} WHERE status = 'failed'`
    );
    return rows[0] ? Number(rows[0][0]) : 0;
  }

  async requeueFailedMutations(): Promise<number> {
    const n = await this.countFailedMutations();
    await this.exec(
      `UPDATE ${TABLES.mutationQueue} SET status = 'pending', retry_count = 0 WHERE status = 'failed'`
    );
    return n;
  }

  // --- id map (clientId -> serverId) ---

  async setServerId(clientId: string, serverId: string): Promise<void> {
    await this.exec(
      `INSERT INTO ${TABLES.idMap} (client_id, server_id, synced_at) VALUES (?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET server_id = excluded.server_id, synced_at = excluded.synced_at`,
      [clientId, serverId, Date.now()]
    );
  }

  async loadIdMap(): Promise<Record<string, string>> {
    const rows = await this.select(`SELECT client_id, server_id FROM ${TABLES.idMap}`);
    const map: Record<string, string> = {};
    for (const row of rows) map[String(row[0])] = String(row[1]);
    return map;
  }

  // --- sync cursor (listChangedSince) ---

  async getSyncCursor(): Promise<number> {
    const rows = await this.select(`SELECT value FROM ${TABLES.syncMeta} WHERE key = ?`, [
      CURSOR_KEY,
    ]);
    const row = rows[0];
    const parsed = row ? Number(row[0]) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async setSyncCursor(cursor: number): Promise<void> {
    await this.exec(
      `INSERT INTO ${TABLES.syncMeta} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [CURSOR_KEY, String(cursor)]
    );
  }

  // --- last-synced timestamp (sync-status, REQ-D64) ---

  async getLastSyncedAt(): Promise<number | null> {
    const rows = await this.select(`SELECT value FROM ${TABLES.syncMeta} WHERE key = ?`, [
      LAST_SYNCED_KEY,
    ]);
    const row = rows[0];
    const parsed = row ? Number(row[0]) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async setLastSyncedAt(ts: number): Promise<void> {
    await this.exec(
      `INSERT INTO ${TABLES.syncMeta} (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [LAST_SYNCED_KEY, String(ts)]
    );
  }

  // --- maintenance ---

  async clearAll(): Promise<void> {
    for (const table of Object.values(TABLES)) {
      await this.exec(`DELETE FROM ${table}`);
    }
  }
}
