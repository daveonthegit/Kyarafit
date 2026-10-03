import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { canUserEditBuild, isGroupMember } from "./buildAccess";
import { entityKey, parentAncestorIds } from "./workflowDomain";
import {
  WORKFLOW_ATTACHMENT_ROLES,
  WORKFLOW_CATEGORIES,
  WORKFLOW_DEPENDENCY_KINDS,
  WORKFLOW_ENTITY_TYPES,
  WORKFLOW_ITEM_KINDS,
  WORKFLOW_SCOPE_KINDS,
  WORKFLOW_SOURCE_KINDS,
  WORKFLOW_STATUSES,
} from "./workflowProgress";
import { MAX_LENGTH, sanitizeString, sanitizeOptionalUrl, validateDateString } from "./validation";
import type { LocalFirstTable } from "../tierTransition";

// Matches the installed web/mobile backfill chunk size. Limits apply before dedupe, including
// ignored metadata, so retries cannot hide an unbounded or malformed request.
export const BACKFILL_MAX_ROWS = 100;
export const BACKFILL_MAX_ROW_BYTES = 32 * 1024;
export const BACKFILL_MAX_BATCH_BYTES = 512 * 1024;
const MAX_ARRAY = 100;

type Check = (value: unknown, field: string) => unknown;
type Shape = Record<string, Check>;
export type BackfillRow = Record<string, unknown> & { clientId: string };

function invalid(field: string): never {
  throw new Error(`Invalid backfill field: ${field}`);
}
function text(max: number): Check {
  return (value, field) => {
    if (typeof value !== "string" || value.length > max) invalid(field);
    return sanitizeString(value);
  };
}
function number(min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): Check {
  return (value, field) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
      invalid(field);
    return value;
  };
}
const boolean: Check = (value, field) => {
  if (typeof value !== "boolean") invalid(field);
  return value;
};
const id = text(256);
const name = text(MAX_LENGTH.name);
const notes = text(MAX_LENGTH.notes);
const status = text(MAX_LENGTH.status);
const date: Check = (value, field) => validateDateString(text(20)(value, field) as string, field);
const url: Check = (value, field) =>
  sanitizeOptionalUrl(text(MAX_LENGTH.url)(value, field) as string);
const percent = number(0, 100);
const cost = number(0);
function choices(values: readonly string[]): Check {
  return (value, field) => {
    if (typeof value !== "string" || !values.includes(value)) invalid(field);
    return value;
  };
}
function array(check: Check, max = MAX_ARRAY): Check {
  return (value, field) => {
    if (!Array.isArray(value) || value.length > max) invalid(field);
    return value.map((entry, index) => check(entry, `${field}[${index}]`));
  };
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
  return value as Record<string, unknown>;
}
function nested(shape: Shape, required: readonly string[] = []): Check {
  return (value, field) => {
    const input = object(value, field);
    for (const key of Object.keys(input))
      if (!Object.prototype.hasOwnProperty.call(shape, key)) invalid(`${field}.${key}`);
    for (const key of required) if (input[key] === undefined) invalid(`${field}.${key}`);
    return Object.fromEntries(
      Object.entries(input).map(([key, entry]) => [key, shape[key](entry, `${field}.${key}`)])
    );
  };
}
const imageRef: Check = (value, field) => {
  const input = object(value, field);
  if (input.kind === "url")
    return nested({ kind: choices(["url"]), url }, ["kind", "url"])(value, field);
  if (input.kind === "local")
    return nested({ kind: choices(["local"]), uri: text(2048), imageKey: id }, [
      "kind",
      "uri",
      "imageKey",
    ])(value, field);
  if (input.kind === "cloud")
    return nested({ kind: choices(["cloud"]), storageId: id, imageKey: id }, [
      "kind",
      "storageId",
      "imageKey",
    ])(value, field);
  return invalid(field);
};
const image = { imageUrl: url, imageStorageId: id };
const buildLink = { buildId: id };
const nodeLink = { cosplayNodeId: id, closetItemId: id };
const shapes: Record<LocalFirstTable, { fields: Shape; required: string[] }> = {
  builds: {
    fields: {
      name,
      character: text(MAX_LENGTH.character),
      status: choices(["idea", "wip", "ready", "archived"]),
      notes,
      ...image,
      imageFocalX: number(0, 1),
      imageFocalY: number(0, 1),
      budgetCents: cost,
      targetDate: date,
      manualProgressPercent: percent,
      visibility: choices(["private", "public", "unlisted"]),
      shareToken: id,
      groupId: id,
      publicViewerSettings: nested({
        showExplorer: boolean,
        showTasks: boolean,
        showVisualBoard: boolean,
        showSummary: boolean,
        showNotes: boolean,
        showCollaborators: boolean,
      }),
    },
    required: ["name", "status"],
  },
  cosplayNodes: {
    fields: {
      legacyClosetItemId: id,
      ...buildLink,
      parentNodeId: id,
      sortOrder: number(),
      nodeType: choices(["element", "material"]),
      name,
      category: text(MAX_LENGTH.category),
      tags: array(text(MAX_LENGTH.tag)),
      notes,
      ...image,
      sourceUrl: url,
      pricingMode: status,
      directCostCents: cost,
      unitCostCents: cost,
      quantity: number(0),
      unit: status,
      purchaseStatus: status,
      buildStatus: status,
      materialStatus: status,
      manualOverallBucket: status,
      buildInstructions: notes,
      finishedPhotoUrls: array(url),
      consumable: boolean,
    },
    required: ["nodeType", "name", "tags"],
  },
  buildTasks: {
    fields: {
      ...buildLink,
      ...nodeLink,
      packingListItemId: id,
      label: text(MAX_LENGTH.label),
      sortOrder: number(),
      checked: boolean,
      dueDate: date,
    },
    required: ["label", "sortOrder", "checked"],
  },
  workflowItems: {
    fields: {
      title: text(MAX_LENGTH.label),
      notes,
      kind: choices(WORKFLOW_ITEM_KINDS),
      category: choices(WORKFLOW_CATEGORIES),
      status: choices(WORKFLOW_STATUSES),
      parentId: id,
      ancestorIds: array(id),
      sortOrder: number(),
      scopeKind: choices(WORKFLOW_SCOPE_KINDS),
      sourceKind: choices(WORKFLOW_SOURCE_KINDS),
      priority: number(),
      startDate: date,
      targetDate: date,
      dueDate: date,
      reminders: array(nested({ kind: status, date }, ["kind", "date"])),
      weight: number(0),
      manualProgressPercent: percent,
      estimatedMinutes: number(0),
      actualMinutes: number(0),
      estimatedCostCents: cost,
      actualCostCents: cost,
      creatorUserId: id,
      ownerUserId: id,
      assigneeUserId: id,
      templateId: id,
      recurrenceRule: text(500),
      legacyBuildTaskId: id,
      dedupeKey: text(500),
    },
    required: ["title", "kind", "category", "status", "sortOrder", "scopeKind", "sourceKind"],
  },
  workflowAttachments: {
    fields: {
      workflowItemId: id,
      entityType: choices(WORKFLOW_ENTITY_TYPES),
      entityId: id,
      entityKey: text(512),
      role: choices(WORKFLOW_ATTACHMENT_ROLES),
      buildContextId: id,
      progressWeight: number(0),
    },
    required: ["workflowItemId", "entityType", "entityId", "role"],
  },
  workflowDependencies: {
    fields: {
      predecessorWorkflowItemId: id,
      successorWorkflowItemId: id,
      relationKind: choices(WORKFLOW_DEPENDENCY_KINDS),
    },
    required: ["predecessorWorkflowItemId", "successorWorkflowItemId", "relationKind"],
  },
  conventions: {
    fields: {
      name,
      location: text(MAX_LENGTH.location),
      ...image,
      startDate: date,
      endDate: date,
      archived: boolean,
    },
    required: ["name", "startDate", "endDate"],
  },
  conventionDayPlans: {
    fields: { conventionId: id, date, ...buildLink, notes },
    required: ["conventionId", "date"],
  },
  packingListItems: {
    fields: {
      conventionId: id,
      date,
      ...buildLink,
      ...nodeLink,
      workflowItemId: id,
      entryKind: status,
      sourceKind: status,
      label: text(MAX_LENGTH.label),
      notes,
      checked: boolean,
      sortOrder: number(),
    },
    required: ["conventionId", "label", "checked"],
  },
  buildReferenceImages: {
    fields: { ...buildLink, ...image, sortOrder: number() },
    required: ["buildId", "sortOrder"],
  },
  buildProcessPictures: {
    fields: { ...buildLink, ...image, sortOrder: number() },
    required: ["buildId", "sortOrder"],
  },
  buildProgressUpdates: {
    fields: {
      ...buildLink,
      createdAt: number(0),
      note: notes,
      imageRefs: array(imageRef, 20),
      progressPercent: percent,
      publishedToFeed: boolean,
    },
    required: ["buildId", "createdAt", "imageRefs", "publishedToFeed"],
  },
};
const envelope = new Set([
  "_id",
  "_creationTime",
  "userId",
  "version",
  "updatedAt",
  "fieldUpdatedAt",
  "deletedAt",
  "clientId",
]);

/** Validate the entire batch, not only new clientIds; project onto explicitly accepted fields. */
export function validateBackfillBatch(table: LocalFirstTable, rows: unknown[]): BackfillRow[] {
  if (rows.length > BACKFILL_MAX_ROWS) throw new Error("Backfill chunk exceeds 100 rows");
  if (new TextEncoder().encode(JSON.stringify(rows)).length > BACKFILL_MAX_BATCH_BYTES)
    throw new Error("Backfill chunk exceeds byte limit");
  const { fields, required } = shapes[table];
  const result: BackfillRow[] = [];
  for (const value of rows) {
    const input = object(value, table);
    if (new TextEncoder().encode(JSON.stringify(input)).length > BACKFILL_MAX_ROW_BYTES)
      throw new Error("Backfill row exceeds byte limit");
    for (const key of Object.keys(input))
      if (!envelope.has(key) && !Object.prototype.hasOwnProperty.call(fields, key)) invalid(key);
    // Missing clientIds retain the deployed skip contract; malformed ids never silently skip.
    if (input.clientId === undefined) continue;
    if (typeof input.clientId !== "string" || !input.clientId.length || input.clientId.length > 256)
      invalid("clientId");
    for (const key of required) if (input[key] === undefined) invalid(key);
    const row: BackfillRow = { clientId: input.clientId };
    for (const [key, check] of Object.entries(fields))
      if (input[key] !== undefined) row[key] = check(input[key], key);
    result.push(row);
  }
  return result;
}

export type ResolveBackfillId = (table: TableNames, value: string) => Promise<string>;

/** Resolve either a real server id or a previously backfilled, actor-scoped clientId. */
export async function resolveBackfillId(
  ctx: MutationCtx,
  table: TableNames,
  value: string,
  actor: string
): Promise<string> {
  const serverId = ctx.db.normalizeId(table, value);
  const doc = serverId ? await ctx.db.get(serverId) : null;
  if (doc) {
    // A valid server id must never fall back to a same-spelled client id when unauthorized.
    if ("deletedAt" in doc && doc.deletedAt !== undefined)
      throw new Error("Unavailable backfill relationship");
    if (table === "builds" && (await canUserEditBuild(ctx, serverId as Id<"builds">, actor)))
      return doc._id;
    if (table === "groups" && (await isGroupMember(ctx, serverId as Id<"groups">, actor)))
      return doc._id;
    if ("userId" in doc && doc.userId === actor) return doc._id;
    if (table === "workflowTemplates" && "isBuiltIn" in doc && doc.isBuiltIn) return doc._id;
    throw new Error("Unauthorized backfill relationship");
  }
  if (table === "groups" || table === "workflowTemplates")
    throw new Error("Unavailable backfill relationship");
  // All local-first tables have by_userId, including attachments/dependencies which do not yet
  // have a by_userId_clientId index. Use the actor index; never scan other tenants for a fallback.
  const matches = await ctx.db
    .query(table as LocalFirstTable)
    .withIndex("by_userId", (q) => q.eq("userId", actor))
    .filter((q) => q.eq(q.field("clientId"), value))
    .take(2);
  if (matches.length !== 1 || matches[0].deletedAt !== undefined)
    throw new Error("Unavailable backfill relationship");
  return matches[0]._id;
}

/** Relationship checks and server-derived fields, executed before any row is committed. */
export async function prepareBackfillRow(
  ctx: MutationCtx,
  table: LocalFirstTable,
  input: BackfillRow,
  actor: string,
  resolve: ResolveBackfillId = (target, value) => resolveBackfillId(ctx, target, value, actor)
): Promise<BackfillRow> {
  const row = { ...input };
  const links: Record<string, TableNames> = {
    buildId: "builds",
    buildContextId: "builds",
    parentNodeId: "cosplayNodes",
    cosplayNodeId: "cosplayNodes",
    packingListItemId: "packingListItems",
    conventionId: "conventions",
    workflowItemId: "workflowItems",
    parentId: "workflowItems",
    predecessorWorkflowItemId: "workflowItems",
    successorWorkflowItemId: "workflowItems",
    templateId: "workflowTemplates",
    legacyBuildTaskId: "buildTasks",
    groupId: "groups",
  };
  for (const [field, target] of Object.entries(links))
    if (typeof row[field] === "string") row[field] = await resolve(target, row[field]);
  // Retired pointers cannot recreate retired relationships.
  delete row.legacyClosetItemId;
  delete row.closetItemId;
  if (table === "builds") {
    // Backfill is a private mirror, not a publish/share operation. Publication uses normal APIs.
    row.visibility = "private";
    delete row.shareToken;
    delete row.groupId;
  }
  if (table === "workflowItems") {
    // Rebuild from actual parents rather than trusting either client or persisted ancestor caches.
    const ancestors: Id<"workflowItems">[] = [];
    const seen = new Set<string>();
    let parentId = row.parentId as Id<"workflowItems"> | undefined;
    while (parentId) {
      if (seen.has(parentId) || seen.size >= MAX_ARRAY)
        throw new Error("Invalid backfill hierarchy");
      seen.add(parentId);
      await resolveBackfillId(ctx, "workflowItems", parentId, actor);
      const parent: Doc<"workflowItems"> | null = await ctx.db.get(parentId);
      if (!parent) throw new Error("Unavailable backfill relationship");
      ancestors.unshift(parentId);
      parentId = parent.parentId;
    }
    row.ancestorIds = parentAncestorIds(
      row.parentId
        ? { _id: row.parentId as Id<"workflowItems">, ancestorIds: ancestors.slice(0, -1) }
        : null
    );
    row.creatorUserId = actor;
    row.ownerUserId = actor;
    if (row.assigneeUserId !== undefined) row.assigneeUserId = actor;
  }
  if (table === "workflowAttachments") {
    const targets: Record<string, TableNames> = {
      build: "builds",
      cosplayNode: "cosplayNodes",
      convention: "conventions",
      packingItem: "packingListItems",
    };
    const type = row.entityType as string;
    if (type === "plannerBucket") {
      // Planner buckets are opaque non-row keys; there is no resource to authorize.
      row.entityId = id(row.entityId, "plannerBucket");
    } else row.entityId = await resolve(targets[type], row.entityId as string);
    row.entityKey = entityKey(type as Parameters<typeof entityKey>[0], row.entityId as string);
  }
  if (
    table === "workflowDependencies" &&
    row.predecessorWorkflowItemId === row.successorWorkflowItemId
  )
    throw new Error("Backfill dependency cannot reference itself");
  if (table === "buildProgressUpdates") row.publishedToFeed = false;
  assertBackfillMediaReady(row);
  return row;
}

/**
 * S4 INTEGRATION SEAM: replace with the shared storage-claim/ownership/size/quota helper once its
 * contract lands. It must validate actual storage ownership and charge only newly inserted rows,
 * atomically, with clientId retries/multi-reference dedupe. Do not infer upload ownership from
 * read access or use the current attach-only usage helper here. Until then fail closed for cloud
 * media; external URL and local ImageRefs remain valid private-mirror data.
 */
function assertBackfillMediaReady(row: BackfillRow): void {
  const refs = (row.imageRefs ?? []) as Array<{ kind: string }>;
  if (row.imageStorageId !== undefined || refs.some((ref) => ref.kind === "cloud"))
    throw new Error("Cloud media backfill awaits storage ownership and quota validation");
}
