/**
 * Sync outbox: queue events for when back online.
 */

import { initClosetDb } from './db';

export type OutboxType =
  | 'upsert'
  | 'delete'
  | 'build.upsert'
  | 'build.linkItems'
  | 'build.task.upsert'
  | 'build.task.delete'
  | 'convention.upsert'
  | 'convention.plan.replace'
  | 'packing.toggle'
  | 'packing.addManual'
  | 'packing.regenerate';

export interface OutboxEntry {
  id: number;
  type: OutboxType;
  payload: unknown;
  createdAt: string;
}

export async function enqueue(type: OutboxType, payload: unknown): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(
    'INSERT INTO outbox (type, payload_json) VALUES (?, ?)',
    [type, JSON.stringify(payload)]
  );
}

export async function listPending(): Promise<OutboxEntry[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{ id: number; type: string; payload_json: string; created_at: string }>(
    'SELECT id, type, payload_json, created_at FROM outbox ORDER BY id ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as OutboxType,
    payload: JSON.parse(r.payload_json) as unknown,
    createdAt: r.created_at,
  }));
}

export async function remove(id: number): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}
