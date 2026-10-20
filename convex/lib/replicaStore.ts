import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { hasPaidAccess } from "@kyarafit/design-system/domain/accessPolicy";
import {
  REPLICA_META_FIELDS,
  REPLICA_CONFLICT_BUILD_IDS,
  replicaBuildIdsFor,
  replicaBuildIdOf,
  REPLICA_PROTOCOL_VERSION,
  replicaLinksFor,
  replicaGeneratedWorkflowKey,
  type ReplicaConflictKind,
  type ReplicaErrorCode,
  type ReplicaErrorData,
  type ReplicaLinkRule,
  type ReplicaOp,
  type ReplicaOpStatus,
} from "@kyarafit/design-system/domain/replicaProtocol";
import { requireIdentity } from "./authz";
import { cleanupStorageClaim } from "./storageOwnership";
import { removePublishedProjection } from "../publications";

/**
 * Server half of the managed-sync row replica. See `convex/replica.ts` for the endpoint contract
 * and `design-system/domain/replicaProtocol.ts` for the shared vocabulary.
 */

type Fields = Record<string, unknown>;
type FieldRevs = Record<string, { rev: number; by: string }>;
type ReplicaRow = Doc<"replicaRows">;

/** Writes made by the server itself (integrity repairs, the Recovered build). */
export const SERVER_DEVICE = "server";

export function replicaError(code: ReplicaErrorCode, message: string) {
  return new ConvexError<ReplicaErrorData>({ code, message });
}

export function assertProtocol(protocol: number): void {
  if (protocol !== REPLICA_PROTOCOL_VERSION) {
    throw replicaError("protocol", "Unsupported sync protocol. Update the app to keep syncing.");
  }
}

/**
 * The paid actor for a replica call. The vault's `subject` must equal the session subject, so a
 * device can never push one account's vault into another account's replica after a switch.
 */
export async function requireReplicaActor(
  ctx: QueryCtx | MutationCtx,
  subject: string
): Promise<string> {
  let userId: string;
  try {
    userId = await requireIdentity(ctx);
  } catch {
    throw replicaError("unauthorized", "Unauthorized: sign in again to sync");
  }
  if (subject !== userId)
    throw replicaError("unauthorized", "Unauthorized: the signed-in account changed");
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", userId))
    .unique();
  if (!hasPaidAccess(user?.tier, user?.role))
    throw replicaError("not-entitled", "Sync requires Kyarafit Cloud");
  return userId;
}

export async function loadHead(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("replicaHeads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function liveFields(doc: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(doc)) if (value !== null) out[key] = value;
  return out;
}

const RECOVERED_NOTES =
  "Items saved from builds that were deleted on another device. Move them anywhere, or delete this build when you're done.";

/**
 * One account's replica inside one mutation. Every applied change takes the next `rev`; the head
 * is written once at `finish()`.
 */
export class ReplicaWriter {
  private head = 0;
  private headDoc: Doc<"replicaHeads"> | null = null;
  private recoveredBuildId: string | undefined;
  /** Rows deleted in this mutation whose children must be checked. */
  private readonly deletedParents: string[] = [];
  /** Rows put in this mutation whose parents must be checked. */
  private readonly putRows: { table: string; rowId: string }[] = [];

  private constructor(
    private readonly ctx: MutationCtx,
    readonly userId: string,
    private readonly now: number
  ) {}

  static async open(ctx: MutationCtx, userId: string, now = Date.now()): Promise<ReplicaWriter> {
    const writer = new ReplicaWriter(ctx, userId, now);
    writer.headDoc = await loadHead(ctx, userId);
    writer.head = writer.headDoc?.rev ?? 0;
    writer.recoveredBuildId = writer.headDoc?.recoveredBuildId;
    return writer;
  }

  private nextRev(): number {
    this.head += 1;
    return this.head;
  }

  async row(table: string, rowId: string): Promise<ReplicaRow | null> {
    return this.ctx.db
      .query("replicaRows")
      .withIndex("by_user_row", (q) =>
        q.eq("userId", this.userId).eq("table", table).eq("rowId", rowId)
      )
      .unique();
  }

  private async buildIds(table: string, rowId: string, lost: Fields): Promise<Set<string>> {
    const rows = new Map<string, { table: string; rowId: string; doc: Fields }>();
    const visit = async (kind: string, id: string): Promise<void> => {
      if (rows.has(id)) return;
      const row = await this.row(kind, id);
      const doc = (row?.doc as Fields | undefined) ?? {};
      rows.set(id, { table: kind, rowId: id, doc });
      const states = id === rowId ? [doc, { ...doc, ...lost }] : [doc];
      for (const state of states)
        for (const rule of replicaLinksFor(kind, state)) {
          const target = state[rule.field];
          if (typeof target === "string") await visit(rule.target, target);
        }
      if (kind === "workflowItems") {
        const links = await this.ctx.db
          .query("replicaLinks")
          .withIndex("by_user_target", (q) => q.eq("userId", this.userId).eq("target", id))
          .collect();
        const attachments = new Set<string>();
        for (const link of links) {
          if (link.table === "workflowAttachments" && link.field === "workflowItemId")
            attachments.add(link.rowId);
        }
        for (const attachment of attachments) await visit("workflowAttachments", attachment);
      }
    };
    await visit(table, rowId);
    return replicaBuildIdsFor(table, rowId, lost, [...rows.values()]);
  }

  private async conflict(
    table: string,
    rowId: string,
    kind: ReplicaConflictKind,
    lost: Fields
  ): Promise<void> {
    const buildIds = [...(await this.buildIds(table, rowId, lost))];
    const direct = replicaBuildIdOf(table, { ...lost, _id: rowId });
    lost = { ...lost };
    if (buildIds.some((id) => id !== direct)) lost[REPLICA_CONFLICT_BUILD_IDS] = buildIds;
    else delete lost[REPLICA_CONFLICT_BUILD_IDS];
    await this.ctx.db.insert("replicaConflicts", {
      userId: this.userId,
      table,
      rowId,
      kind,
      lost,
      rev: this.nextRev(),
      createdAt: this.now,
      dismissed: false,
    });
  }

  /** Re-index the parent references of a live row. */
  private async relink(table: string, rowId: string, doc: Fields | null): Promise<void> {
    const existing = await this.ctx.db
      .query("replicaLinks")
      .withIndex("by_user_row", (q) =>
        q.eq("userId", this.userId).eq("table", table).eq("rowId", rowId)
      )
      .collect();
    const wanted = new Map<string, string>();
    if (doc) {
      for (const rule of replicaLinksFor(table, doc)) {
        const target = doc[rule.field];
        if (typeof target === "string") wanted.set(rule.field, target);
      }
    }
    for (const link of existing) {
      if (wanted.get(link.field) === link.target) wanted.delete(link.field);
      else await this.ctx.db.delete(link._id);
    }
    for (const [field, target] of wanted) {
      await this.ctx.db.insert("replicaLinks", {
        userId: this.userId,
        target,
        table,
        rowId,
        field,
      });
    }
  }

  /**
   * Apply a field patch. Per field, the incoming value wins in server-arrival order; a value that
   * another device changed after the op's `baseRev` is kept as a conflict before being overwritten.
   */
  private async writePut(
    table: string,
    rowId: string,
    fields: Fields,
    baseRev: number,
    deviceId: string,
    row: ReplicaRow | null,
    rev: number
  ): Promise<void> {
    fields = { ...fields };
    const parentField =
      table === "cosplayNodes" ? "parentNodeId" : table === "workflowItems" ? "parentId" : null;
    if (parentField && typeof fields[parentField] === "string") {
      const visited = new Set([rowId]);
      let parent: unknown = fields[parentField];
      while (typeof parent === "string") {
        if (visited.has(parent)) {
          await this.conflict(table, rowId, "orphan-unlinked", {
            [parentField]: fields[parentField],
          });
          fields[parentField] = null;
          break;
        }
        visited.add(parent);
        const ancestor = await this.row(table, parent);
        parent = ancestor && !ancestor.deleted ? (ancestor.doc as Fields)[parentField] : null;
      }
    }
    const doc: Fields = { ...((row?.doc as Fields | undefined) ?? {}) };
    const fieldRevs: FieldRevs = { ...((row?.fieldRevs as FieldRevs | undefined) ?? {}) };
    const lost: Fields = {};
    for (const [field, value] of Object.entries(fields)) {
      const last = fieldRevs[field];
      if (
        !REPLICA_META_FIELDS.has(field) &&
        last &&
        last.rev > baseRev &&
        last.by !== deviceId &&
        !same(doc[field], value)
      ) {
        lost[field] = doc[field] ?? null;
      }
      if (value === null) delete doc[field];
      else doc[field] = value;
      fieldRevs[field] = { rev, by: deviceId };
    }
    if (Object.keys(lost).length > 0) {
      await this.conflict(table, rowId, "concurrent-field-edit", lost);
    }
    if (row) await this.ctx.db.patch(row._id, { doc, fieldRevs, rev });
    else {
      await this.ctx.db.insert("replicaRows", {
        userId: this.userId,
        table,
        rowId,
        doc,
        fieldRevs,
        deleted: false,
        rev,
      });
    }
    if (replicaLinksFor(table, doc).some((rule) => rule.field in fields) || !row) {
      await this.relink(table, rowId, doc);
    }
    this.putRows.push({ table, rowId });
  }

  /** Tombstone a row. The last document is kept (server-side only) until retention purges it. */
  private async writeDelete(table: string, rowId: string, row: ReplicaRow | null, rev: number) {
    if (row) {
      const buildIds = [...(await this.buildIds(table, rowId, row.doc as Fields))];
      const doc: Fields = { ...(row.doc as Fields), [REPLICA_CONFLICT_BUILD_IDS]: buildIds };
      await this.ctx.db.patch(row._id, { doc, deleted: true, deletedAt: this.now, rev });
    } else {
      await this.ctx.db.insert("replicaRows", {
        userId: this.userId,
        table,
        rowId,
        doc: {},
        fieldRevs: {},
        deleted: true,
        deletedAt: this.now,
        rev,
      });
    }
    await this.relink(
      table,
      rowId,
      table === "workflowAttachments" && row
        ? { workflowItemId: (row.doc as Fields).workflowItemId }
        : null
    );
    await removePublishedProjection(this.ctx, this.userId, table, rowId);
    this.deletedParents.push(rowId);
  }

  /** Apply one device op. Delete wins in both orders; every losing value is kept. */
  async apply(op: ReplicaOp, deviceId: string): Promise<{ status: ReplicaOpStatus; rev: number }> {
    const rev = this.nextRev();
    const row = await this.row(op.table, op.rowId);
    if (op.kind === "put") {
      const fields = (op.fields ?? {}) as Fields;
      if (row?.deleted) {
        await this.conflict(
          op.table,
          op.rowId,
          "edit-after-delete",
          liveFields({ ...(row.doc as Fields), ...fields })
        );
        return { status: "rejected", rev };
      }
      await this.writePut(op.table, op.rowId, fields, op.baseRev, deviceId, row, rev);
      return { status: "applied", rev };
    }
    if (row?.deleted) return { status: "applied", rev };
    if (row) {
      const unseen = Object.values((row.fieldRevs as FieldRevs) ?? {}).some(
        (last) => last.rev > op.baseRev && last.by !== deviceId
      );
      if (unseen) {
        await this.conflict(op.table, op.rowId, "delete-over-unseen-edit", row.doc as Fields);
      }
    }
    await this.writeDelete(op.table, op.rowId, row, rev);
    return { status: "applied", rev };
  }

  /** The account's live Recovered build, created on first use (and again if the user deleted it). */
  private async recoveredBuild(): Promise<string> {
    if (this.recoveredBuildId) {
      const existing = await this.row("builds", this.recoveredBuildId);
      if (existing && !existing.deleted) return this.recoveredBuildId;
    }
    const rev = this.nextRev();
    const rowId = `local:recovered-${rev}`;
    const doc: Fields = {
      _creationTime: this.now,
      userId: this.userId,
      name: "Recovered",
      status: "idea",
      visibility: "private",
      notes: RECOVERED_NOTES,
      recovered: true,
      version: 1,
      updatedAt: this.now,
      fieldUpdatedAt: {},
    };
    await this.writePut("builds", rowId, doc, rev, SERVER_DEVICE, null, rev);
    this.recoveredBuildId = rowId;
    return rowId;
  }

  /** Repair one live row whose `rule.field` points at a deleted parent. */
  private async repair(row: ReplicaRow, rule: ReplicaLinkRule): Promise<void> {
    const doc = row.doc as Fields;
    const parent = doc[rule.field];
    if (rule.onMissing === "remove" || rule.onMissing === "drop") {
      const rev = this.nextRev();
      if (rule.onMissing === "remove") {
        await this.conflict(row.table, row.rowId, "orphan-removed", doc);
      }
      await this.writeDelete(row.table, row.rowId, row, rev);
      return;
    }
    let patch: Fields;
    let kind: ReplicaConflictKind;
    if (rule.onMissing === "recover") {
      const recovered = await this.recoveredBuild();
      patch = { [rule.field]: recovered, updatedAt: this.now };
      if (row.table === "workflowAttachments" && rule.field === "entityId") {
        patch.entityKey = `build:${recovered}`;
      }
      kind = "orphan-recovered";
    } else {
      patch = { [rule.field]: null, updatedAt: this.now };
      kind = "orphan-unlinked";
    }
    const rev = this.nextRev();
    // Re-read: the Recovered build insert does not touch this row, but a prior repair might have.
    const current = (await this.row(row.table, row.rowId)) ?? row;
    await this.writePut(row.table, row.rowId, patch, rev, SERVER_DEVICE, current, rev);
    await this.conflict(row.table, row.rowId, kind, { [rule.field]: parent });
  }

  private async repairIfOrphaned(table: string, rowId: string, only?: string): Promise<void> {
    for (;;) {
      const row = await this.row(table, rowId);
      if (!row || row.deleted) return;
      const doc = row.doc as Fields;
      let repaired = false;
      for (const rule of replicaLinksFor(table, doc)) {
        const target = doc[rule.field];
        if (typeof target !== "string" || (only !== undefined && target !== only)) continue;
        const parent = await this.row(rule.target, target);
        if (parent && !parent.deleted) continue;
        const dedupeKey =
          rule.target === "workflowItems" && parent
            ? replicaGeneratedWorkflowKey(parent.doc as Fields)
            : null;
        const replacement = dedupeKey
          ? (await this.workflowRows()).find(
              (candidate) =>
                !candidate.deleted &&
                replicaGeneratedWorkflowKey(candidate.doc as Fields) === dedupeKey
            )
          : null;
        if (replacement) {
          const rev = this.nextRev();
          await this.writePut(
            table,
            rowId,
            { [rule.field]: replacement.rowId },
            rev,
            SERVER_DEVICE,
            row,
            rev
          );
        } else await this.repair(row, rule);
        repaired = true;
        break;
      }
      if (!repaired) return;
    }
  }

  /**
   * Cross-row integrity, after all of a batch's ops have applied: rows put in this batch must not
   * point at deleted parents, and rows that point at parents deleted in this batch are repaired.
   * Repairs that remove rows cascade to their own children.
   */
  private async workflowRows(): Promise<ReplicaRow[]> {
    return this.ctx.db
      .query("replicaRows")
      .withIndex("by_user_row", (q) => q.eq("userId", this.userId).eq("table", "workflowItems"))
      .collect();
  }

  async enforceIntegrity(): Promise<void> {
    const generated = new Map<string, ReplicaRow>();
    for (const item of (await this.workflowRows()).sort(
      (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
    )) {
      if (item.deleted) continue;
      const key = replicaGeneratedWorkflowKey(item.doc as Fields);
      if (!key) continue;
      const canonical = generated.get(key);
      if (!canonical) {
        generated.set(key, item);
        continue;
      }
      const current = (await this.row("workflowItems", canonical.rowId))!;
      const fields = { ...(item.doc as Fields) };
      delete fields._creationTime;
      const rev = this.nextRev();
      await this.writePut("workflowItems", canonical.rowId, fields, 0, SERVER_DEVICE, current, rev);
      await this.writeDelete("workflowItems", item.rowId, item, this.nextRev());
    }
    while (this.putRows.length > 0 || this.deletedParents.length > 0) {
      const put = this.putRows.shift();
      if (put) {
        await this.repairIfOrphaned(put.table, put.rowId);
        continue;
      }
      const parent = this.deletedParents.shift()!;
      const links = await this.ctx.db
        .query("replicaLinks")
        .withIndex("by_user_target", (q) => q.eq("userId", this.userId).eq("target", parent))
        .collect();
      for (const link of links) await this.repairIfOrphaned(link.table, link.rowId, parent);
    }
    const items = await this.workflowRows();
    const live = new Map(items.filter((item) => !item.deleted).map((item) => [item.rowId, item]));
    for (const item of live.values()) {
      const ancestors: string[] = [];
      let parent = (item.doc as Fields).parentId;
      while (typeof parent === "string" && live.has(parent) && !ancestors.includes(parent)) {
        ancestors.unshift(parent);
        parent = (live.get(parent)!.doc as Fields).parentId;
      }
      if (!same((item.doc as Fields).ancestorIds, ancestors)) {
        const rev = this.nextRev();
        await this.writePut(
          "workflowItems",
          item.rowId,
          { ancestorIds: ancestors },
          rev,
          SERVER_DEVICE,
          item,
          rev
        );
      }
    }
  }

  async finish(): Promise<number> {
    if (this.headDoc) {
      if (this.headDoc.rev !== this.head || this.headDoc.recoveredBuildId !== this.recoveredBuildId)
        await this.ctx.db.patch(this.headDoc._id, {
          rev: this.head,
          recoveredBuildId: this.recoveredBuildId,
        });
    } else if (this.head > 0) {
      await this.ctx.db.insert("replicaHeads", {
        userId: this.userId,
        rev: this.head,
        floorRev: 0,
        recoveredBuildId: this.recoveredBuildId,
      });
    }
    return this.head;
  }

  /** Move a conflict to a new rev as dismissed, so every device drops it on its next pull. */
  async dismissConflict(id: Id<"replicaConflicts">): Promise<boolean> {
    const conflict = await this.ctx.db.get(id);
    if (!conflict || conflict.userId !== this.userId || conflict.dismissed) return false;
    await this.ctx.db.patch(id, { dismissed: true, rev: this.nextRev() });
    return true;
  }
}

/**
 * Every replica row an account owns, per table (downgrade retention). Photo blobs whose last
 * reference was a replica asset are released with their quota.
 */
export async function purgeAccountReplica(
  ctx: MutationCtx,
  userId: string,
  dryRun = false
): Promise<number> {
  const docs = [
    ...(await ctx.db
      .query("replicaRows")
      .withIndex("by_user_row", (q) => q.eq("userId", userId))
      .collect()),
    ...(await ctx.db
      .query("replicaLinks")
      .withIndex("by_user_row", (q) => q.eq("userId", userId))
      .collect()),
    ...(await ctx.db
      .query("replicaOps")
      .withIndex("by_user_op", (q) => q.eq("userId", userId))
      .collect()),
    ...(await ctx.db
      .query("replicaConflicts")
      .withIndex("by_user_rev", (q) => q.eq("userId", userId))
      .collect()),
  ];
  const assets = await ctx.db
    .query("replicaAssets")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (dryRun) return docs.length + assets.length;
  for (const doc of docs) await ctx.db.delete(doc._id);
  for (const asset of assets) {
    await ctx.db.delete(asset._id);
    await cleanupStorageClaim(ctx, asset.imageStorageId);
  }
  return docs.length + assets.length;
}

/**
 * Start a new replica generation after a purge: devices that synced the old generation see the
 * change, drop their sync bookkeeping and upload their vault again. Kept out of the purge itself,
 * which runs as a deletes-only cleanup mutation.
 */
export async function startReplicaGeneration(ctx: MutationCtx, userId: string): Promise<void> {
  const head = await loadHead(ctx, userId);
  if (!head) return;
  await ctx.db.patch(head._id, {
    generation: `${head._id}:${Date.now()}`,
    floorRev: head.rev,
    recoveredBuildId: undefined,
  });
}
