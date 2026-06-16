import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";

const DB_NAME = "kyarafit.db";
const CURRENT_VERSION = 2;
const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

export const OFFLINE_STORAGE_CAP_BYTES = 50 * MB;
export const OFFLINE_MUTATION_QUEUE_MAX_ROWS = 10_000;
export const OFFLINE_TOMBSTONE_RETENTION_MS = 30 * DAY_MS;

let _db: SQLiteDatabase | null = null;

function migrate(): void {
  if (!_db) return;
  _db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS query_cache (
      query_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS id_map (
      client_id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      op TEXT NOT NULL,
      fn TEXT NOT NULL,
      args_json TEXT NOT NULL,
      base_version INTEGER,
      client_id TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS entity_rows (
      table_name TEXT NOT NULL,
      id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (table_name, id)
    );
  `);

  const row = _db.getFirstSync<{ version: number }>(
    "SELECT version FROM schema_version WHERE id = 1"
  );
  const v = row?.version ?? 0;

  // v2: add mutation_queue.client_id (fresh DBs already have it via CREATE TABLE above; only
  // pre-existing v1 DBs need the column added). Guard on PRAGMA so re-runs are safe.
  if (v < 2) {
    const columns = _db.getAllSync<{ name: string }>("PRAGMA table_info(mutation_queue)");
    if (!columns.some((column) => column.name === "client_id")) {
      _db.execSync("ALTER TABLE mutation_queue ADD COLUMN client_id TEXT");
    }
  }

  if (v < CURRENT_VERSION) {
    _db.execSync(`UPDATE schema_version SET version = ${CURRENT_VERSION} WHERE id = 1`);
  }
}

export function getOfflineDb(): SQLiteDatabase {
  if (_db) return _db;
  _db = openDatabaseSync(DB_NAME);
  migrate();
  return _db;
}

type OfflineBytesRow = {
  query_cache_bytes: number;
  mutation_queue_bytes: number;
  entity_rows_bytes: number;
  id_map_bytes: number;
};

function estimateOfflineStorageBytes(db: SQLiteDatabase): number {
  const row = db.getFirstSync<OfflineBytesRow>(`
      SELECT
        COALESCE((SELECT SUM(LENGTH(query_key) + LENGTH(payload_json)) FROM query_cache), 0) AS query_cache_bytes,
        COALESCE((SELECT SUM(LENGTH(idempotency_key) + LENGTH(op) + LENGTH(fn) + LENGTH(args_json)) FROM mutation_queue), 0) AS mutation_queue_bytes,
        COALESCE((SELECT SUM(LENGTH(table_name) + LENGTH(id) + LENGTH(user_id) + LENGTH(json)) FROM entity_rows), 0) AS entity_rows_bytes,
        COALESCE((SELECT SUM(LENGTH(client_id) + LENGTH(server_id)) FROM id_map), 0) AS id_map_bytes
    `) ?? {
    query_cache_bytes: 0,
    mutation_queue_bytes: 0,
    entity_rows_bytes: 0,
    id_map_bytes: 0,
  };
  return (
    (row.query_cache_bytes ?? 0) +
    (row.mutation_queue_bytes ?? 0) +
    (row.entity_rows_bytes ?? 0) +
    (row.id_map_bytes ?? 0)
  );
}

function pruneMutationQueueRows(db: SQLiteDatabase): void {
  const queueCountRow = db.getFirstSync<{ c: number }>("SELECT COUNT(*) AS c FROM mutation_queue");
  const queueCount = queueCountRow?.c ?? 0;
  const overflow = queueCount - OFFLINE_MUTATION_QUEUE_MAX_ROWS;
  if (overflow <= 0) return;

  // "Oldest non-user-visible first": non-pending statuses are removed before pending rows.
  db.execSync(`
    DELETE FROM mutation_queue
    WHERE id IN (
      SELECT id
      FROM mutation_queue
      ORDER BY CASE WHEN status = 'pending' THEN 1 ELSE 0 END, created_at ASC
      LIMIT ${overflow}
    )
  `);
}

function evictStorageUntilUnderCap(db: SQLiteDatabase): void {
  let totalBytes = estimateOfflineStorageBytes(db);
  if (totalBytes <= OFFLINE_STORAGE_CAP_BYTES) return;

  // 1) Evict oldest query cache rows first.
  while (totalBytes > OFFLINE_STORAGE_CAP_BYTES) {
    const removed = db.runSync(`
      DELETE FROM query_cache
      WHERE query_key IN (
        SELECT query_key FROM query_cache ORDER BY fetched_at ASC LIMIT 250
      )
    `);
    if ((removed.changes ?? 0) === 0) break;
    totalBytes = estimateOfflineStorageBytes(db);
  }

  if (totalBytes <= OFFLINE_STORAGE_CAP_BYTES) return;

  // 2) Evict oldest synced tombstones next (lower UX impact than active rows).
  while (totalBytes > OFFLINE_STORAGE_CAP_BYTES) {
    const removed = db.runSync(`
      DELETE FROM entity_rows
      WHERE (table_name, id) IN (
        SELECT table_name, id
        FROM entity_rows
        WHERE deleted = 1 AND synced_at IS NOT NULL
        ORDER BY synced_at ASC, updated_at ASC
        LIMIT 250
      )
    `);
    if ((removed.changes ?? 0) === 0) break;
    totalBytes = estimateOfflineStorageBytes(db);
  }

  if (totalBytes <= OFFLINE_STORAGE_CAP_BYTES) return;

  // 3) Last resort for cap safety: evict oldest id map rows.
  while (totalBytes > OFFLINE_STORAGE_CAP_BYTES) {
    const removed = db.runSync(`
      DELETE FROM id_map
      WHERE client_id IN (
        SELECT client_id FROM id_map ORDER BY synced_at ASC LIMIT 250
      )
    `);
    if ((removed.changes ?? 0) === 0) break;
    totalBytes = estimateOfflineStorageBytes(db);
  }
}

export function pruneOfflineTombstones(
  cutoffMs = Date.now() - OFFLINE_TOMBSTONE_RETENTION_MS
): void {
  try {
    const db = getOfflineDb();
    db.execSync(`
      DELETE FROM entity_rows
      WHERE deleted = 1
        AND synced_at IS NOT NULL
        AND synced_at <= ${Math.floor(cutoffMs)}
    `);
  } catch {
    // Best-effort maintenance; never throw (e.g. SQLite/RN-web failure).
  }
}

export function enforceOfflineStorageCaps(): void {
  try {
    const db = getOfflineDb();
    pruneMutationQueueRows(db);
    evictStorageUntilUnderCap(db);
  } catch {
    // Best-effort maintenance; never throw.
  }
}

async function wipeKnownImageCaches(): Promise<void> {
  const cacheRoot = FileSystem.cacheDirectory;
  if (!cacheRoot) return;
  const candidates = ["ImageCache", "expo-image", "expo-image-cache", "react-native-image-cache"];
  await Promise.all(
    candidates.map(async (name) => {
      try {
        await FileSystem.deleteAsync(`${cacheRoot}${name}`, { idempotent: true });
      } catch {
        // Ignore best-effort cache purge failures.
      }
    })
  );
}

/** Wipe local offline cache (sign-out / account switch — blueprint §3.13.8). */
export function resetOfflineDatabaseForAccountSwitch(): void {
  if (_db) {
    _db.closeSync();
    _db = null;
  }
  try {
    deleteDatabaseSync(DB_NAME);
  } catch {
    /* ignore */
  }
}

export async function resetOfflineStateForAccountSwitch(): Promise<void> {
  resetOfflineDatabaseForAccountSwitch();
  await wipeKnownImageCaches();
}
