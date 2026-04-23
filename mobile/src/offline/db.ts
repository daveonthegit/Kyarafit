import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

const DB_NAME = "kyarafit.db";
const CURRENT_VERSION = 1;

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
