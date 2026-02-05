/**
 * Local builds repository (SQLite). Offline-first; enqueue outbox for sync.
 */

import type {
  Build,
  CreateBuildInput,
  UpdateBuildInput,
} from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

export async function listBuilds(): Promise<Build[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    character: string | null;
    status: string;
    notes: string | null;
    image_url: string | null;
    budget_cents: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, character, status, notes, image_url, budget_cents, created_at, updated_at FROM builds ORDER BY updated_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    character: r.character ?? undefined,
    status: r.status as Build["status"],
    notes: r.notes ?? undefined,
    imageUrl: r.image_url ?? undefined,
    budgetCents: r.budget_cents ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const database = await initClosetDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = input.status ?? "idea";
  await database.runAsync(
    `INSERT INTO builds (id, name, character, status, notes, image_url, budget_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.character ?? null,
      status,
      input.notes ?? null,
      input.imageUrl ?? null,
      input.budgetCents ?? null,
      now,
      now,
    ],
  );
  const build: Build = {
    id,
    name: input.name,
    character: input.character,
    status,
    notes: input.notes,
    imageUrl: input.imageUrl,
    budgetCents: input.budgetCents ?? undefined,
    createdAt: now,
    updatedAt: now,
  };
  await enqueue("build.upsert", { build });
  return build;
}

export async function updateBuild(
  id: string,
  input: UpdateBuildInput,
): Promise<Build | null> {
  const database = await initClosetDb();
  const existing = await database.getFirstAsync<{
    name: string;
    character: string | null;
    status: string;
    notes: string | null;
    image_url: string | null;
    budget_cents: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT name, character, status, notes, image_url, budget_cents, created_at, updated_at FROM builds WHERE id = ?`,
    [id],
  );
  if (!existing) return null;
  const name = input.name ?? existing.name;
  const character =
    input.character !== undefined ? input.character : existing.character;
  const status = (input.status ?? existing.status) as string;
  const notes = input.notes !== undefined ? input.notes : existing.notes;
  const image_url =
    input.imageUrl !== undefined ? input.imageUrl : existing.image_url;
  const budget_cents =
    input.budgetCents !== undefined ? input.budgetCents : existing.budget_cents;
  const updated_at = new Date().toISOString();
  await database.runAsync(
    `UPDATE builds SET name = ?, character = ?, status = ?, notes = ?, image_url = ?, budget_cents = ?, updated_at = ? WHERE id = ?`,
    [
      name,
      character ?? null,
      status,
      notes ?? null,
      image_url ?? null,
      budget_cents ?? null,
      updated_at,
      id,
    ],
  );
  const build: Build = {
    id,
    name,
    character: character ?? undefined,
    status: status as Build["status"],
    notes: notes ?? undefined,
    imageUrl: image_url ?? undefined,
    budgetCents: budget_cents ?? undefined,
    createdAt: existing.created_at,
    updatedAt: updated_at,
  };
  await enqueue("build.upsert", { build });
  return build;
}

export async function getBuild(id: string): Promise<Build | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    character: string | null;
    status: string;
    notes: string | null;
    image_url: string | null;
    budget_cents: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, character, status, notes, image_url, budget_cents, created_at, updated_at FROM builds WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    character: row.character ?? undefined,
    status: row.status as Build["status"],
    notes: row.notes ?? undefined,
    imageUrl: row.image_url ?? undefined,
    budgetCents: row.budget_cents ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLinkedClosetItemIds(
  buildId: string,
): Promise<string[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{ closet_item_id: string }>(
    `SELECT closet_item_id FROM build_item_links WHERE build_id = ? ORDER BY closet_item_id`,
    [buildId],
  );
  return rows.map((r) => r.closet_item_id);
}

export async function linkBuildItems(
  buildId: string,
  closetItemIds: string[],
): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM build_item_links WHERE build_id = ?`, [
    buildId,
  ]);
  for (const cid of closetItemIds) {
    await database.runAsync(
      `INSERT INTO build_item_links (build_id, closet_item_id) VALUES (?, ?)`,
      [buildId, cid],
    );
  }
  await enqueue("build.linkItems", { buildId, closetItemIds });
}

export async function getById(id: string): Promise<Build | null> {
  return getBuild(id);
}

export async function upsertFromSync(
  build: Omit<Build, "budgetCents"> & { budgetCents?: number | null },
): Promise<void> {
  const database = await initClosetDb();
  const existing = await getBuild(build.id);
  if (existing) {
    await database.runAsync(
      `UPDATE builds SET name = ?, character = ?, status = ?, notes = ?, image_url = ?, budget_cents = ?, updated_at = ? WHERE id = ?`,
      [
        build.name,
        build.character ?? null,
        build.status,
        build.notes ?? null,
        build.imageUrl ?? null,
        build.budgetCents ?? null,
        build.updatedAt,
        build.id,
      ],
    );
  } else {
    await database.runAsync(
      `INSERT INTO builds (id, name, character, status, notes, image_url, budget_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        build.id,
        build.name,
        build.character ?? null,
        build.status,
        build.notes ?? null,
        build.imageUrl ?? null,
        build.budgetCents ?? null,
        build.createdAt,
        build.updatedAt,
      ],
    );
  }
}

export async function deleteBuild(id: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM builds WHERE id = ?`, [id]);
}
