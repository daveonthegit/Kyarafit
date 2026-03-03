/**
 * Closet items local repository (SQLite).
 */

import type { ClosetItem } from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

export async function listItems(): Promise<ClosetItem[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    category: string;
    tags: string;
    notes: string | null;
    image_local_uri: string | null;
    image_url: string | null;
    cost_cents: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, category, tags, notes, image_local_uri, image_url, cost_cents, created_at, updated_at
     FROM closet_items ORDER BY updated_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as ClosetItem["category"],
    tags: parseTags(r.tags),
    notes: r.notes ?? undefined,
    imageLocalUri: r.image_local_uri ?? undefined,
    imageUrl: r.image_url ?? undefined,
    costCents: r.cost_cents ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function parseTags(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export async function upsertItem(item: ClosetItem): Promise<void> {
  const database = await initClosetDb();
  const tagsJson = JSON.stringify(item.tags ?? []);
  await database.runAsync(
    `INSERT INTO closet_items (id, name, category, tags, notes, image_local_uri, image_url, cost_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       tags = excluded.tags,
       notes = excluded.notes,
       image_local_uri = excluded.image_local_uri,
       image_url = excluded.image_url,
       cost_cents = excluded.cost_cents,
       updated_at = excluded.updated_at`,
    [
      item.id,
      item.name,
      item.category,
      tagsJson,
      item.notes ?? null,
      item.imageLocalUri ?? null,
      item.imageUrl ?? null,
      item.costCents ?? null,
      item.createdAt,
      item.updatedAt,
    ]
  );
  await enqueue("closetItem.upsert", {
    localId: item.id,
    name: item.name,
    category: item.category,
    tags: item.tags ?? [],
    notes: item.notes ?? undefined,
    imageUrl: item.imageUrl ?? undefined,
    costCents: item.costCents ?? undefined,
  });
}

export async function getConvexId(localId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM closet_items WHERE id = ?`,
    [localId]
  );
  return row?.convex_id ?? null;
}

export async function setConvexId(localId: string, convexId: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`UPDATE closet_items SET convex_id = ? WHERE id = ?`, [convexId, localId]);
}

export async function listUnsynced(): Promise<ClosetItem[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string; name: string; category: string; tags: string;
    notes: string | null; image_local_uri: string | null;
    image_url: string | null; cost_cents: number | null;
    created_at: string; updated_at: string;
  }>(`SELECT id, name, category, tags, notes, image_local_uri, image_url, cost_cents, created_at, updated_at FROM closet_items WHERE convex_id IS NULL`);
  return rows.map((r) => ({
    id: r.id, name: r.name,
    category: r.category as ClosetItem["category"],
    tags: parseTags(r.tags),
    notes: r.notes ?? undefined, imageLocalUri: r.image_local_uri ?? undefined,
    imageUrl: r.image_url ?? undefined, costCents: r.cost_cents ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

/** Called during Convex pull — sets convex_id without enqueuing a new outbox entry. */
export async function upsertFromConvex(item: ClosetItem & { convexId: string }): Promise<void> {
  const database = await initClosetDb();
  const tagsJson = JSON.stringify(item.tags ?? []);
  await database.runAsync(
    `INSERT INTO closet_items (id, name, category, tags, notes, image_local_uri, image_url, cost_cents, created_at, updated_at, convex_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, category = excluded.category, tags = excluded.tags,
       notes = excluded.notes, image_url = excluded.image_url,
       cost_cents = excluded.cost_cents, updated_at = excluded.updated_at,
       convex_id = excluded.convex_id`,
    [
      item.id, item.name, item.category, tagsJson,
      item.notes ?? null, item.imageLocalUri ?? null, item.imageUrl ?? null,
      item.costCents ?? null, item.createdAt, item.updatedAt, item.convexId,
    ]
  );
}

export async function deleteItem(id: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync("DELETE FROM closet_items WHERE id = ?", [id]);
  await enqueue("closetItem.delete", { localId: id });
}

export async function getById(id: string): Promise<ClosetItem | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    category: string;
    tags: string;
    notes: string | null;
    image_local_uri: string | null;
    image_url: string | null;
    cost_cents: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, category, tags, notes, image_local_uri, image_url, cost_cents, created_at, updated_at
     FROM closet_items WHERE id = ?`,
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category as ClosetItem["category"],
    tags: parseTags(row.tags),
    notes: row.notes ?? undefined,
    imageLocalUri: row.image_local_uri ?? undefined,
    imageUrl: row.image_url ?? undefined,
    costCents: row.cost_cents ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertFromSync(item: ClosetItem): Promise<void> {
  await upsertItem(item);
}
