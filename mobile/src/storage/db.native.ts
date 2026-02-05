/**
 * SQLite DB init for closet_items and outbox (native only).
 * Web uses db.web.ts to avoid expo-sqlite WASM dependency.
 */

import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

const DB_NAME = "kyarafit.db";

export async function initClosetDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS closet_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      image_local_uri TEXT,
      image_url TEXT,
      cost_cents INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS builds (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      character TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      notes TEXT,
      image_url TEXT,
      budget_cents INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS build_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      build_id TEXT NOT NULL,
      label TEXT NOT NULL,
      closet_item_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
      FOREIGN KEY (closet_item_id) REFERENCES closet_items(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS build_item_links (
      build_id TEXT NOT NULL,
      closet_item_id TEXT NOT NULL,
      PRIMARY KEY (build_id, closet_item_id),
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE CASCADE,
      FOREIGN KEY (closet_item_id) REFERENCES closet_items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS conventions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS convention_day_plans (
      id TEXT PRIMARY KEY NOT NULL,
      convention_id TEXT NOT NULL,
      date TEXT NOT NULL,
      build_id TEXT,
      notes TEXT,
      UNIQUE (convention_id, date),
      FOREIGN KEY (convention_id) REFERENCES conventions(id) ON DELETE CASCADE,
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS packing_list_items (
      id TEXT PRIMARY KEY NOT NULL,
      convention_id TEXT NOT NULL,
      date TEXT,
      build_id TEXT,
      closet_item_id TEXT,
      label TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (convention_id) REFERENCES conventions(id) ON DELETE CASCADE,
      FOREIGN KEY (build_id) REFERENCES builds(id) ON DELETE SET NULL,
      FOREIGN KEY (closet_item_id) REFERENCES closet_items(id) ON DELETE SET NULL
    );
  `);

  // Add new columns if they don't exist (existing installs)
  try {
    await db.execAsync(
      "ALTER TABLE closet_items ADD COLUMN cost_cents INTEGER",
    );
  } catch {
    /* column may already exist */
  }
  try {
    await db.execAsync("ALTER TABLE builds ADD COLUMN image_url TEXT");
  } catch {
    /* column may already exist */
  }
  try {
    await db.execAsync("ALTER TABLE builds ADD COLUMN budget_cents INTEGER");
  } catch {
    /* column may already exist */
  }

  return db;
}

export function getDb(): SQLite.SQLiteDatabase | null {
  return db;
}

export async function getValue(key: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(
    "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
    [key, value],
  );
}
