import {
  REPLICA_META_FIELDS,
  replicaLinksFor,
  type ReplicaConflictKind,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { withCreateMeta, withUpdateMeta } from "../handlers/lib/syncMeta";
import type { VaultReader, VaultSql, VaultStore } from "../store";

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
const OMIT_ON_RESTORE = new Set(["_id", "_creationTime", ...REPLICA_META_FIELDS]);

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
    if (rule.onMissing === "unlink") delete row[rule.field];
    else return null;
  }
  return row;
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
    buildId
      ? "SELECT * FROM replica_conflicts WHERE resolved = 0 AND build_id = ? ORDER BY rev DESC"
      : "SELECT * FROM replica_conflicts WHERE resolved = 0 ORDER BY rev DESC",
    buildId ? [buildId] : []
  );
  return rows.map((row) => describe(reader, row));
}

export function countChangesNotApplied(sql: VaultSql, buildId?: string): number {
  return (
    sql.getFirstSync<{ c: number }>(
      buildId
        ? "SELECT COUNT(*) AS c FROM replica_conflicts WHERE resolved = 0 AND build_id = ?"
        : "SELECT COUNT(*) AS c FROM replica_conflicts WHERE resolved = 0",
      buildId ? [buildId] : []
    )?.c ?? 0
  );
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
      db.patch(
        change.rowId,
        withUpdateMeta(
          current as { version?: number; fieldUpdatedAt?: Record<string, number> },
          fields
        )
      );
      return change.rowId;
    });
  }
  if (change.action === "restore-row") {
    return store.commit((db) => {
      const row = restorableRow(db, change.table, change.lost);
      if (!row) throw new Error("What this belonged to was deleted, so it can't come back.");
      return db.insert(change.table, withCreateMeta(row));
    });
  }
  throw new Error("Nothing to restore for this change.");
}
