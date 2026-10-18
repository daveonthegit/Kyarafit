import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { makeFunctionReference } from "convex/server";
import { releaseDeletedStorage, releaseUserStorage } from "./storageOwnership";
import {
  deletionEpoch,
  deletionJob,
  deletionSubjectHash,
  hasSyncMeta,
  ownerReferences,
  resourceReference,
} from "./deletionReferences";
import { withUpdateMeta } from "./syncMeta";
import { guardFor, MutationGuard } from "./guardedMutation";
import { initialLedgerCheckpoint, inspectLedgerChunk } from "./ledgerInspection";
export { deletionJob, deletionSubjectHash } from "./deletionReferences";

export const DELETION_BATCH_SIZE = 5;

const runCleanup = makeFunctionReference<
  "action",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:run");

export async function scheduleDeletion(
  ctx: MutationCtx,
  jobId: Id<"accountDeletionJobs">,
  delay = 0
) {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "pending") return;
  const scheduledId = await ctx.scheduler.runAfter(delay, runCleanup, {
    jobId,
    revision: job.revision,
  });
  await ctx.db.patch(jobId, { scheduledId, updatedAt: Date.now() });
}

async function queueAssets(
  ctx: MutationCtx,
  jobId: Id<"accountDeletionJobs">,
  row: Record<string, unknown>,
  offset = 0,
  limit = 100
) {
  const ids = new Set<Id<"_storage">>();
  if (offset === 0 && row.imageStorageId) ids.add(row.imageStorageId as Id<"_storage">);
  const refs = (row.imageRefs ?? []) as Array<{ kind: string; storageId?: Id<"_storage"> }>;
  for (const ref of refs.slice(offset, offset + limit))
    if (ref.kind === "cloud" && ref.storageId) ids.add(ref.storageId);
  for (const storageId of ids) await ctx.db.insert("accountDeletionAssets", { jobId, storageId });
}

/** Invoked through a real mutation from the Better Auth action hook, never a cast action ctx. */
export async function deleteUserOwnedData(ctx: MutationCtx, externalId: string) {
  const callerGuard = guardFor(ctx);
  if (!callerGuard.cleanup) ctx = new MutationGuard(callerGuard.raw, true).context();
  const existing = await deletionJob(ctx, externalId);
  if (existing) return existing._id;
  const state = await ctx.db.query("accountDeletionState").first();
  if (state) await ctx.db.patch(state._id, { generation: state.generation + 1 });
  else await ctx.db.insert("accountDeletionState", { generation: 1 });
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
  const jobId = await ctx.db.insert("accountDeletionJobs", {
    subjectHash: await deletionSubjectHash(externalId),
    externalId,
    userId: user?._id,
    status: "pending",
    phase: 0,
    processed: 0,
    attempts: 0,
    revision: 0,
    updatedAt: Date.now(),
  });
  if (user) {
    await queueAssets(ctx, jobId, user);
    // The normal single consent row is removed immediately. Historical duplicates are drained
    // by the first bounded job phase; deleting the app user also invalidates recipient resolution.
    const preferences = await ctx.db
      .query("userPushPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(DELETION_BATCH_SIZE);
    for (const preference of preferences) await ctx.db.delete(preference._id);
    // Immediately suppress profile visibility, direct-user mutation paths and push registration.
    await ctx.db.delete(user._id);
  }
  await scheduleDeletion(ctx, jobId);
  callerGuard.invalidate();
  return jobId;
}

// Children are swept before their parents, including deployment-compatible legacy tables.
// Full-table pages deliberately cover foreign-owned relationship rows and malformed historical
// data without unbounded collects or additional shared-schema indexes.
export const DELETION_TABLES = [
  "userPushPreferences",
  "idempotencyLedger",
  "broadcasts",
  "users", // detach a surviving profile's focus before removing its referenced build
  "workflowTemplateItems",
  "workflowDependencies",
  "workflowAttachments",
  "packingListItems",
  "buildTasks",
  "buildReferenceImages",
  "buildProcessPictures",
  "progressMediaReferences",
  "buildProgressUpdates",
  "buildLikes",
  "buildComments",
  "buildCollaborators",
  "conventionDayPlans",
  "groupConventionDays",
  "groupMembers",
  "follows",
  "activities",
  "cosplayNodeLinks",
  "buildCosplayLinks",
  "buildNodeStates",
  "buildItemLinks",
  "workflowItems", // detach foreign rows before removing owned workflow parents
  "cosplayNodes", // likewise detach retained elements from removed parents/builds
  "builds", // detach foreign builds from groups owned by the deleted user
  "workflowItems",
  "cosplayNodes",
  "closetItems",
  "workflowTemplates",
  "conventions",
  "groups",
  "builds",
] as const satisfies readonly TableNames[];

type Row = Record<string, unknown> & { _id: Id<TableNames> };

async function ownedParent(
  ctx: MutationCtx,
  id: unknown,
  externalId: string,
  seen = new Set<string>()
): Promise<boolean> {
  if (typeof id !== "string") return false;
  const ref = resourceReference(ctx, id);
  if (!ref || ref.kind !== "resource") return false;
  if (seen.has(id)) return true;
  seen.add(id);
  const parent = await ctx.db.get(id as Id<TableNames>);
  if (!parent) return true; // A valid but missing resource cannot become live again; remove its dangling edge.
  for (const owner of ownerReferences(ctx, ref.table, parent)) {
    if (owner.kind === "subject" && owner.value === externalId) return true;
    if (owner.kind === "resource" && (await ownedParent(ctx, owner.value, externalId, seen)))
      return true;
  }
  return false;
}
async function ancestorsFingerprint(ids: unknown[]) {
  return deletionSubjectHash(JSON.stringify(ids));
}
async function patchRetained(
  ctx: MutationCtx,
  table: TableNames,
  row: Row,
  patch: Record<string, unknown>
) {
  if (!Object.keys(patch).length) return;
  const meta = {
    version: typeof row.version === "number" ? row.version : undefined,
    fieldUpdatedAt: row.fieldUpdatedAt as Record<string, number> | undefined,
  };
  await ctx.db.patch(row._id, hasSyncMeta(table) ? withUpdateMeta(meta, patch) : patch);
}

async function shouldRemove(
  ctx: MutationCtx,
  table: TableNames,
  row: Row,
  job: Doc<"accountDeletionJobs">
) {
  const actor = job.externalId!;
  if (table === "userPushPreferences") return row.userId === job.userId;
  if (table === "broadcasts") return row.createdBy === job.userId;
  if (table === "users") return false;
  // Owned ledger rows short-circuit before any payload traversal; foreign rows have a separate
  // durable, content-versioned inspection checkpoint in stepDeletion.
  if (table === "idempotencyLedger") return row.userId === actor || row.userId === job.userId;
  if (
    row.userId === actor ||
    row.createdBy === actor ||
    (job.userId && (row.userId === job.userId || row.createdBy === job.userId))
  )
    return true;
  if (table === "workflowItems" && (await ownedParent(ctx, row.scopeId, actor))) return true;
  if (table === "follows") return row.followerId === actor || row.followingId === actor;
  // A foreign build shared into a deleted group survives; only the association is removed.
  if (
    ["builds", "cosplayNodes", "workflowItems", "closetItems", "workflowTemplates"].includes(table)
  )
    return false;
  for (const field of [
    "buildId",
    "cosplayNodeId",
    "closetItemId",
    "parentNodeId",
    "childNodeId",
    "workflowItemId",
    "predecessorWorkflowItemId",
    "successorWorkflowItemId",
    "templateId",
    "conventionId",
    "groupId",
    "progressUpdateId",
    "packingListItemId",
    "buildContextId",
    "scopeId",
  ]) {
    // Legacy opaque closetItemId strings are not necessarily valid Convex IDs.
    if (field === "closetItemId") {
      const id =
        typeof row[field] === "string" ? ctx.db.normalizeId("closetItems", row[field]) : null;
      if (id && (await ownedParent(ctx, id, actor))) return true;
    } else if (await ownedParent(ctx, row[field], actor)) return true;
    else if (field === "progressUpdateId" && typeof row[field] === "string") {
      const progress = await ctx.db.get(row[field] as Id<"buildProgressUpdates">);
      if (progress && (await ownedParent(ctx, progress.buildId, actor))) return true;
    }
  }
  if (table === "workflowAttachments" && typeof row.entityId === "string") {
    for (const parentTable of ["builds", "cosplayNodes", "conventions"] as const) {
      const id = ctx.db.normalizeId(parentTable, row.entityId);
      if (id && (await ownedParent(ctx, id, actor))) return true;
    }
  }
  return false;
}

async function detachRetainedRow(
  ctx: MutationCtx,
  table: TableNames,
  row: Row,
  actor: string,
  userId?: Id<"users">,
  ancestorsChecked = false
) {
  const patch: Record<string, unknown> = {};
  if (table === "users" && (await ownedParent(ctx, row.focusedBuildId, actor)))
    patch.focusedBuildId = undefined;
  if (table === "builds" && (await ownedParent(ctx, row.groupId, actor))) patch.groupId = undefined;
  if (table === "cosplayNodes") {
    for (const field of ["buildId", "parentNodeId"])
      if (await ownedParent(ctx, row[field], actor)) patch[field] = undefined;
  }
  if (table === "workflowItems") {
    for (const field of ["creatorUserId", "ownerUserId", "assigneeUserId"])
      if (row[field] === actor || (userId && row[field] === userId)) patch[field] = undefined;
    if (await ownedParent(ctx, row.parentId, actor)) patch.parentId = undefined;
    if (!ancestorsChecked) {
      const ancestors = row.ancestorIds as Id<"workflowItems">[];
      const retained = [];
      for (const id of ancestors) if (!(await ownedParent(ctx, id, actor))) retained.push(id);
      if (retained.length !== ancestors.length) patch.ancestorIds = retained;
    }
    if (await ownedParent(ctx, row.templateId, actor)) patch.templateId = undefined;
    if (await ownedParent(ctx, row.legacyBuildTaskId, actor)) patch.legacyBuildTaskId = undefined;
  }
  // audienceArgs is intentionally untyped today. Remove identity occurrences recursively rather
  // than guessing a future campaign payload shape; the delivery stub sends nothing.
  if (table === "broadcasts" && row.audienceArgs !== undefined) {
    const scrub = (value: unknown): unknown => {
      if (value === actor || (userId && value === userId)) return undefined;
      if (Array.isArray(value)) return value.map(scrub).filter((v) => v !== undefined);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== actor && key !== userId)
            .map(([key, val]) => [key, scrub(val)])
            .filter(([, val]) => val !== undefined)
        );
      return value;
    };
    patch.audienceArgs = scrub(row.audienceArgs);
  }
  await patchRetained(ctx, table, row, patch);
}

/** One atomic checkpoint. A failed transaction leaves both data and cursor unchanged. */
export async function stepDeletion(
  ctx: MutationCtx,
  jobId: Id<"accountDeletionJobs">,
  revision?: number
) {
  if (!guardFor(ctx).cleanup) ctx = new MutationGuard(guardFor(ctx).raw, true).context();
  const job = await ctx.db.get(jobId);
  if (
    !job ||
    job.status !== "pending" ||
    !job.externalId ||
    (revision !== undefined && revision !== job.revision)
  )
    return;
  // Duplicate deliveries and operator resumes cannot fork the scheduled cleanup chain.
  await ctx.db.patch(jobId, { revision: job.revision + 1 });
  if (job.assetRowId) {
    const row = await ctx.db.get(job.assetRowId as Id<TableNames>);
    const offset = job.assetOffset ?? 0;
    if (row) await queueAssets(ctx, jobId, row, offset);
    const length = row && "imageRefs" in row ? row.imageRefs.length : 0;
    if (offset + 100 >= length) {
      if (row) await ctx.db.delete(row._id);
      await ctx.db.patch(jobId, {
        assetRowId: undefined,
        assetOffset: undefined,
        processed: job.processed + 1,
      });
    } else await ctx.db.patch(jobId, { assetOffset: offset + 100 });
    await scheduleDeletion(ctx, jobId);
    return;
  }
  if (job.ancestorRowId) {
    const row = await ctx.db.get(job.ancestorRowId);
    if (row) {
      const fingerprint = await ancestorsFingerprint(row.ancestorIds);
      const offset = fingerprint === job.ancestorFingerprint ? (job.ancestorOffset ?? 0) : 0;
      const chunk = row.ancestorIds.slice(offset, offset + 4);
      const retained = [];
      for (const id of chunk) if (!(await ownedParent(ctx, id, job.externalId))) retained.push(id);
      const next = [
        ...row.ancestorIds.slice(0, offset),
        ...retained,
        ...row.ancestorIds.slice(offset + 4),
      ];
      if (retained.length !== chunk.length)
        await patchRetained(ctx, "workflowItems", row, { ancestorIds: next });
      const done = offset + 4 >= row.ancestorIds.length;
      await ctx.db.patch(jobId, {
        ancestorRowId: done ? undefined : row._id,
        ancestorOffset: done ? undefined : offset + retained.length,
        ancestorFingerprint: done ? undefined : await ancestorsFingerprint(next),
        ancestorChecked: done ? await ancestorsFingerprint(next) : undefined,
      });
    } else
      await ctx.db.patch(jobId, {
        ancestorRowId: undefined,
        ancestorOffset: undefined,
        ancestorFingerprint: undefined,
      });
    await scheduleDeletion(ctx, jobId);
    return;
  }
  if (job.ledgerRowId) {
    const row = await ctx.db.get(job.ledgerRowId);
    const generation = await deletionEpoch(ctx);
    if (row && !row.replayBlocked) {
      const unchanged =
        row.resultRevision === job.ledgerResultRevision && generation === job.ledgerGeneration;
      const checkpoint =
        unchanged && job.ledgerCursor
          ? { walk: JSON.parse(job.ledgerCursor), subjects: job.ledgerSubjects ?? [] }
          : initialLedgerCheckpoint();
      const inspected = await inspectLedgerChunk(ctx, row.result, checkpoint);
      if (!inspected.done) {
        await ctx.db.patch(jobId, {
          ledgerCursor: JSON.stringify(inspected.checkpoint.walk),
          ledgerSubjects: inspected.checkpoint.subjects,
          ledgerResultRevision: row.resultRevision,
          ledgerGeneration: generation,
        });
        await scheduleDeletion(ctx, jobId);
        return;
      }
      await ctx.db.patch(
        row._id,
        inspected.blocked
          ? {
              result: undefined,
              replayBlocked: true,
              subjectHashes: undefined,
              validatedEpoch: generation,
              resultRevision: crypto.randomUUID(),
            }
          : {
              subjectHashes: inspected.checkpoint.subjects,
              validatedEpoch: generation,
              resultRevision: row.resultRevision ?? crypto.randomUUID(),
            }
      );
    }
    await ctx.db.patch(jobId, {
      phase: job.ledgerPageDone ? job.phase + 1 : job.phase,
      cursor: job.ledgerNextCursor,
      ledgerRowId: undefined,
      ledgerCursor: undefined,
      ledgerSubjects: undefined,
      ledgerResultRevision: undefined,
      ledgerGeneration: undefined,
      ledgerNextCursor: undefined,
      ledgerPageDone: undefined,
      processed: job.processed + 1,
    });
    await scheduleDeletion(ctx, jobId);
    return;
  }
  const table = DELETION_TABLES[job.phase];
  if (table) {
    const page = await ctx.db.query(table).paginate({
      cursor: job.cursor ?? null,
      numItems:
        table === "idempotencyLedger" || table === "workflowItems" ? 1 : DELETION_BATCH_SIZE,
    });
    const detachPass =
      (table === "workflowItems" || table === "cosplayNodes" || table === "builds") &&
      job.phase === DELETION_TABLES.indexOf(table);
    for (const doc of page.page) {
      const row = doc as Row;
      if (
        table === "idempotencyLedger" &&
        row.userId !== job.externalId &&
        row.userId !== job.userId &&
        !row.replayBlocked
      ) {
        await ctx.db.patch(jobId, {
          ledgerRowId: row._id as Id<"idempotencyLedger">,
          ledgerCursor: JSON.stringify(initialLedgerCheckpoint().walk),
          ledgerSubjects: [],
          ledgerResultRevision: row.resultRevision as string | undefined,
          ledgerGeneration: await deletionEpoch(ctx),
          ledgerNextCursor: page.isDone ? undefined : page.continueCursor,
          ledgerPageDone: page.isDone,
        });
        await scheduleDeletion(ctx, jobId);
        return;
      }
      if (!detachPass && (await shouldRemove(ctx, table, row, job))) {
        if (Array.isArray(row.imageRefs) && row.imageRefs.length > 100) {
          // Keep the document until its nested worklist is durably enumerated in small chunks.
          // Retain the preceding table cursor so unprocessed neighbors are visited on retry.
          await ctx.db.patch(jobId, { assetRowId: row._id, assetOffset: 0 });
          await scheduleDeletion(ctx, jobId);
          return;
        }
        await queueAssets(ctx, jobId, row);
        await ctx.db.delete(row._id);
      } else if (row.userId !== job.externalId) {
        const ancestors =
          table === "workflowItems" && Array.isArray(row.ancestorIds) ? row.ancestorIds : [];
        const checked =
          ancestors.length > 4 && job.ancestorChecked === (await ancestorsFingerprint(ancestors));
        if (ancestors.length > 4 && !checked) {
          await ctx.db.patch(jobId, {
            ancestorRowId: row._id as Id<"workflowItems">,
            ancestorOffset: 0,
            ancestorFingerprint: await ancestorsFingerprint(ancestors),
          });
          await scheduleDeletion(ctx, jobId);
          return;
        }
        await detachRetainedRow(ctx, table, row, job.externalId, job.userId, checked);
      }
    }
    await ctx.db.patch(jobId, {
      phase: page.isDone ? job.phase + 1 : job.phase,
      cursor: page.isDone ? undefined : page.continueCursor,
      processed: job.processed + page.page.length,
      ancestorChecked: undefined,
    });
    await scheduleDeletion(ctx, jobId);
    return;
  }
  if (job.phase === DELETION_TABLES.length) {
    const asset = await ctx.db
      .query("accountDeletionAssets")
      .withIndex("by_jobId", (q) => q.eq("jobId", jobId))
      .first();
    if (asset) {
      const result = await releaseDeletedStorage(ctx, job.externalId, asset.storageId, job.cursor);
      if (result.done) await ctx.db.delete(asset._id);
      await ctx.db.patch(jobId, { cursor: result.cursor, processed: job.processed + 1 });
    } else await ctx.db.patch(jobId, { phase: job.phase + 1, cursor: undefined });
    await scheduleDeletion(ctx, jobId);
    return;
  }
  const result = await releaseUserStorage(ctx, job.externalId, job.cursor);
  if (!result.done) {
    await ctx.db.patch(jobId, { cursor: result.cursor });
    await scheduleDeletion(ctx, jobId, result.retryAfterMs);
    return;
  }
  await ctx.db.patch(jobId, {
    status: "complete",
    externalId: undefined,
    userId: undefined,
    cursor: undefined,
    assetRowId: undefined,
    assetOffset: undefined,
    ledgerRowId: undefined,
    ledgerCursor: undefined,
    ledgerResultRevision: undefined,
    ledgerSubjects: undefined,
    ledgerGeneration: undefined,
    ledgerNextCursor: undefined,
    ledgerPageDone: undefined,
    ancestorRowId: undefined,
    ancestorOffset: undefined,
    ancestorFingerprint: undefined,
    ancestorChecked: undefined,
    scheduledId: undefined,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });
}
