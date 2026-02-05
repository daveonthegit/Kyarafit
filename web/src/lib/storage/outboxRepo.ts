/**
 * Outbox repository for web sync queue
 */

import { getDB, type OutboxEntry, now } from './db';

export async function enqueueOutbox(type: string, payload: any): Promise<void> {
  const db = await getDB();
  await db.add('outbox', {
    id: undefined as any, // Auto-increment
    type,
    payload,
    createdAt: now(),
  });
}

export async function listPending(): Promise<OutboxEntry[]> {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function remove(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('outbox', id);
}

export async function clear(): Promise<void> {
  const db = await getDB();
  await db.clear('outbox');
}
