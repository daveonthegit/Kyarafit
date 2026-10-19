import type { VaultSql } from "@/vault/store";

/**
 * Schema for one account's vault database. Pure (no Expo imports) so tests can run it against
 * `node:sqlite`. Versioned: each step is idempotent and guarded so re-running on an up-to-date file is
 * a no-op.
 */
const CURRENT_VERSION = 3;

export function migrateVaultSchema(db: VaultSql, subject: string): void {
  db.execSync(`
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
      status TEXT NOT NULL DEFAULT 'pending',
      touched_json TEXT
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

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = db.getFirstSync<{ version: number }>(
    "SELECT version FROM schema_version WHERE id = 1"
  );
  const v = row?.version ?? 0;

  // v2: mutation_queue.client_id. v3: mutation_queue.touched_json (which vault rows a queued
  // replication op covers). Fresh DBs get both from CREATE TABLE; guard on PRAGMA so re-runs are safe.
  if (v < 3) {
    const columns = db.getAllSync<{ name: string }>("PRAGMA table_info(mutation_queue)");
    if (!columns.some((column) => column.name === "client_id")) {
      db.execSync("ALTER TABLE mutation_queue ADD COLUMN client_id TEXT");
    }
    if (!columns.some((column) => column.name === "touched_json")) {
      db.execSync("ALTER TABLE mutation_queue ADD COLUMN touched_json TEXT");
    }
  }

  if (v < CURRENT_VERSION) {
    db.execSync(`UPDATE schema_version SET version = ${CURRENT_VERSION} WHERE id = 1`);
  }

  // Bind the file to its owner so a mis-keyed open can never surface another account's rows.
  const owner = db.getFirstSync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'vault:subject'"
  );
  if (!owner) {
    db.runSync("INSERT INTO sync_meta (key, value) VALUES ('vault:subject', ?)", [subject]);
  } else if (owner.value !== subject) {
    throw new Error("Local vault belongs to a different account");
  }
}
