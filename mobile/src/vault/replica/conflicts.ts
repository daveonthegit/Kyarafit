import {
  REPLICA_META_FIELDS,
  REPLICA_SYSTEM_FIELDS,
  replicaLinksFor,
  replicaBuildIdsFor,
  type ReplicaConflictKind,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { withCreateMeta, withUpdateMeta } from "../handlers/lib/syncMeta";
import { getWorkflowItemById, parentAncestorIds } from "../handlers/lib/workflowDomain";
import { mutations as workflowMutations } from "../handlers/workflow";
import { mutations as nodeMutations } from "../handlers/cosplayNodes";
import type { LocalMutationCtx } from "../types";
import type { VaultReader, VaultSql, VaultStore } from "../store";
import { conflictBuildIds } from "./buildMembership";

/**
 * "Changes that didn't apply": the losing side of every managed-sync conflict, kept so the user can
 * see it and bring it back. Restoring is always a NEW edit on this device (it syncs like any other
 * edit); nothing rewinds the replica.
 */

export type ChangeAction =
  /** Put the overwritten field values back on the row. */
  | "restore-fields"
  /** Re-create the deleted row as a new row. */
  | "restore-row"
  /** Informational: the row was moved or unlinked and is still there. */
  | "acknowledge";

export interface ChangeNotApplied {
  id: string;
  table: string;
  rowId: string;
  kind: ReplicaConflictKind;
  lost: Record<string, unknown>;
  buildId: string | null;
  createdAt: number;
  /** The row's name, title or label, from the lost copy or the current row. */
  label: string | null;
  action: ChangeAction;
  /** False when what it would restore onto (the row, or its parent) no longer exists. */
  restorable: boolean;
}

const FULL_ROW_KINDS = new Set<ReplicaConflictKind>([
  "edit-after-delete",
  "delete-over-unseen-edit",
  "orphan-removed",
]);
const OMIT_ON_RESTORE = new Set(["_creationTime", ...REPLICA_SYSTEM_FIELDS, ...REPLICA_META_FIELDS]);

function labelOf(doc: Record<string, unknown> | null | undefined): string | null {
  for (const field of ["name", "title", "label", "note"]) {
    const value = doc?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** The row to insert for a full-row restore, or null when a required parent is gone. */
function restorableRow(
  reader: VaultReader,
  table: string,
  lost: Record<string, unknown>
): Record<string, unknown> | null {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(lost)) {
    if (!OMIT_ON_RESTORE.has(key) && value !== null) row[key] = value;
  }
  for (const rule of replicaLinksFor(table, row)) {
    const target = row[rule.field];
    if (typeof target !== "string" || reader.get(target)) continue;
    if (rule.onMissing === "unlink" || (table === "workflowItems" && rule.field === "parentId")) delete row[rule.field];
    else return null;
  }
  if (table === "workflowItems") row.ancestorIds = parentAncestorIds(
    typeof row.parentId === "string" ? getWorkflowItemById({ db: reader }, row.parentId) : null
  );
  return row;
}

function restoreRelationships(ctx: LocalMutationCtx, table: string, id: string, fields: Record<string, unknown>): void {
  if (table === "workflowItems" && Object.prototype.hasOwnProperty.call(fields, "parentId")) {
    workflowMutations["workflow:move"](ctx, { id, parentId: fields.parentId ?? null, sortOrder: fields.sortOrder });
    delete fields.parentId;
    delete fields.sortOrder;
  }
  if (table === "cosplayNodes" && Object.prototype.hasOwnProperty.call(fields, "parentNodeId")) {
    if (typeof fields.parentNodeId === "string") nodeMutations["cosplayNodes:addChildLink"](ctx, {
      parentNodeId: fields.parentNodeId, childNodeId: id, sortOrder: fields.sortOrder,
    });
    else nodeMutations["cosplayNodes:removeChildLink"](ctx, { id });
    delete fields.parentNodeId;
  }
}

function describe(
  reader: VaultReader,
  row: {
    id: string;
    table_name: string;
    row_id: string;
    kind: string;
    lost_json: string;
    build_id: string | null;
    created_at: number;
  }
): ChangeNotApplied {
  let lost: Record<string, unknown> = {};
  try {
    lost = JSON.parse(row.lost_json) as Record<string, unknown>;
  } catch {
    lost = {};
  }
  const kind = row.kind as ReplicaConflictKind;
  const current = reader.get(row.row_id);
  let action: ChangeAction = "acknowledge";
  let restorable = true;
  if (kind === "concurrent-field-edit") {
    action = "restore-fields";
    restorable = current !== null;
  } else if (FULL_ROW_KINDS.has(kind)) {
    action = "restore-row";
    restorable = restorableRow(reader, row.table_name, lost) !== null;
  }
  return {
    id: row.id,
    table: row.table_name,
    rowId: row.row_id,
    kind,
    lost,
    buildId: row.build_id,
    createdAt: row.created_at,
    label: labelOf(current) ?? labelOf(lost),
    action,
    restorable,
  };
}

/** Open changes, newest first; `buildId` narrows to one build's list. */
export function listChangesNotApplied(
  sql: VaultSql,
  reader: VaultReader,
  buildId?: string
): ChangeNotApplied[] {
  const rows = sql.getAllSync<{
    id: string;
    table_name: string;
    row_id: string;
    kind: string;
    lost_json: string;
    build_id: string | null;
    created_at: number;
  }>(
    "SELECT * FROM replica_conflicts WHERE resolved = 0 ORDER BY rev DESC"
  );
  return rows.map((row) => describe(reader, row)).filter(change =>
    !buildId || change.buildId === buildId || conflictBuildIds(sql, change.table, change.rowId, change.lost).has(buildId)
  );
}

export function countChangesNotApplied(sql: VaultSql, buildId?: string): number {
  const rows = sql.getAllSync<{ table_name: string; row_id: string; lost_json: string; build_id: string | null }>(
    "SELECT table_name, row_id, lost_json, build_id FROM replica_conflicts WHERE resolved = 0"
  );
  return rows.filter(row => !buildId || row.build_id === buildId ||
    conflictBuildIds(sql, row.table_name, row.row_id, JSON.parse(row.lost_json)).has(buildId)).length;
}

/**
 * Bring a change back as a new edit. Returns the id of the row it restored onto (a new row for a
 * full-row restore). Throws when it is no longer restorable.
 */
export function restoreChange(store: VaultStore, change: ChangeNotApplied): string {
  if (change.action === "restore-fields") {
    return store.commit((db) => {
      const current = db.get(change.rowId);
      if (!current) throw new Error("This item no longer exists on this device.");
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(change.lost)) {
        if (OMIT_ON_RESTORE.has(key)) continue;
        fields[key] = value === null ? undefined : value;
      }
      const ctx = { db, userId: store.subject, now: Date.now() };
      restoreRelationships(ctx, change.table, change.rowId, fields);
      if (Object.keys(fields).length) db.patch(
        change.rowId,
        withUpdateMeta(
          db.get(change.rowId) as { version?: number; fieldUpdatedAt?: Record<string, number> },
          fields, ctx.now
        )
      );
      return change.rowId;
    });
  }
  if (change.action === "restore-row") {
    return store.commit((db) => {
      const row = restorableRow(db, change.table, change.lost);
      if (!row) throw new Error("What this belonged to was deleted, so it can't come back.");
      const id = db.insert(change.table, withCreateMeta(row));
      const ctx = { db, userId: store.subject, now: Date.now() };
      restoreRelationships(ctx, change.table, id, { ...row });
      if (change.table === "workflowItems") {
        const buildIds = replicaBuildIdsFor(change.table, change.rowId, change.lost, []);
        if (change.buildId) buildIds.add(change.buildId);
        const surviving = db.query("builds").withIndex("by_userId", q => q.eq("userId", store.subject))
          .collect().filter(build => build.deletedAt === undefined && buildIds.has(build._id));
        workflowMutations["workflow:update"](ctx, { id, attachments: surviving.map(build => ({
          entityType: "build", entityId: build._id, role: "context", buildContextId: build._id,
        })) });
      }
      return id;
    });
  }
  throw new Error("Nothing to restore for this change.");
}
