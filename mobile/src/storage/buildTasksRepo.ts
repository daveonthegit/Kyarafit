/**
 * Local workflow-item repository used by legacy task-oriented mobile surfaces.
 * The public function names stay task-shaped so existing screens keep working,
 * but storage now uses workflow_items + workflow_attachments underneath.
 */

import type {
  BuildTask,
  CreateBuildTaskInput,
  UpdateBuildTaskInput,
} from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

type WorkflowItemRow = {
  id: string;
  title: string;
  status: string;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowAttachmentRow = {
  id: string;
  workflow_item_id: string;
  entity_type: string;
  entity_id: string;
  role: string;
  build_context_id: string | null;
  created_at: string;
};

export type StoredBuildTask = BuildTask & { dueDate?: string };

async function getAttachmentsForWorkflowItem(
  workflowItemId: string
): Promise<WorkflowAttachmentRow[]> {
  const database = await initClosetDb();
  return database.getAllAsync<WorkflowAttachmentRow>(
    `SELECT id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at
     FROM workflow_attachments WHERE workflow_item_id = ? ORDER BY created_at ASC`,
    [workflowItemId]
  );
}

async function getWorkflowItemById(workflowItemId: string): Promise<WorkflowItemRow | null> {
  const database = await initClosetDb();
  return database.getFirstAsync<WorkflowItemRow>(
    `SELECT id, title, status, sort_order, due_date, created_at, updated_at
     FROM workflow_items WHERE id = ?`,
    [workflowItemId]
  );
}

async function mapBuildTask(
  row: WorkflowItemRow,
  attachments?: WorkflowAttachmentRow[]
): Promise<StoredBuildTask | null> {
  const itemAttachments = attachments ?? (await getAttachmentsForWorkflowItem(row.id));
  const buildAttachment = itemAttachments.find((attachment) => attachment.entity_type === "build");
  if (!buildAttachment) return null;
  const closetAttachment = itemAttachments.find(
    (attachment) => attachment.entity_type === "closetItem"
  );
  return {
    id: row.id,
    buildId: buildAttachment.entity_id,
    label: row.title,
    closetItemId: closetAttachment?.entity_id ?? undefined,
    cosplayNodeId: closetAttachment?.entity_id ?? undefined,
    sortOrder: row.sort_order,
    checked: row.status === "done",
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertClosetAttachment(
  workflowItemId: string,
  closetItemId: string | null | undefined,
  updatedAt: string,
  buildId?: string
) {
  const database = await initClosetDb();
  const attachments = await getAttachmentsForWorkflowItem(workflowItemId);
  const existing = attachments.find((attachment) => attachment.entity_type === "closetItem");
  if (!closetItemId) {
    if (existing) {
      await database.runAsync(`DELETE FROM workflow_attachments WHERE id = ?`, [existing.id]);
    }
    return;
  }
  if (existing) {
    await database.runAsync(
      `UPDATE workflow_attachments SET entity_id = ?, build_context_id = ?, created_at = ? WHERE id = ?`,
      [closetItemId, buildId ?? null, updatedAt, existing.id]
    );
    return;
  }
  await database.runAsync(
    `INSERT INTO workflow_attachments (id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      workflowItemId,
      "closetItem",
      closetItemId,
      "progress_source",
      buildId ?? null,
      updatedAt,
    ]
  );
}

export async function listTasks(buildId: string): Promise<StoredBuildTask[]> {
  const database = await initClosetDb();
  const buildAttachments = await database.getAllAsync<WorkflowAttachmentRow>(
    `SELECT id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at
     FROM workflow_attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC`,
    ["build", buildId]
  );
  const rows = await Promise.all(
    buildAttachments.map(async (attachment) => {
      const workflowItem = await getWorkflowItemById(attachment.workflow_item_id);
      if (!workflowItem) return null;
      const attachments = await getAttachmentsForWorkflowItem(attachment.workflow_item_id);
      return mapBuildTask(workflowItem, attachments);
    })
  );
  return rows
    .filter((row): row is StoredBuildTask => Boolean(row))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export async function listPlannerTasks(): Promise<StoredBuildTask[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<WorkflowItemRow>(
    `SELECT id, title, status, sort_order, due_date, created_at, updated_at
     FROM workflow_items ORDER BY due_date ASC, sort_order ASC, created_at ASC`
  );
  const mapped = await Promise.all(rows.map((row) => mapBuildTask(row)));
  return mapped.filter((row): row is StoredBuildTask => Boolean(row));
}

export async function createTask(
  buildId: string,
  input: CreateBuildTaskInput
): Promise<StoredBuildTask> {
  const database = await initClosetDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO workflow_items (id, title, kind, category, status, sort_order, scope_kind, source_kind, due_date, created_at, updated_at)
     VALUES (?, ?, 'task', 'craft', ?, ?, 'build_specific', 'manual', ?, ?, ?)`,
    [id, input.label, "not_started", input.sortOrder ?? 0, null, now, now]
  );
  await database.runAsync(
    `INSERT INTO workflow_attachments (id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), id, "build", buildId, "primary", buildId, now]
  );
  if (input.closetItemId) {
    await database.runAsync(
      `INSERT INTO workflow_attachments (id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, "closetItem", input.closetItemId, "progress_source", buildId, now]
    );
  }
  const task: StoredBuildTask = {
    id,
    buildId,
    label: input.label,
    closetItemId: input.closetItemId ?? undefined,
    cosplayNodeId: input.closetItemId ?? undefined,
    sortOrder: input.sortOrder ?? 0,
    checked: false,
    dueDate: undefined,
    createdAt: now,
    updatedAt: now,
  };
  await enqueue("workflowItem.upsert", {
    localId: id,
    buildLocalId: buildId,
    title: task.label,
    sortOrder: task.sortOrder,
    status: "not_started",
    closetItemLocalId: task.closetItemId ?? undefined,
  });
  return task;
}

export async function updateTask(
  taskId: string,
  buildId: string,
  input: UpdateBuildTaskInput
): Promise<StoredBuildTask | null> {
  const database = await initClosetDb();
  const existing = await getWorkflowItemById(taskId);
  if (!existing) return null;
  const nextTitle = input.label ?? existing.title;
  const nextSortOrder = input.sortOrder ?? existing.sort_order;
  const nextStatus =
    input.checked !== undefined ? (input.checked ? "done" : "not_started") : existing.status;
  const nextDueDate = existing.due_date ?? null;
  const updatedAt = new Date().toISOString();
  await database.runAsync(
    `UPDATE workflow_items SET title = ?, sort_order = ?, status = ?, due_date = ?, updated_at = ? WHERE id = ?`,
    [nextTitle, nextSortOrder, nextStatus, nextDueDate, updatedAt, taskId]
  );
  if (input.closetItemId !== undefined) {
    await upsertClosetAttachment(taskId, input.closetItemId ?? null, updatedAt, buildId);
  }

  const attachments = await getAttachmentsForWorkflowItem(taskId);
  const mapped = await mapBuildTask(
    {
      id: taskId,
      title: nextTitle,
      status: nextStatus,
      sort_order: nextSortOrder,
      due_date: nextDueDate,
      created_at: existing.created_at,
      updated_at: updatedAt,
    },
    attachments
  );
  if (!mapped) return null;

  await enqueue("workflowItem.upsert", {
    localId: taskId,
    buildLocalId: buildId,
    title: mapped.label,
    sortOrder: mapped.sortOrder,
    status: nextStatus,
    closetItemLocalId: mapped.closetItemId ?? undefined,
    dueDate: mapped.dueDate,
  });
  return mapped;
}

export async function deleteTask(taskId: string, buildId?: string): Promise<boolean> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM workflow_attachments WHERE workflow_item_id = ?`, [taskId]);
  await database.runAsync(`DELETE FROM workflow_items WHERE id = ?`, [taskId]);
  if (buildId) {
    await enqueue("workflowItem.delete", { localId: taskId, buildLocalId: buildId });
  }
  return true;
}

export async function toggleTaskChecked(
  taskId: string,
  buildId: string
): Promise<StoredBuildTask | null> {
  const existing = await getWorkflowItemById(taskId);
  if (!existing) return null;
  return updateTask(taskId, buildId, { checked: existing.status !== "done" });
}

export async function getConvexId(localId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM workflow_items WHERE id = ?`,
    [localId]
  );
  return row?.convex_id ?? null;
}

export async function setConvexId(localId: string, convexId: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`UPDATE workflow_items SET convex_id = ? WHERE id = ?`, [
    convexId,
    localId,
  ]);
}

export async function getById(id: string): Promise<StoredBuildTask | null> {
  const row = await getWorkflowItemById(id);
  if (!row) return null;
  return mapBuildTask(row);
}

export async function upsertFromSync(task: StoredBuildTask): Promise<void> {
  const database = await initClosetDb();
  const existing = await getWorkflowItemById(task.id);
  const status = task.checked ? "done" : "not_started";
  if (existing) {
    await database.runAsync(
      `UPDATE workflow_items SET title = ?, sort_order = ?, status = ?, due_date = ?, updated_at = ? WHERE id = ?`,
      [task.label, task.sortOrder, status, task.dueDate ?? null, task.updatedAt, task.id]
    );
  } else {
    await database.runAsync(
      `INSERT INTO workflow_items (id, title, kind, category, status, sort_order, scope_kind, source_kind, due_date, created_at, updated_at)
       VALUES (?, ?, 'task', 'craft', ?, ?, 'build_specific', 'manual', ?, ?, ?)`,
      [
        task.id,
        task.label,
        status,
        task.sortOrder,
        task.dueDate ?? null,
        task.createdAt,
        task.updatedAt,
      ]
    );
  }

  const attachments = await getAttachmentsForWorkflowItem(task.id);
  const buildAttachment = attachments.find((attachment) => attachment.entity_type === "build");
  if (!buildAttachment) {
    await database.runAsync(
      `INSERT INTO workflow_attachments (id, workflow_item_id, entity_type, entity_id, role, build_context_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), task.id, "build", task.buildId, "primary", task.buildId, task.updatedAt]
    );
  }
  await upsertClosetAttachment(task.id, task.closetItemId ?? null, task.updatedAt, task.buildId);
}
