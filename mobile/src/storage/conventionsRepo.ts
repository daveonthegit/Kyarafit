/**
 * Local conventions repository (SQLite). Offline-first; anonymous users only.
 */

import type {
  Convention,
  CreateConventionInput,
  UpdateConventionInput,
} from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

export async function listConventions(): Promise<Convention[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    location: string | null;
    start_date: string;
    end_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, location, start_date, end_date, created_at, updated_at FROM conventions ORDER BY start_date DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location ?? undefined,
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createConvention(input: CreateConventionInput): Promise<Convention> {
  const database = await initClosetDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO conventions (id, name, location, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.location ?? null, input.startDate, input.endDate, now, now]
  );
  const convention: Convention = {
    id,
    name: input.name,
    location: input.location,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: now,
    updatedAt: now,
  };
  await enqueue("convention.upsert", {
    localId: id, name: convention.name, location: convention.location,
    startDate: convention.startDate, endDate: convention.endDate,
  });
  return convention;
}

export async function getConvention(id: string): Promise<Convention | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{
    id: string;
    name: string;
    location: string | null;
    start_date: string;
    end_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, name, location, start_date, end_date, created_at, updated_at FROM conventions WHERE id = ?`,
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    location: row.location ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateConvention(
  id: string,
  input: UpdateConventionInput
): Promise<Convention | null> {
  const database = await initClosetDb();
  const existing = await database.getFirstAsync<{
    name: string;
    location: string | null;
    start_date: string;
    end_date: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT name, location, start_date, end_date, created_at, updated_at FROM conventions WHERE id = ?`,
    [id]
  );
  if (!existing) return null;
  const name = input.name ?? existing.name;
  const location = input.location !== undefined ? input.location : existing.location;
  const start_date = input.startDate ?? existing.start_date;
  const end_date = input.endDate ?? existing.end_date;
  const updated_at = new Date().toISOString();
  await database.runAsync(
    `UPDATE conventions SET name = ?, location = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`,
    [name, location ?? null, start_date, end_date, updated_at, id]
  );
  const convention: Convention = {
    id,
    name,
    location: location ?? undefined,
    startDate: start_date,
    endDate: end_date,
    createdAt: existing.created_at,
    updatedAt: updated_at,
  };
  await enqueue("convention.upsert", {
    localId: id, name, location: location ?? undefined,
    startDate: start_date, endDate: end_date,
  });
  return convention;
}

export async function getById(id: string): Promise<Convention | null> {
  return getConvention(id);
}

export async function upsertFromSync(
  convention: Convention & { imageUrl?: string }
): Promise<void> {
  const database = await initClosetDb();
  const existing = await getConvention(convention.id);
  if (existing) {
    await database.runAsync(
      `UPDATE conventions SET name = ?, location = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`,
      [
        convention.name,
        convention.location ?? null,
        convention.startDate,
        convention.endDate,
        convention.updatedAt,
        convention.id,
      ]
    );
  } else {
    await database.runAsync(
      `INSERT INTO conventions (id, name, location, start_date, end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        convention.id,
        convention.name,
        convention.location ?? null,
        convention.startDate,
        convention.endDate,
        convention.createdAt,
        convention.updatedAt,
      ]
    );
  }
}

export async function deleteConvention(id: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM conventions WHERE id = ?`, [id]);
  await enqueue("convention.delete", { localId: id });
}

export async function getConvexId(localId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM conventions WHERE id = ?`, [localId]
  );
  return row?.convex_id ?? null;
}

export async function setConvexId(localId: string, convexId: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`UPDATE conventions SET convex_id = ? WHERE id = ?`, [convexId, localId]);
}

export async function getLocalIdByConvexId(convexId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM conventions WHERE convex_id = ?`, [convexId]
  );
  return row?.id ?? null;
}

/** Called during Convex pull — upserts without enqueuing. */
export async function upsertFromConvex(
  convention: Convention & { convexId: string }
): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(
    `INSERT INTO conventions (id, name, location, start_date, end_date, created_at, updated_at, convex_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, location=excluded.location,
       start_date=excluded.start_date, end_date=excluded.end_date,
       updated_at=excluded.updated_at, convex_id=excluded.convex_id`,
    [
      convention.id, convention.name, convention.location ?? null,
      convention.startDate, convention.endDate,
      convention.createdAt, convention.updatedAt, convention.convexId,
    ]
  );
}
