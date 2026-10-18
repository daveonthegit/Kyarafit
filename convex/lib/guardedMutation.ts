/* eslint-disable @typescript-eslint/no-explicit-any -- Preserve Convex's generic registration interface at this single adapter seam. */
import {
  mutationGeneric,
  internalMutationGeneric,
  type MutationBuilder,
  type RegisteredMutation,
  type DefaultFunctionArgs,
} from "convex/server";
import {
  asObjectValidator,
  type GenericValidator,
  type PropertyValidators,
  type ValidatorJSON,
} from "convex/values";
import type { DataModel, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  argumentReferences,
  controlTables,
  deletionEpoch,
  deletionSubjectHash,
  documentReferences,
  hasSyncMeta,
  initialLedgerWalk,
  nextLedgerNode,
  ownerReferences,
  ownership,
  PROOF_SUBJECT_LIMIT,
  validatorShape,
  type Reference,
  type Row,
} from "./deletionReferences";

export type GuardReads = {
  subjects: number;
  resources: number;
  preimages: number;
  epochs: number;
  mediaEpochs: number;
};
const states = new WeakMap<object, MutationGuard>();
const guardedRegistrations = new WeakSet<object>();
export function isGuardedMutation(value: unknown): boolean {
  return (
    ((typeof value === "object" && value !== null) || typeof value === "function") &&
    guardedRegistrations.has(value)
  );
}
const mediaTables = new Set<TableNames>([
  "users",
  "builds",
  "cosplayNodes",
  "closetItems",
  "groups",
  "conventions",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
  "progressMediaReferences",
]);
function storageIds(row: Row | null): Set<Id<"_storage">> {
  const ids = new Set<Id<"_storage">>();
  if (typeof row?.imageStorageId === "string") ids.add(row.imageStorageId as Id<"_storage">);
  if (typeof row?.storageId === "string") ids.add(row.storageId as Id<"_storage">);
  if (Array.isArray(row?.imageRefs))
    for (const ref of row.imageRefs)
      if (ref?.kind === "cloud" && typeof ref.storageId === "string") ids.add(ref.storageId);
  return ids;
}
function mediaShape(row: Row | null) {
  if (!row) return null;
  return JSON.stringify([
    [...storageIds(row)].sort(),
    row.deletedAt ?? null,
    row.mediaIndexed ?? null,
    row.userId ?? row.externalId ?? row.createdBy ?? null,
    row.progressUpdateId ?? null,
  ]);
}
function removesOnly(before: unknown, after: unknown): boolean {
  if (after === undefined || Object.is(before, after)) return true;
  if (Array.isArray(before) && Array.isArray(after)) {
    const counts = new Map<string, number>();
    for (const value of before) {
      const key = JSON.stringify(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const value of after) {
      const key = JSON.stringify(value);
      const count = counts.get(key) ?? 0;
      if (!count) return false;
      counts.set(key, count - 1);
    }
    return true;
  }
  if (before && after && typeof before === "object" && typeof after === "object")
    return Object.entries(after).every(([key, value]) => removesOnly((before as Row)[key], value));
  return false;
}
function cleanRow(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}
export class MutationGuard {
  readonly reads: GuardReads = {
    subjects: 0,
    resources: 0,
    preimages: 0,
    epochs: 0,
    mediaEpochs: 0,
  };
  readonly subjectCache = new Map<string, Promise<string>>();
  readonly resourceCache = new Map<string, Promise<string[]>>();
  private epoch?: number;
  actingSubject?: string;
  private touchedMedia = new Set<string>();
  invalidate() {
    this.subjectCache.clear();
    this.resourceCache.clear();
    this.touchedMedia.clear();
    this.epoch = undefined;
  }
  constructor(
    readonly raw: MutationCtx,
    readonly cleanup = false
  ) {}
  private budget() {
    if (Object.values(this.reads).reduce((a, b) => a + b, 0) >= 4096)
      throw new Error("Reference budget exceeded; split the write");
  }
  async subject(subject: string): Promise<string> {
    let checked = this.subjectCache.get(subject);
    if (!checked) {
      checked = (async () => {
        const hash = await deletionSubjectHash(subject);
        this.budget();
        this.reads.subjects++;
        const job = await this.raw.db
          .query("accountDeletionJobs")
          .withIndex("by_subjectHash", (q) => q.eq("subjectHash", hash))
          .unique();
        if (job) throw new Error("Account unavailable");
        return hash;
      })();
      this.subjectCache.set(subject, checked);
    }
    return checked;
  }
  async reference(ref: Reference, seen = new Set<string>()): Promise<string[]> {
    if (ref.kind === "subject") return [await this.subject(ref.value)];
    const key = `${ref.table}:${ref.value}`;
    if (seen.has(key)) throw new Error("Unknown reference shape");
    let checked = this.resourceCache.get(key);
    if (!checked) {
      const ancestors = new Set(seen).add(key);
      checked = (async () => {
        this.budget();
        this.reads.resources++;
        const row = await this.raw.db.get(ref.value as Id<TableNames>);
        if (!row) throw new Error("Account unavailable");
        const hashes: string[] = [];
        for (const owner of ownerReferences(this.raw, ref.table, row))
          hashes.push(...(await this.reference(owner, ancestors)));
        return [...new Set(hashes)];
      })();
      this.resourceCache.set(key, checked);
    }
    return checked;
  }
  async references(refs: Reference[]): Promise<string[]> {
    const hashes = new Set<string>();
    for (const ref of refs) for (const hash of await this.reference(ref)) hashes.add(hash);
    return [...hashes];
  }
  async currentEpoch() {
    if (this.epoch === undefined) {
      this.reads.epochs++;
      this.epoch = await deletionEpoch(this.raw);
    }
    return this.epoch;
  }
  async resultProof(result: unknown, maxNodes = 16384) {
    const walk = initialLedgerWalk();
    const hashes = new Set<string>();
    for (let i = 0; i < maxNodes; i++) {
      const node = nextLedgerNode(this.raw, result, walk);
      if (node.done)
        return { validatedEpoch: await this.currentEpoch(), subjectHashes: [...hashes] };
      if (node.ref)
        for (const hash of await this.reference(node.ref))
          if (hashes.size < PROOF_SUBJECT_LIMIT) hashes.add(hash);
    }
    throw new Error("Replay validation pending");
  }
  private tableFor(id: string): TableNames {
    for (const table of Object.keys(ownership) as TableNames[])
      if (this.raw.db.normalizeId(table, id)) return table;
    throw new Error("Unknown reference shape");
  }
  private async readRow(id: string) {
    this.budget();
    this.reads.preimages++;
    return this.raw.db.get(id as Id<TableNames>);
  }
  private async validate(table: TableNames, row: Row, previous: Row | null, changed: Row) {
    if (!this.cleanup && this.actingSubject) await this.subject(this.actingSubject);
    if (controlTables.has(table)) {
      if (!this.cleanup) throw new Error("Cleanup capability required");
      return row;
    }
    if (this.cleanup) {
      if (!previous) throw new Error("Cleanup can only remove application data");
      const metadata: Partial<Record<TableNames, string[]>> = {
        users: ["currentUsageMb", "cloudPurgedAt"],
        storageClaims: ["attached"],
        broadcasts: ["cancelledAt"],
        idempotencyLedger: ["validatedEpoch", "subjectHashes", "resultRevision", "replayBlocked"],
      };
      for (const [field, value] of Object.entries(changed)) {
        if (
          metadata[table]?.includes(field) ||
          (hasSyncMeta(table) && ["version", "updatedAt", "fieldUpdatedAt"].includes(field))
        )
          continue;
        if (table === "storageClaims" && field === "userId" && value !== previous.userId) {
          if (typeof value !== "string") throw new Error("Unknown reference shape");
          await this.subject(value); // Verified survivor attribution is the sole ownership-transfer exception.
        } else if (!removesOnly(previous[field], value))
          throw new Error("Cleanup cannot add application data");
      }
      if (table === "idempotencyLedger" && changed.result !== undefined)
        throw new Error("Cleanup cannot add replay payloads");
      return row;
    }
    await this.references(documentReferences(this.raw, table, row));
    if (table === "idempotencyLedger") {
      if (
        previous &&
        Object.keys(changed).some((key) =>
          ["validatedEpoch", "subjectHashes", "resultRevision", "replayBlocked"].includes(key)
        )
      )
        throw new Error("Replay metadata is server managed");
      if (!previous || Object.prototype.hasOwnProperty.call(changed, "result")) {
        return {
          ...row,
          ...(await this.resultProof(row.result)),
          resultRevision: crypto.randomUUID(),
          replayBlocked: false,
        };
      }
    }
    return row;
  }
  private async bumpMedia(table: TableNames, before: Row | null, after: Row | null) {
    if (!mediaTables.has(table) || mediaShape(before) === mediaShape(after)) return;
    const oldIds = storageIds(before);
    const newIds = storageIds(after);
    // Removals cannot hide a newly-live reference behind a cursor. Avoid O(photo-count) reads on
    // large legacy deletes; additions, resurrection and reverse-index moves invalidate the scan.
    const moved =
      after &&
      before &&
      (after.mediaIndexed !== before.mediaIndexed ||
        after.progressUpdateId !== before.progressUpdateId ||
        (before.deletedAt != null && after.deletedAt == null));
    for (const storageId of [...newIds].filter((id) => moved || !oldIds.has(id))) {
      if (this.touchedMedia.has(storageId)) continue;
      this.budget();
      this.reads.mediaEpochs++;
      const epoch = await this.raw.db
        .query("storageReferenceEpochs")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .unique();
      const revision = crypto.randomUUID();
      if (epoch) await this.raw.db.patch(epoch._id, { revision });
      else await this.raw.db.insert("storageReferenceEpochs", { storageId, revision });
      this.touchedMedia.add(storageId);
    }
  }
  context(): MutationCtx {
    const db = this.raw.db;
    const guardedDb = new Proxy(db, {
      get: (target, property) => {
        if (property === "table")
          return (table: TableNames) => {
            if (!(table in ownership)) throw new Error("Unknown reference shape");
            const scoped = Reflect.apply(Reflect.get(db, "table"), db, [table]);
            if (typeof scoped !== "object" || scoped === null)
              throw new Error("Unknown database operation");
            return new Proxy(scoped, {
              get: (reader, key) => {
                if (key === "insert") return (input: Row) => guardedDb.insert(table, input as any);
                if (key === "patch" || key === "replace")
                  return (id: string, input: Row) =>
                    Reflect.apply(Reflect.get(guardedDb, key), guardedDb, [table, id, input]);
                if (key === "delete")
                  return (id: string) => Reflect.apply(guardedDb.delete, guardedDb, [table, id]);
                const value = Reflect.get(reader, key);
                if (typeof value === "function" && !["get", "query"].includes(String(key)))
                  throw new Error("Unknown database operation");
                return typeof value === "function" ? value.bind(reader) : value;
              },
            });
          };
        if (property === "insert")
          return async (table: TableNames, input: Row) => {
            const row = await this.validate(table, cleanRow(input), null, input);
            await this.bumpMedia(table, null, row);
            const id = await db.insert(table, row as any);
            if (!this.cleanup && !controlTables.has(table))
              this.resourceCache.set(
                `${table}:${id}`,
                Promise.resolve(await this.references(ownerReferences(this.raw, table, row)))
              );
            if (table === "accountDeletionJobs") this.subjectCache.clear();
            return id;
          };
        if (property === "patch" || property === "replace")
          return async (...args: any[]) => {
            const [id, input] = args.length === 3 ? [args[1], args[2]] : args;
            const table = this.tableFor(id);
            if (args.length === 3 && args[0] !== table) throw new Error("Unknown reference shape");
            const previous = await this.readRow(id);
            if (!previous) throw new Error("Account unavailable");
            if (!this.cleanup && !controlTables.has(table))
              await this.references(ownerReferences(this.raw, table, previous));
            const row = await this.validate(
              table,
              cleanRow(property === "patch" ? { ...previous, ...input } : input),
              previous,
              input
            );
            await this.bumpMedia(table, previous, row);
            const patch: Row = { ...input };
            if (
              table === "idempotencyLedger" &&
              Object.prototype.hasOwnProperty.call(input, "result") &&
              !this.cleanup
            )
              for (const field of [
                "validatedEpoch",
                "subjectHashes",
                "resultRevision",
                "replayBlocked",
              ])
                patch[field] = row[field];
            if (property === "replace") await db.replace(id, row as any);
            else await db.patch(id, patch as any);
            if (this.cleanup) this.resourceCache.clear();
            else if (!controlTables.has(table)) {
              const oldOwners = ownerReferences(this.raw, table, previous).map(
                (r) => `${r.kind}:${r.value}`
              );
              const newOwners = ownerReferences(this.raw, table, row);
              if (
                JSON.stringify(oldOwners) !==
                JSON.stringify(newOwners.map((r) => `${r.kind}:${r.value}`))
              )
                this.resourceCache.clear();
              this.resourceCache.set(
                `${table}:${id}`,
                Promise.resolve(await this.references(newOwners))
              );
            }
            if (table === "accountDeletionJobs") this.subjectCache.clear();
          };
        if (property === "delete")
          return async (...args: any[]) => {
            const id = args.length === 2 ? args[1] : args[0];
            const table = this.tableFor(id);
            if (args.length === 2 && args[0] !== table) throw new Error("Unknown reference shape");
            if (!this.cleanup && this.actingSubject) await this.subject(this.actingSubject);
            if (controlTables.has(table) && !this.cleanup)
              throw new Error("Cleanup capability required");
            if (!this.cleanup) {
              const previous = await this.readRow(id);
              if (previous) await this.references(ownerReferences(this.raw, table, previous));
            }
            await db.delete(id);
            this.resourceCache.clear();
          };
        const value = Reflect.get(target, property);
        if (
          typeof value === "function" &&
          !["get", "query", "normalizeId"].includes(String(property))
        )
          throw new Error("Unknown database operation");
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const ctx: MutationCtx = {
      ...this.raw,
      db: guardedDb,
      runMutation: new Proxy(this.raw.runMutation, {
        apply: async (target, _receiver, args) => {
          const result = await Reflect.apply(target, this.raw, args);
          // Nested mutations can begin deletion or change parent ownership in this transaction.
          this.invalidate();
          return result;
        },
      }),
    };
    states.set(ctx, this);
    states.set(guardedDb, this);
    states.set(this.raw, this);
    return ctx;
  }
}
export function existingGuard(ctx: object): MutationGuard | undefined {
  return (
    states.get(ctx) ??
    ("db" in ctx && typeof ctx.db === "object" && ctx.db !== null ? states.get(ctx.db) : undefined)
  );
}
export function guardFor(ctx: MutationCtx): MutationGuard {
  let state = existingGuard(ctx);
  if (!state) {
    state = new MutationGuard(ctx);
    states.set(ctx, state);
  }
  return state;
}
export function mutationGuardReads(ctx: MutationCtx): GuardReads {
  return { ...guardFor(ctx).reads };
}

function registration(
  visibility: "public" | "internal",
  cleanup: boolean,
  externalArgs?: ValidatorJSON
): MutationBuilder<DataModel, any> {
  const builder = visibility === "public" ? mutationGeneric : internalMutationGeneric;
  return ((definition: any) => {
    const handler = typeof definition === "function" ? definition : definition.handler;
    const validators =
      typeof definition === "function"
        ? undefined
        : (definition.args as GenericValidator | PropertyValidators | undefined);
    const argsSchema =
      externalArgs ?? (validators ? validatorShape(asObjectValidator(validators)) : undefined);
    const wrapped = async (raw: MutationCtx, args: Row) => {
      const guard = new MutationGuard(raw, cleanup);
      if (!cleanup) {
        const identity = await raw.auth.getUserIdentity();
        if (visibility === "public" && !identity?.subject) throw new Error("Unauthorized");
        if (identity?.subject) {
          guard.actingSubject = identity.subject;
          try {
            await guard.subject(identity.subject);
          } catch {
            throw new Error("Unauthorized");
          }
        }
        await guard.references(argumentReferences(raw, argsSchema, args));
      }
      return handler(guard.context(), args);
    };
    const registered = builder(
      typeof definition === "function" ? wrapped : { ...definition, handler: wrapped }
    );
    guardedRegistrations.add(registered);
    return registered;
  }) as MutationBuilder<DataModel, any>;
}
/** Re-register SDK-created internal runners while preserving their actual exported validators. */
export function guardRegisteredInternalMutation<Args extends DefaultFunctionArgs, Result>(
  original: RegisteredMutation<"internal", Args, Result>
): RegisteredMutation<"internal", Args, Result> {
  const handler = Reflect.get(original, "_handler");
  const exportArgs = Reflect.get(original, "exportArgs");
  const exportReturns = Reflect.get(original, "exportReturns");
  if (
    typeof handler !== "function" ||
    typeof exportArgs !== "function" ||
    typeof exportReturns !== "function"
  )
    throw new Error("Unsupported mutation registration");
  const args = JSON.parse(exportArgs()) as ValidatorJSON | null;
  const wrapped = registration(
    "internal",
    false,
    args ?? undefined
  )({ handler: (ctx: MutationCtx, values: Args) => handler(ctx, values) });
  Reflect.set(wrapped, "exportArgs", exportArgs);
  Reflect.set(wrapped, "exportReturns", exportReturns);
  return wrapped as unknown as RegisteredMutation<"internal", Args, Result>;
}
export const mutation: MutationBuilder<DataModel, "public"> = registration("public", false);
export const internalMutation: MutationBuilder<DataModel, "internal"> = registration(
  "internal",
  false
);
/** Internal-only, removal-only capability. Used exclusively by explicit cleanup registrations. */
export const cleanupMutation: MutationBuilder<DataModel, "internal"> = registration(
  "internal",
  true
);
