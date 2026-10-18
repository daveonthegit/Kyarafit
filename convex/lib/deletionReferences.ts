import {
  convexToJson,
  type GenericValidator,
  type ValidatorJSON,
  type RecordKeyValidatorJSON,
} from "convex/values";
import type { TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

export type Reference =
  { kind: "subject"; value: string } | { kind: "resource"; table: TableNames; value: string };
export type Row = Record<string, unknown>;
// Epoch validity is the complete proof; this bounded owner-key sample is diagnostic only.
export const PROOF_SUBJECT_LIMIT = 128;

/** All app tables must explicitly declare ownership; typed IDs come from the real schema. */
export const ownership = {
  users: ["externalId"],
  cosplayNodes: ["userId"],
  closetItems: ["userId"],
  cosplayNodeLinks: ["userId", "parentNodeId", "childNodeId"],
  buildCosplayLinks: ["userId", "buildId", "cosplayNodeId"],
  buildNodeStates: ["userId", "buildId", "cosplayNodeId"],
  buildItemLinks: ["userId", "buildId", "closetItemId"],
  builds: ["userId"],
  buildTasks: ["userId", "buildId", "cosplayNodeId", "packingListItemId"],
  workflowItems: ["userId", "scopeId"],
  workflowAttachments: ["userId", "workflowItemId", "buildContextId", "entityId"],
  workflowDependencies: ["userId", "predecessorWorkflowItemId", "successorWorkflowItemId"],
  workflowTemplates: ["userId"],
  workflowTemplateItems: ["templateId"],
  conventions: ["userId"],
  conventionDayPlans: ["userId", "conventionId", "buildId"],
  packingListItems: ["userId", "conventionId", "buildId", "cosplayNodeId", "workflowItemId"],
  buildReferenceImages: ["userId", "buildId"],
  buildProcessPictures: ["userId", "buildId"],
  buildProgressUpdates: ["userId", "buildId"],
  progressMediaReferences: ["progressUpdateId"],
  groups: ["createdBy"],
  groupMembers: ["userId", "groupId"],
  groupConventionDays: ["groupId", "conventionId"],
  follows: ["followerId", "followingId"],
  buildLikes: ["userId", "buildId"],
  buildComments: ["userId", "buildId"],
  buildCollaborators: ["userId", "buildId"],
  activities: ["userId", "buildId", "groupId"],
  idempotencyLedger: ["userId"],
  broadcasts: ["createdBy"],
  userPushPreferences: ["userId"],
  storageUploadReservations: ["userId"],
  storageClaims: ["userId"],
  accountDeletionJobs: [],
  accountDeletionAssets: [],
  storageReferenceEpochs: [],
  accountDeletionState: [],
  ledgerValidationState: [],
} as const satisfies Record<TableNames, readonly string[]>;

export const controlTables = new Set<TableNames>([
  "accountDeletionJobs",
  "accountDeletionAssets",
  "accountDeletionState",
  "storageReferenceEpochs",
  "ledgerValidationState",
]);
const subjects = new Set([
  "externalId",
  "userId",
  "createdBy",
  "followerId",
  "followingId",
  "creatorUserId",
  "ownerUserId",
  "assigneeUserId",
  "newUserId",
  "targetUserId",
  "removeUserId",
]);
const argumentSubjects = new Set([
  "followingId",
  "newUserId",
  "targetUserId",
  "removeUserId",
  "ownerUserId",
  "assigneeUserId",
]);
const plainStrings = new Set([
  "clientId",
  "name",
  "email",
  "image",
  "tier",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "subscriptionStatus",
  "subscriptionCurrentPeriodEnd",
  "tierSource",
  "username",
  "displayName",
  "bio",
  "profileVisibility",
  "role",
  "legacyClosetItemId",
  "nodeType",
  "category",
  "tags",
  "notes",
  "imageUrl",
  "sourceUrl",
  "pricingMode",
  "unit",
  "purchaseStatus",
  "buildStatus",
  "materialStatus",
  "manualOverallBucket",
  "buildInstructions",
  "finishedPhotoUrls",
  "itemLink",
  "status",
  "character",
  "targetDate",
  "visibility",
  "shareToken",
  "label",
  "dueDate",
  "title",
  "purchasedAt",
  "startedAt",
  "completedAt",
  "attachmentRole",
  "location",
  "endDate",
  "entryKind",
  "kind",
  "scopeKind",
  "sourceKind",
  "startDate",
  "date",
  "recurrenceRule",
  "dedupeKey",
  "slug",
  "description",
  "templateItemKey",
  "parentTemplateItemKey",
  "linkMode",
  "relationKind",
  "entityType",
  "entityId",
  "entityKey",
  "note",
  "uri",
  "imageKey",
  "url",
  "key",
  "operation",
  "body",
  "deepLink",
  "audience",
  "expoPushToken",
  "token",
  "uploadTag",
  "revision",
  "subjectHash",
  "cursor",
  "assetRowId",
  "resultRevision",
  "ledgerResultRevision",
  "ledgerCursor",
  "subjectHashes",
  "validatedEpoch",
  "generation",
  "validationCursor",
  "ledgerSubjects",
]);
const returnFields = new Set([
  "ok",
  "success",
  "inserted",
  "skipped",
  "total",
  "cloudCount",
  "processed",
  "count",
  "deleted",
  "created",
  "updated",
  "removed",
  "items",
  "nodes",
  "build",
  "builds",
  "tasks",
  "references",
  "pictures",
  "result",
  "ids",
  "mapping",
  "idMap",
  "workflowItems",
  "attachments",
]);
/** Normalize Convex's public validator objects into the semantic schema model. */
export function validatorShape(validator: GenericValidator): ValidatorJSON {
  switch (validator.kind) {
    case "id":
      return { type: "id", tableName: validator.tableName };
    case "object":
      return {
        type: "object",
        value: Object.fromEntries(
          Object.entries(validator.fields as Record<string, GenericValidator>).map(
            ([key, field]) => [
              key,
              { fieldType: validatorShape(field), optional: field.isOptional === "optional" },
            ]
          )
        ),
      };
    case "array":
      return { type: "array", value: validatorShape(validator.element) };
    case "union":
      return { type: "union", value: validator.members.map(validatorShape) };
    case "literal":
      return { type: "literal", value: convexToJson(validator.value) };
    case "record":
      return {
        type: "record",
        keys: validatorShape(validator.key) as RecordKeyValidatorJSON,
        values: { fieldType: validatorShape(validator.value), optional: false },
      };
    case "float64":
      return { type: "number" };
    case "int64":
      return { type: "bigint" };
    default:
      return { type: validator.kind };
  }
}
const resourceFields = new Set<string>(["scopeId", "id"]);
const resultKeys = new Set<string>(["_id", "_creationTime", ...returnFields]);
function declareResultKeys(validator: ValidatorJSON) {
  if (validator.type === "object")
    for (const [key, field] of Object.entries(validator.value)) {
      resultKeys.add(key);
      declareResultKeys(field.fieldType);
    }
  if (validator.type === "array") declareResultKeys(validator.value);
  if (validator.type === "union") validator.value.forEach(declareResultKeys);
}
for (const table of Object.values(schema.tables)) {
  declareResultKeys(validatorShape(table.validator));
  for (const [field, validator] of Object.entries(table.validator.fields)) {
    if (containsId(validatorShape(validator))) resourceFields.add(field);
  }
}
function containsId(validator: ValidatorJSON): boolean {
  if (validator.type === "id") return true;
  if (validator.type === "array") return containsId(validator.value);
  if (validator.type === "union") return validator.value.some(containsId);
  if (validator.type === "record")
    return containsId(validator.keys) || containsId(validator.values.fieldType);
  if (validator.type === "object")
    return Object.values(validator.value).some((v) => containsId(v.fieldType));
  return false;
}

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
export async function deletionEpoch(ctx: QueryCtx) {
  return (await ctx.db.query("accountDeletionState").first())?.generation ?? 0;
}

export function resourceReference(ctx: QueryCtx, value: string): Reference | undefined {
  for (const table of Object.keys(ownership) as TableNames[]) {
    if (controlTables.has(table)) continue;
    if (ctx.db.normalizeId(table, value)) return { kind: "resource", table, value };
  }
}
function subjectReference(ctx: QueryCtx, value: string): Reference {
  const userId = ctx.db.normalizeId("users", value);
  return userId ? { kind: "resource", table: "users", value } : { kind: "subject", value };
}

function matches(validator: ValidatorJSON, value: unknown): boolean {
  if (validator.type === "literal") return value === validator.value;
  if (validator.type === "null") return value === null;
  if (validator.type === "id" || validator.type === "string") return typeof value === "string";
  if (validator.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const row = value as Row;
    return Object.entries(validator.value).every(
      ([key, field]) =>
        (field.optional && row[key] === undefined) || matches(field.fieldType, row[key])
    );
  }
  if (validator.type === "array") return Array.isArray(value);
  if (validator.type === "union") return validator.value.some((v) => matches(v, value));
  if (validator.type === "any") return true;
  if (validator.type === "number" || validator.type === "boolean")
    return typeof value === validator.type;
  return true;
}

/** Traverse the schema's semantic validator model, not source text or field-name guesses. */
export function schemaReferences(
  ctx: QueryCtx,
  validator: ValidatorJSON,
  value: unknown,
  opaque?: Set<string>,
  path: string[] = []
): Reference[] {
  if (value == null) return [];
  if (validator.type === "any" && opaque && !opaque.has(path.join(".")))
    throw new Error("Unknown reference shape");
  if (validator.type === "id") {
    if (validator.tableName.startsWith("_")) return [];
    if (!(validator.tableName in ownership) || typeof value !== "string")
      throw new Error("Unknown reference shape");
    return [{ kind: "resource", table: validator.tableName as TableNames, value }];
  }
  if (validator.type === "union") {
    const member = validator.value.find((v) => matches(v, value));
    if (!member) throw new Error("Unknown reference shape");
    return schemaReferences(ctx, member, value, opaque, path);
  }
  if (validator.type === "array") {
    if (!Array.isArray(value)) throw new Error("Unknown reference shape");
    return value.flatMap((v) => schemaReferences(ctx, validator.value, v, opaque, [...path, "[]"]));
  }
  if (validator.type === "object") {
    if (typeof value !== "object" || Array.isArray(value))
      throw new Error("Unknown reference shape");
    const refs: Reference[] = [];
    for (const [key, child] of Object.entries(value)) {
      if (key === "_id" || key === "_creationTime") continue;
      const field = validator.value[key];
      if (!field) throw new Error("Unknown reference shape");
      refs.push(...schemaReferences(ctx, field.fieldType, child, opaque, [...path, key]));
    }
    return refs;
  }
  if (validator.type === "record") {
    if (typeof value !== "object" || Array.isArray(value))
      throw new Error("Unknown reference shape");
    return Object.entries(value).flatMap(([key, child]) => [
      ...schemaReferences(ctx, validator.keys, key, opaque, [...path, "$key"]),
      ...schemaReferences(ctx, validator.values.fieldType, child, opaque, [...path, "$value"]),
    ]);
  }
  return [];
}

export function hasSyncMeta(table: TableNames): boolean {
  return "version" in schema.tables[table].validator.fields;
}
export function documentReferences(ctx: QueryCtx, table: TableNames, row: Row): Reference[] {
  if (!(table in ownership)) throw new Error("Unknown reference shape");
  if (table === "workflowTemplates" && row.userId == null && row.isBuiltIn !== true)
    throw new Error("Unknown reference shape");
  const opaque = new Set(
    table === "idempotencyLedger" ? ["result"] : table === "broadcasts" ? ["audienceArgs"] : []
  );
  const refs = schemaReferences(ctx, validatorShape(schema.tables[table].validator), row, opaque);
  for (const [field, value] of Object.entries(row)) {
    if (table === "idempotencyLedger" && field === "result") continue;
    if (subjects.has(field) && value != null && typeof value !== "string")
      throw new Error("Unknown reference shape");
    if (typeof value === "string" && subjects.has(field)) {
      const v = (schema.tables[table].validator.fields as Record<string, GenericValidator>)[field];
      if (!v || !containsId(validatorShape(v))) refs.push(subjectReference(ctx, value));
    } else if (
      typeof value === "string" &&
      !plainStrings.has(field) &&
      !resourceFields.has(field) &&
      !field.startsWith("_")
    ) {
      throw new Error("Unknown reference shape");
    }
  }
  if (typeof row.closetItemId === "string") {
    const id = ctx.db.normalizeId("closetItems", row.closetItemId);
    if (id) refs.push({ kind: "resource", table: "closetItems", value: id });
  }
  if (table === "workflowItems" && row.scopeId !== undefined) {
    if (row.scopeKind !== "build_specific" || typeof row.scopeId !== "string")
      throw new Error("Unknown reference shape");
    refs.push({ kind: "resource", table: "builds", value: row.scopeId });
  }
  if (table === "workflowAttachments") {
    const targets: Record<string, TableNames> = {
      build: "builds",
      cosplayNode: "cosplayNodes",
      convention: "conventions",
      packingItem: "packingListItems",
    };
    const target = typeof row.entityType === "string" ? targets[row.entityType] : undefined;
    if (row.entityType === "plannerBucket" && typeof row.entityId === "string") {
      // A declared virtual planner bucket is scoped by this row's user, not a database resource.
    } else {
      if (!target || typeof row.entityId !== "string") throw new Error("Unknown reference shape");
      const id = ctx.db.normalizeId(target, row.entityId);
      if (!id) throw new Error("Unknown reference shape");
      refs.push({ kind: "resource", table: target, value: id });
    }
  }
  if (table === "broadcasts" && row.audienceArgs !== undefined) {
    const args = row.audienceArgs;
    if (
      row.audience !== "userIds" ||
      !args ||
      typeof args !== "object" ||
      Array.isArray(args) ||
      Object.keys(args).some((key) => key !== "userIds") ||
      !Array.isArray((args as Row).userIds)
    )
      throw new Error("Unknown reference shape");
    for (const id of (args as { userIds: unknown[] }).userIds) {
      if (typeof id !== "string") throw new Error("Unknown reference shape");
      refs.push(subjectReference(ctx, id));
    }
  }
  return refs;
}

export function argumentReferences(
  ctx: QueryCtx,
  validator: ValidatorJSON | undefined,
  args: Row
): Reference[] {
  const refs = validator ? schemaReferences(ctx, validator, args) : [];
  for (const [field, value] of Object.entries(args)) {
    // Optional legacy actor arguments are intentionally ignored. Required userId names a grantee.
    const requiredUser =
      ["userId", "externalId", "ownerId", "followerId"].includes(field) &&
      validator?.type === "object" &&
      validator.value[field]?.optional === false;
    if ((argumentSubjects.has(field) || requiredUser) && typeof value === "string")
      refs.push(subjectReference(ctx, value));
  }
  return refs;
}

export function ownerReferences(ctx: QueryCtx, table: TableNames, row: Row): Reference[] {
  const all = documentReferences(ctx, table, row);
  // Resources whose ownership is inherited can have multiple owning parents. Direct owner strings
  // are checked without walking unrelated fields such as another user's optional assignee.
  const result: Reference[] = [];
  for (const field of ownership[table]) {
    const value = row[field];
    if (value == null) continue;
    if (typeof value !== "string") throw new Error("Unknown reference shape");
    result.push(...all.filter((ref) => ref.value === value));
  }
  return result;
}

export type LedgerFrame = { path: Array<string | number>; next: number };
export type LedgerWalk = {
  frames: LedgerFrame[];
  // Ownership traversal stores payload paths and owner indices, never copied payload values.
  owners?: { path: Array<string | number>; frames: Array<{ next: number }> };
};
export function initialLedgerWalk(): LedgerWalk {
  return { frames: [{ path: [], next: -1 }] };
}
function atPath(root: unknown, path: Array<string | number>): unknown {
  let value = root;
  for (const key of path) {
    if (!value || typeof value !== "object") throw new Error("Unknown reference shape");
    value = (value as Row)[key];
  }
  return value;
}

/** One iterative traversal node; the cursor stores paths/counters only, never payload values. */
export function nextLedgerNode(
  ctx: QueryCtx,
  root: unknown,
  walk: LedgerWalk
): { ref?: Reference; path?: Array<string | number>; done: boolean } {
  while (walk.frames.length) {
    const frame = walk.frames[walk.frames.length - 1];
    const value = atPath(root, frame.path);
    if (frame.next === -1) {
      frame.next = 0;
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !(value instanceof ArrayBuffer)
      ) {
        if (Object.keys(value).some((key) => !resultKeys.has(key)))
          throw new Error("Unknown reference shape");
      }
      if (typeof value === "string") {
        walk.frames.pop();
        const field = [...frame.path].reverse().find((p) => typeof p === "string") as
          string | undefined;
        if (!field) return { ref: resourceReference(ctx, value), path: frame.path, done: false };
        if (
          field === "entityId" &&
          (atPath(root, frame.path.slice(0, -1)) as Row)?.entityType === "plannerBucket"
        )
          return { done: false };
        if (field && (subjects.has(field) || field === "userIds"))
          return { ref: subjectReference(ctx, value), path: frame.path, done: false };
        if (field && (resourceFields.has(field) || field === "_id" || field === "entityId")) {
          if (ctx.db.system.normalizeId("_storage", value)) return { done: false };
          const ref = resourceReference(ctx, value);
          if (!ref && field !== "closetItemId") throw new Error("Account unavailable");
          return { ref, path: frame.path, done: false };
        }
        if (field && returnFields.has(field))
          return { ref: resourceReference(ctx, value), path: frame.path, done: false };
        if (field && !plainStrings.has(field)) throw new Error("Unknown reference shape");
        return { done: false };
      }
      if (!value || typeof value !== "object" || value instanceof ArrayBuffer) {
        walk.frames.pop();
        return { done: false };
      }
    }
    const keys = Array.isArray(value) ? value.map((_, i) => i) : Object.keys(value as Row);
    if (frame.next >= keys.length) {
      walk.frames.pop();
      continue;
    }
    const key = keys[frame.next++];
    // Metadata maps and opaque prose do not contain declared ownership references.
    if (key === "_creationTime" || key === "fieldUpdatedAt") return { done: false };
    walk.frames.push({ path: [...frame.path, key], next: -1 });
    return { done: false };
  }
  return { done: true };
}
