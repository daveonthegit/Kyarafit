import type { VaultSql } from "@/vault/store";

/**
 * Schema for one account's vault database. Pure (no Expo imports) so tests can run it against
 * `node:sqlite`. Versioned: each step is idempotent and guarded so re-running on an up-to-date file is
 * a no-op.
 */
const CURRENT_VERSION = 5;

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

    -- client id -> published server copy (and legacy cloud ids). Never evicted.
    CREATE TABLE IF NOT EXISTS id_map (
      client_id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    );

    -- Legacy command replay queue: no longer written (see replica_outbox), kept so older files open.
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

    -- Managed sync (vault/replica): one op per changed row, written in the commit's transaction.
    CREATE TABLE IF NOT EXISTS replica_outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      op_id TEXT UNIQUE NOT NULL,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      fields_json TEXT,
      base_rev INTEGER NOT NULL,
      attempted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS replica_outbox_row ON replica_outbox (table_name, row_id);
    -- The server rev of each row this vault last pulled (an op's base revision).
    CREATE TABLE IF NOT EXISTS replica_state (
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      rev INTEGER NOT NULL,
      PRIMARY KEY (table_name, row_id)
    );
    -- "Changes that didn't apply", streamed from the server with the rows.
    CREATE TABLE IF NOT EXISTS replica_conflicts (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      lost_json TEXT NOT NULL,
      build_id TEXT,
      rev INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      dismiss_pending INTEGER NOT NULL DEFAULT 0
    );
    -- Rows seen during a forced resnapshot (devices behind the server's retention horizon).
    CREATE TABLE IF NOT EXISTS replica_seen (
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      PRIMARY KEY (table_name, row_id)
    );
    -- Photo keys whose bytes this device has uploaded to (or found on) Kyarafit Cloud.
    CREATE TABLE IF NOT EXISTS replica_assets (
      image_key TEXT PRIMARY KEY,
      uploaded_at INTEGER NOT NULL
    );
    -- Published server copies to remove once online (the vault row was deleted).
    CREATE TABLE IF NOT EXISTS publish_removals (
      client_id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      server_id TEXT NOT NULL
    );
  `);

  const row = db.getFirstSync<{ version: number }>(
    "SELECT version FROM schema_version WHERE id = 1"
  );
  const v = row?.version ?? 0;

  // v2: mutation_queue.client_id. v3: mutation_queue.touched_json (which vault rows a queued
  // replication op covers). Fresh DBs get both from CREATE TABLE; guard on PRAGMA so re-runs are safe.
  // v4: the replica_* tables above replace command replay; nothing to alter in place.
  if (v < 3) {
    const columns = db.getAllSync<{ name: string }>("PRAGMA table_info(mutation_queue)");
    if (!columns.some((column) => column.name === "client_id")) {
      db.execSync("ALTER TABLE mutation_queue ADD COLUMN client_id TEXT");
    }
    if (!columns.some((column) => column.name === "touched_json")) {
      db.execSync("ALTER TABLE mutation_queue ADD COLUMN touched_json TEXT");
    }
  }

  if (v < 5) {
    const columns = db.getAllSync<{ name: string }>("PRAGMA table_info(replica_outbox)");
    if (!columns.some(column => column.name === "attempted_at")) {
      db.execSync("ALTER TABLE replica_outbox ADD COLUMN attempted_at INTEGER");
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
