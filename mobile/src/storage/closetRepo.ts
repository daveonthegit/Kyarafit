/**
 * Closet items local repository (SQLite).
 */

import type { ClosetItem } from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";

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
}

export async function deleteItem(id: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync("DELETE FROM closet_items WHERE id = ?", [id]);
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
