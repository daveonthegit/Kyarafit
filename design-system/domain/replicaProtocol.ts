/**
 * The managed-sync row replica protocol (DATA_AND_SYNC.md §6), shared by the Convex endpoint
 * (`convex/replica.ts`) and the device replicator (`mobile/src/vault/replica`).
 *
 * Devices replicate ROW STATE, not commands: each op is a field patch (`put`) or a `delete` for one
 * vault row, keyed by the row's client-minted id. The server orders every applied change with a
 * per-account `rev`; a pull cursor always acknowledges a complete prefix of that stream.
 */

export const REPLICA_PROTOCOL_VERSION = 1;

/** Vault tables that replicate (everything but device-local settings). */
export const REPLICA_TABLES = [
  "builds",
  "cosplayNodes",
  "buildTasks",
  "workflowItems",
  "workflowAttachments",
  "workflowDependencies",
  "conventions",
  "conventionDayPlans",
  "packingListItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
] as const;
export type ReplicaTable = (typeof REPLICA_TABLES)[number];

export function isReplicaTable(table: string): table is ReplicaTable {
  return (REPLICA_TABLES as readonly string[]).includes(table);
}

/**
 * Device bookkeeping stamped on every local write. Last-writer-wins and never reported as a
 * conflict: without this, every concurrent edit to different fields would look like a clash.
 */
export const REPLICA_META_FIELDS: ReadonlySet<string> = new Set([
  "updatedAt",
  "version",
  "fieldUpdatedAt",
]);

/** Fields never carried in an op (the row id is the op's `rowId`). */
export const REPLICA_SYSTEM_FIELDS: ReadonlySet<string> = new Set(["_id"]);

export const REPLICA_MAX_PUSH_OPS = 100;
export const REPLICA_MAX_PULL_ROWS = 500;
/** Per-op patch size bound (a vault row is far smaller; this only stops abuse). */
export const REPLICA_MAX_OP_BYTES = 64 * 1024;

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Op dedupe records and tombstones are kept this long. A device whose cursor is older than the
 * oldest purged tombstone must resnapshot (it could otherwise miss a delete).
 */
export const REPLICA_RETENTION_MS = 90 * DAY_MS;

export type ReplicaOpKind = "put" | "delete";

export interface ReplicaOp {
  opId: string;
  table: string;
  rowId: string;
  kind: ReplicaOpKind;
  /** Changed fields; `null` removes a field. Absent for deletes. */
  fields?: Record<string, unknown>;
  /** The server rev of this row the device last pulled (0 = never seen). */
  baseRev: number;
}

export type ReplicaOpStatus = "applied" | "rejected";

export interface ReplicaPushResult {
  outcomes: { opId: string; status: ReplicaOpStatus; rev: number }[];
  head: number;
}

export interface ReplicaPulledRow {
  table: string;
  rowId: string;
  /** Absent for a tombstone. */
  doc?: Record<string, unknown>;
  deleted: boolean;
  rev: number;
}

/**
 * Why a change did not apply as written. The losing value is always kept so the user can restore
 * it as a new edit ("changes that didn't apply").
 *
 * - `concurrent-field-edit`: another device changed the same field first; `lost` holds the
 *   overwritten values.
 * - `edit-after-delete`: an edit reached a row another device had deleted; `lost` is the full row
 *   as it would have been.
 * - `delete-over-unseen-edit`: a delete won over an edit the deleting device had not seen; `lost`
 *   is the full row before the delete.
 * - `orphan-recovered`: the row's build was deleted on another device; it was moved to the
 *   account's Recovered build. `lost` holds the original references.
 * - `orphan-unlinked`: the row's parent was deleted on another device; the reference was cleared.
 * - `orphan-removed`: the row could not exist without its deleted parent; `lost` is the full row.
 */
export type ReplicaConflictKind =
  | "concurrent-field-edit"
  | "edit-after-delete"
  | "delete-over-unseen-edit"
  | "orphan-recovered"
  | "orphan-unlinked"
  | "orphan-removed";

export interface ReplicaConflict {
  id: string;
  table: string;
  rowId: string;
  kind: ReplicaConflictKind;
  lost: Record<string, unknown>;
  rev: number;
  createdAt: number;
  dismissed: boolean;
}

export interface ReplicaPullResult {
  rows: ReplicaPulledRow[];
  conflicts: ReplicaConflict[];
  cursor: number;
  hasMore: boolean;
  /** The device's cursor is older than retained history: restart from 0 and reconcile. */
  resnapshot: boolean;
}

/**
 * What happens to a row whose parent was deleted on another device (cross-row integrity).
 *
 * - `recover`: point the reference at the account's Recovered build (user content survives).
 * - `unlink`: clear the reference, keep the row (it already survives a local cascade this way).
 * - `remove`: delete the row; the full row is kept as an `orphan-removed` conflict.
 * - `drop`: delete a pure link row silently (it carries no user content).
 */
export type ReplicaOrphanAction = "recover" | "unlink" | "remove" | "drop";

export interface ReplicaLinkRule {
  table: ReplicaTable;
  field: string;
  target: ReplicaTable;
  onMissing: ReplicaOrphanAction;
  /** Only rows whose `entityType` equals this follow the rule (polymorphic attachments). */
  entityType?: string;
}

export const REPLICA_LINK_RULES: readonly ReplicaLinkRule[] = [
  { table: "cosplayNodes", field: "buildId", target: "builds", onMissing: "unlink" },
  { table: "cosplayNodes", field: "parentNodeId", target: "cosplayNodes", onMissing: "unlink" },
  { table: "buildTasks", field: "buildId", target: "builds", onMissing: "recover" },
  { table: "buildTasks", field: "cosplayNodeId", target: "cosplayNodes", onMissing: "unlink" },
  {
    table: "buildTasks",
    field: "packingListItemId",
    target: "packingListItems",
    onMissing: "unlink",
  },
  { table: "buildReferenceImages", field: "buildId", target: "builds", onMissing: "recover" },
  { table: "buildProcessPictures", field: "buildId", target: "builds", onMissing: "recover" },
  { table: "buildProgressUpdates", field: "buildId", target: "builds", onMissing: "recover" },
  {
    table: "conventionDayPlans",
    field: "conventionId",
    target: "conventions",
    onMissing: "remove",
  },
  { table: "conventionDayPlans", field: "buildId", target: "builds", onMissing: "unlink" },
  { table: "packingListItems", field: "conventionId", target: "conventions", onMissing: "remove" },
  { table: "packingListItems", field: "buildId", target: "builds", onMissing: "unlink" },
  {
    table: "packingListItems",
    field: "cosplayNodeId",
    target: "cosplayNodes",
    onMissing: "unlink",
  },
  {
    table: "packingListItems",
    field: "workflowItemId",
    target: "workflowItems",
    onMissing: "unlink",
  },
  { table: "workflowItems", field: "parentId", target: "workflowItems", onMissing: "remove" },
  {
    table: "workflowAttachments",
    field: "workflowItemId",
    target: "workflowItems",
    onMissing: "drop",
  },
  {
    table: "workflowAttachments",
    field: "entityId",
    target: "builds",
    onMissing: "recover",
    entityType: "build",
  },
  {
    table: "workflowAttachments",
    field: "entityId",
    target: "cosplayNodes",
    onMissing: "drop",
    entityType: "cosplayNode",
  },
  {
    table: "workflowAttachments",
    field: "entityId",
    target: "conventions",
    onMissing: "drop",
    entityType: "convention",
  },
  {
    table: "workflowAttachments",
    field: "entityId",
    target: "packingListItems",
    onMissing: "drop",
    entityType: "packingItem",
  },
  { table: "workflowAttachments", field: "buildContextId", target: "builds", onMissing: "recover" },
  {
    table: "workflowDependencies",
    field: "predecessorWorkflowItemId",
    target: "workflowItems",
    onMissing: "drop",
  },
  {
    table: "workflowDependencies",
    field: "successorWorkflowItemId",
    target: "workflowItems",
    onMissing: "drop",
  },
];

/** The rules that apply to `doc` in `table` (polymorphic rules filtered by `entityType`). */
export function replicaLinksFor(
  table: string,
  doc: Record<string, unknown>
): readonly ReplicaLinkRule[] {
  return REPLICA_LINK_RULES.filter(
    (rule) =>
      rule.table === table && (rule.entityType === undefined || rule.entityType === doc.entityType)
  );
}

/** The build a row belongs to, for the per-build "changes that didn't apply" list. */
export function replicaBuildIdOf(table: string, doc: Record<string, unknown>): string | null {
  if (table === "builds") return typeof doc._id === "string" ? doc._id : null;
  if (typeof doc.buildId === "string") return doc.buildId;
  if (table === "workflowAttachments" && doc.entityType === "build") {
    return typeof doc.entityId === "string" ? doc.entityId : null;
  }
  if (typeof doc.buildContextId === "string") return doc.buildContextId;
  return null;
}
