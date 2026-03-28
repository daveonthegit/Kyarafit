/**
 * Outbox for offline-first Convex sync.
 * Every mutation that writes to SQLite also enqueues an entry here.
 * The convexSync service drains the queue when the user is signed in and online.
 *
 * All IDs in payloads are local SQLite UUIDs; convexSync.ts translates them
 * to Convex IDs via the convex_id columns before calling Convex mutations.
 */

import { initClosetDb } from "./db";

// ─── Payload types ────────────────────────────────────────────────────────────

export type OutboxEventType =
  | "closetItem.upsert"
  | "closetItem.delete"
  | "build.upsert"
  | "build.delete"
  | "build.linkItems"
  | "workflowItem.upsert"
  | "workflowItem.delete"
  | "convention.upsert"
  | "convention.delete"
  | "convention.plan.replace"
  | "packing.toggle"
  | "packing.addManual"
  | "packing.regenerate";

export type OutboxPayloadMap = {
  "closetItem.upsert": {
    localId: string;
    name: string;
    category: string;
    tags: string[];
    notes?: string;
    imageUrl?: string;
    costCents?: number;
  };
  "closetItem.delete": { localId: string };
  "build.upsert": {
    localId: string;
    name: string;
    character?: string;
    status: string;
    notes?: string;
    imageUrl?: string;
    budgetCents?: number;
    targetDate?: string;
  };
  "build.delete": { localId: string };
  "build.linkItems": { buildLocalId: string; closetItemLocalIds: string[] };
  "workflowItem.upsert": {
    localId: string;
    buildLocalId?: string;
    title: string;
    sortOrder: number;
    status: string;
    closetItemLocalId?: string;
    dueDate?: string;
  };
  "workflowItem.delete": { localId: string; buildLocalId?: string };
  "convention.upsert": {
    localId: string;
    name: string;
    location?: string;
    startDate: string;
    endDate: string;
  };
  "convention.delete": { localId: string };
  "convention.plan.replace": {
    conventionLocalId: string;
    plan: Array<{ date: string; buildLocalId?: string | null; notes?: string }>;
  };
  "packing.toggle": { localId: string; checked: boolean };
  "packing.addManual": {
    conventionLocalId: string;
    label: string;
    date?: string;
    buildLocalId?: string;
  };
  "packing.regenerate": { conventionLocalId: string };
};

export interface OutboxEntry {
  id: number;
  type: OutboxEventType;
  payload_json: string;
  created_at: string;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export async function enqueue<T extends OutboxEventType>(
  type: T,
  payload: OutboxPayloadMap[T]
): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`INSERT INTO outbox (type, payload_json, created_at) VALUES (?, ?, ?)`, [
    type,
    JSON.stringify(payload),
    new Date().toISOString(),
  ]);
}

export async function listPending(): Promise<OutboxEntry[]> {
  const database = await initClosetDb();
  return database.getAllAsync<OutboxEntry>(
    `SELECT id, type, payload_json, created_at FROM outbox ORDER BY id ASC`
  );
}

export async function remove(id: number): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM outbox WHERE id = ?`, [id]);
}

export async function getPendingCount(): Promise<number> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ c: number }>(`SELECT COUNT(*) as c FROM outbox`);
  return row?.c ?? 0;
}
