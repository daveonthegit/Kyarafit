/**
 * In-memory DB for web (no expo-sqlite WASM).
 * Same API as db.native.ts so closetRepo/outboxRepo/sqlite work unchanged.
 */

export interface DbLike {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<void>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

const kv = new Map<string, { value: string; updated_at: number }>();
const closetItems: Array<{
  id: string;
  name: string;
  category: string;
  tags: string;
  notes: string | null;
  image_local_uri: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}> = [];
const outbox: Array<{ id: number; type: string; payload_json: string; created_at: string }> = [];
let outboxId = 0;

let db: DbLike | null = null;

function getWebDb(): DbLike {
  if (db) return db;
  db = {
    async execAsync() {
      // Tables already exist in memory
    },

    async runAsync(sql: string, params: unknown[] = []) {
      // KV
      if (sql.includes('INSERT OR REPLACE INTO kv')) {
        const [key, value] = params as [string, string];
        kv.set(key, { value, updated_at: Math.floor(Date.now() / 1000) });
        return;
      }
      if (sql.includes('DELETE FROM kv WHERE key')) {
        kv.delete(params[0] as string);
        return;
      }
      // closet_items
      if (sql.includes('INSERT INTO closet_items') || sql.includes('ON CONFLICT(id) DO UPDATE')) {
        const [id, name, category, tags, notes, image_local_uri, image_url, created_at, updated_at] =
          params as [string, string, string, string, string | null, string | null, string | null, string, string];
        const idx = closetItems.findIndex((r) => r.id === id);
        const row = {
          id,
          name,
          category,
          tags,
          notes,
          image_local_uri,
          image_url,
          created_at,
          updated_at,
        };
        if (idx >= 0) closetItems[idx] = row;
        else closetItems.push(row);
        return;
      }
      if (sql.includes('DELETE FROM closet_items WHERE id')) {
        const idx = closetItems.findIndex((r) => r.id === params[0]);
        if (idx >= 0) closetItems.splice(idx, 1);
        return;
      }
      // outbox
      if (sql.includes('INSERT INTO outbox')) {
        outboxId += 1;
        outbox.push({
          id: outboxId,
          type: params[0] as string,
          payload_json: params[1] as string,
          created_at: new Date().toISOString(),
        });
        return;
      }
      if (sql.includes('DELETE FROM outbox WHERE id')) {
        const idx = outbox.findIndex((r) => r.id === params[0]);
        if (idx >= 0) outbox.splice(idx, 1);
        return;
      }
    },

    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      const rows = await this.getAllAsync<T>(sql, params);
      return rows[0] ?? null;
    },

    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes('FROM kv') && sql.includes('WHERE key')) {
        const key = params[0] as string;
        const row = kv.get(key);
        return (row ? [{ value: row.value }] : []) as T[];
      }
      if (sql.includes('FROM kv ORDER BY')) {
        return Array.from(kv.entries()).map(([key, row]) => ({
          key,
          value: row.value,
          updated_at: row.updated_at,
        })) as T[];
      }
      if (sql.includes('FROM kv WHERE key LIKE')) {
        const prefix = (params[0] as string).replace(/%/g, '') || '';
        return Array.from(kv.entries())
          .filter(([k]) => !prefix || k.startsWith(prefix))
          .map(([key, row]) => ({ key, value: row.value, updated_at: row.updated_at })) as T[];
      }
      if (sql.includes('FROM closet_items ORDER BY')) {
        return [...closetItems].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ) as T[];
      }
      if (sql.includes('FROM outbox ORDER BY')) {
        return outbox.map((r) => ({ ...r })) as T[];
      }
      return [];
    },
  };
  return db;
}

export async function initClosetDb(): Promise<DbLike> {
  return getWebDb();
}

export function getDb(): DbLike | null {
  return db;
}
