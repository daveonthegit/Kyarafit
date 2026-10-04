import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { makeFunctionReference } from "convex/server";
import { releaseDeletedStorage, releaseUserStorage } from "./storageOwnership";

export const DELETION_BATCH_SIZE = 5;

/** A one-way suppression key prevents still-valid JWTs from recreating a deleted mirror. */
export async function deletionSubjectHash(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`kyarafit-account-deletion:${subject}`)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deletionJob(ctx: QueryCtx, externalId: string) {
  const hash = await deletionSubjectHash(externalId);
  return ctx.db
    .query("accountDeletionJobs")
    .withIndex("by_subjectHash", (q) => q.eq("subjectHash", hash))
    .unique();
}

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
  row: Record<string, unknown>
) {
  const ids = new Set<Id<"_storage">>();
  if (row.imageStorageId) ids.add(row.imageStorageId as Id<"_storage">);
  for (const ref of (row.imageRefs ?? []) as Array<{ kind: string; storageId?: Id<"_storage"> }>)
    if (ref.kind === "cloud" && ref.storageId) ids.add(ref.storageId);
  for (const storageId of ids) await ctx.db.insert("accountDeletionAssets", { jobId, storageId });
}

/** Invoked through a real mutation from the Better Auth action hook, never a cast action ctx. */
export async function deleteUserOwnedData(ctx: MutationCtx, externalId: string) {
  const existing = await deletionJob(ctx, externalId);
  if (existing) return existing._id;
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
  return jobId;
}

// Children are swept before their parents, including deployment-compatible legacy tables.
// Full-table pages deliberately cover foreign-owned relationship rows and malformed historical
// data without unbounded collects or additional shared-schema indexes.
export const DELETION_TABLES = [
  "userPushPreferences",
  "idempotencyLedger",
  "broadcasts",
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

async function ownedParent(ctx: MutationCtx, id: unknown, externalId: string) {
  if (typeof id !== "string") return false;
  const normalized = id as Id<TableNames>;
  const parent = await ctx.db.get(normalized);
  return (
    parent != null &&
    (("userId" in parent && parent.userId === externalId) ||
      ("createdBy" in parent && parent.createdBy === externalId))
  );
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
  if (row.userId === actor || row.createdBy === actor) return true;
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
  ]) {
    // Legacy opaque closetItemId strings are not necessarily valid Convex IDs.
    if (field === "closetItemId") {
      const id =
        typeof row[field] === "string" ? ctx.db.normalizeId("closetItems", row[field]) : null;
      if (id && (await ownedParent(ctx, id, actor))) return true;
    } else if (await ownedParent(ctx, row[field], actor)) return true;
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
  userId?: Id<"users">
) {
  const patch: Record<string, unknown> = {};
  if (table === "builds" && (await ownedParent(ctx, row.groupId, actor))) patch.groupId = undefined;
  if (table === "cosplayNodes") {
    for (const field of ["buildId", "parentNodeId"])
      if (await ownedParent(ctx, row[field], actor)) patch[field] = undefined;
  }
  if (table === "workflowItems") {
    for (const field of ["creatorUserId", "ownerUserId", "assigneeUserId"])
      if (row[field] === actor) patch[field] = undefined;
    if (await ownedParent(ctx, row.parentId, actor)) patch.parentId = undefined;
    const ancestors = row.ancestorIds as Id<"workflowItems">[];
    const retained = [];
    for (const id of ancestors) if (!(await ownedParent(ctx, id, actor))) retained.push(id);
    if (retained.length !== ancestors.length) patch.ancestorIds = retained;
    if (await ownedParent(ctx, row.templateId, actor)) patch.templateId = undefined;
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
  if (Object.keys(patch).length) await ctx.db.patch(row._id, patch);
}

/** One atomic checkpoint. A failed transaction leaves both data and cursor unchanged. */
export async function stepDeletion(
  ctx: MutationCtx,
  jobId: Id<"accountDeletionJobs">,
  revision?: number
) {
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
  const table = DELETION_TABLES[job.phase];
  if (table) {
    const page = await ctx.db.query(table).paginate({
      cursor: job.cursor ?? null,
      numItems: DELETION_BATCH_SIZE,
    });
    const detachPass =
      (table === "workflowItems" || table === "cosplayNodes" || table === "builds") &&
      job.phase === DELETION_TABLES.indexOf(table);
    for (const doc of page.page) {
      const row = doc as Row;
      if (!detachPass && (await shouldRemove(ctx, table, row, job))) {
        await queueAssets(ctx, jobId, row);
        await ctx.db.delete(row._id);
      } else if (row.userId !== job.externalId) {
        await detachRetainedRow(ctx, table, row, job.externalId, job.userId);
      }
    }
    await ctx.db.patch(jobId, {
      phase: page.isDone ? job.phase + 1 : job.phase,
      cursor: page.isDone ? undefined : page.continueCursor,
      processed: job.processed + page.page.length,
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
    scheduledId: undefined,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });
}
