/**
 * Build tasks (checklist items) local repository. Offline-first; anonymous users only.
 */

import type {
  BuildTask,
  CreateBuildTaskInput,
  UpdateBuildTaskInput,
} from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

export async function listTasks(buildId: string): Promise<BuildTask[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    build_id: string;
    label: string;
    closet_item_id: string | null;
    sort_order: number;
    checked: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at
     FROM build_tasks WHERE build_id = ? ORDER BY sort_order ASC, created_at ASC`,
    [buildId]
  );
  return rows.map((r) => ({
    id: r.id,
    buildId: r.build_id,
    label: r.label,
    closetItemId: r.closet_item_id ?? undefined,
    sortOrder: r.sort_order,
    checked: r.checked !== 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createTask(buildId: string, input: CreateBuildTaskInput): Promise<BuildTask> {
  const database = await initClosetDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO build_tasks (id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, buildId, input.label, input.closetItemId ?? null, input.sortOrder ?? 0, now, now]
  );
  const task: BuildTask = {
    id,
    buildId,
    label: input.label,
    closetItemId: input.closetItemId ?? undefined,
    sortOrder: input.sortOrder ?? 0,
    checked: false,
    createdAt: now,
    updatedAt: now,
  };
  await enqueue("buildTask.upsert", {
    localId: id, buildLocalId: buildId, label: task.label,
    sortOrder: task.sortOrder, checked: false,
    closetItemLocalId: task.closetItemId ?? undefined,
  });
  return task;
}

export async function updateTask(
  taskId: string,
  buildId: string,
  input: UpdateBuildTaskInput
): Promise<BuildTask | null> {
  const database = await initClosetDb();
  const existing = await database.getFirstAsync<{
    label: string;
    closet_item_id: string | null;
    sort_order: number;
    checked: number;
    created_at: string;
  }>(
    `SELECT label, closet_item_id, sort_order, checked, created_at FROM build_tasks WHERE id = ? AND build_id = ?`,
    [taskId, buildId]
  );
  if (!existing) return null;
  const label = input.label ?? existing.label;
  const closet_item_id =
    input.closetItemId !== undefined ? input.closetItemId : existing.closet_item_id;
  const sort_order = input.sortOrder ?? existing.sort_order;
  const checked = input.checked !== undefined ? (input.checked ? 1 : 0) : existing.checked;
  const updated_at = new Date().toISOString();
  await database.runAsync(
    `UPDATE build_tasks SET label = ?, closet_item_id = ?, sort_order = ?, checked = ?, updated_at = ? WHERE id = ? AND build_id = ?`,
    [label, closet_item_id ?? null, sort_order, checked, updated_at, taskId, buildId]
  );
  const task: BuildTask = {
    id: taskId,
    buildId,
    label,
    closetItemId: closet_item_id ?? undefined,
    sortOrder: sort_order,
    checked: checked !== 0,
    createdAt: existing.created_at,
    updatedAt: updated_at,
  };
  await enqueue("buildTask.upsert", {
    localId: taskId, buildLocalId: buildId, label,
    sortOrder: sort_order, checked: checked !== 0,
    closetItemLocalId: closet_item_id ?? undefined,
  });
  return task;
}

export async function deleteTask(taskId: string, buildId?: string): Promise<boolean> {
  const database = await initClosetDb();
  if (buildId) {
    await database.runAsync(`DELETE FROM build_tasks WHERE id = ? AND build_id = ?`, [
      taskId,
      buildId,
    ]);
    await enqueue("buildTask.delete", { localId: taskId, buildLocalId: buildId });
  } else {
    // For sync: delete by taskId only
    await database.runAsync(`DELETE FROM build_tasks WHERE id = ?`, [taskId]);
  }
  return true;
}

export async function toggleTaskChecked(
  taskId: string,
  buildId: string
): Promise<BuildTask | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{
    checked: number;
    created_at: string;
  }>(`SELECT checked, created_at FROM build_tasks WHERE id = ? AND build_id = ?`, [
    taskId,
    buildId,
  ]);
  if (!row) return null;
  const checked = row.checked === 0 ? 1 : 0;
  const updated_at = new Date().toISOString();
  await database.runAsync(
    `UPDATE build_tasks SET checked = ?, updated_at = ? WHERE id = ? AND build_id = ?`,
    [checked, updated_at, taskId, buildId]
  );
  const task: BuildTask = {
    id: taskId,
    buildId,
    label: "", // will be filled below
    sortOrder: 0,
    checked: checked !== 0,
    createdAt: row.created_at,
    updatedAt: updated_at,
  };
  const full = await database.getFirstAsync<{
    label: string;
    closet_item_id: string | null;
    sort_order: number;
  }>(`SELECT label, closet_item_id, sort_order FROM build_tasks WHERE id = ?`, [taskId]);
  if (full) {
    task.label = full.label;
    task.closetItemId = full.closet_item_id ?? undefined;
    task.sortOrder = full.sort_order;
  }
  await enqueue("buildTask.upsert", {
    localId: taskId, buildLocalId: buildId, label: task.label,
    sortOrder: task.sortOrder, checked: task.checked,
    closetItemLocalId: task.closetItemId ?? undefined,
  });
  return task;
}

export async function getConvexId(localId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM build_tasks WHERE id = ?`, [localId]
  );
  return row?.convex_id ?? null;
}

export async function setConvexId(localId: string, convexId: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`UPDATE build_tasks SET convex_id = ? WHERE id = ?`, [convexId, localId]);
}

export async function getById(id: string): Promise<BuildTask | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{
    id: string;
    build_id: string;
    label: string;
    closet_item_id: string | null;
    sort_order: number;
    checked: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at FROM build_tasks WHERE id = ?`,
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    buildId: row.build_id,
    label: row.label,
    closetItemId: row.closet_item_id ?? undefined,
    sortOrder: row.sort_order,
    checked: row.checked !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertFromSync(task: BuildTask): Promise<void> {
  const database = await initClosetDb();
  const existing = await getById(task.id);
  if (existing) {
    await database.runAsync(
      `UPDATE build_tasks SET label = ?, closet_item_id = ?, sort_order = ?, checked = ?, updated_at = ? WHERE id = ? AND build_id = ?`,
      [
        task.label,
        task.closetItemId ?? null,
        task.sortOrder,
        task.checked ? 1 : 0,
        task.updatedAt,
        task.id,
        task.buildId,
      ]
    );
  } else {
    await database.runAsync(
      `INSERT INTO build_tasks (id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.buildId,
        task.label,
        task.closetItemId ?? null,
        task.sortOrder,
        task.checked ? 1 : 0,
        task.createdAt,
        task.updatedAt,
      ]
    );
  }
}
