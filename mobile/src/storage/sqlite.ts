/**
 * SQLite-backed storage (placeholder init).
 * No sync yet; init when app is ready.
 */

import * as SQLite from 'expo-sqlite';
import type { StorageAdapter, StorageItem } from './types';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('kyarafit.db');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );
  `);
  return db;
}

export const sqliteStorage: StorageAdapter = {
  async get(key: string): Promise<string | null> {
    const database = await getDb();
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      'INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())',
      [key, value]
    );
  },

  async remove(key: string): Promise<void> {
    const database = await getDb();
    await database.runAsync('DELETE FROM kv WHERE key = ?', [key]);
  },

  async list(prefix: string = ''): Promise<StorageItem[]> {
    const database = await getDb();
    const rows = await database.getAllAsync<{ key: string; value: string; updated_at: number }>(
      prefix ? 'SELECT key, value, updated_at FROM kv WHERE key LIKE ? ORDER BY updated_at DESC' : 'SELECT key, value, updated_at FROM kv ORDER BY updated_at DESC',
      prefix ? [`${prefix}%`] : []
    );
    return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updated_at }));
  },
};
