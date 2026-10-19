import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";
import { localizeVaultPhotos } from "./images";
import { VAULT_INDEX_FIELDS, VAULT_TABLES } from "./indexes";

/** Owner-identity fields re-owned to the importing account. */
const OWNER_FIELDS = ["userId", "creatorUserId", "ownerUserId", "assigneeUserId"] as const;

export interface ImportedRow {
  table: string;
  id: string;
  doc: Record<string, unknown>;
}

export interface ImportRowsResult {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
  /** Rows for tables this app version does not know (left out, reported). */
  unknown: number;
}

/**
 * The local vault store: the authoritative, in-process view of one account's personal data.
 *
 * SQLite (`entity_rows`) is the durable copy; this store keeps a fully materialized in-memory
 * mirror so local queries run synchronously during render. Every write goes through `commit`, which
 * stages changes in a transaction object, persists them (plus any replication intent) inside ONE
 * SQLite transaction, and only then publishes them to memory. A failed write therefore throws and
 * changes nothing — there is no "optimistic" success for a write that never reached disk.
 *
 * The query/write surface deliberately mirrors the subset of Convex's `ctx.db` that the ported
 * personal-data handlers use (`get`, `query().withIndex().filter().order().collect()`, `insert`,
 * `patch`, `replace`, `delete`), so handler logic reads like its server counterpart.
 */

export type VaultDoc = { _id: string; _creationTime: number } & Record<string, unknown>;

export type VaultBindValue = string | number | null | boolean | Uint8Array;

/** The subset of expo-sqlite's synchronous API the store needs (lets tests use node:sqlite). */
export interface VaultSql {
  execSync(source: string): void;
  runSync(source: string, ...params: VaultBindValue[]): { changes: number };
  runSync(source: string, params: VaultBindValue[]): { changes: number };
  getAllSync<T>(source: string, ...params: VaultBindValue[]): T[];
  getAllSync<T>(source: string, params: VaultBindValue[]): T[];
  getFirstSync<T>(source: string, ...params: VaultBindValue[]): T | null;
  getFirstSync<T>(source: string, params: VaultBindValue[]): T | null;
  withTransactionSync(task: () => void): void;
}

/** Converts between the stored (portable) and in-memory (device-resolved) form of a document. */
export interface VaultDocCodec {
  toStored(doc: VaultDoc): VaultDoc;
  fromStored(doc: VaultDoc): VaultDoc;
}

const IDENTITY_CODEC: VaultDocCodec = { toStored: (doc) => doc, fromStored: (doc) => doc };

/** A durable replication intent recorded atomically with the local write (paid sync only). */
export interface ReplicationIntent {
  fn: string;
  args: unknown;
  idempotencyKey: string;
  /** Local id of the entity this op creates, so the drain can map it to the server id. */
  clientId?: string;
}

/** Raised when a local write could not be persisted. The caller's draft must stay recoverable. */
export class VaultWriteError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Couldn't save on this device: ${detail}`);
    this.name = "VaultWriteError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------------------------
// Value ordering + index ranges (Convex semantics: undefined < null < number < boolean < string)
// ---------------------------------------------------------------------------------------------

function typeRank(value: unknown): number {
  if (value === undefined) return 0;
  if (value === null) return 1;
  if (typeof value === "bigint" || typeof value === "number") return 2;
  if (typeof value === "boolean") return 3;
  if (typeof value === "string") return 4;
  if (Array.isArray(value)) return 6;
  return 7;
}

export function compareVaultValues(a: unknown, b: unknown): number {
  const ra = typeRank(a);
  const rb = typeRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 2) return Number(a) - Number(b);
  if (ra === 3) return Number(a) - Number(b);
  if (ra === 4) return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  if (ra === 6) {
    const aa = a as unknown[];
    const bb = b as unknown[];
    for (let i = 0; i < Math.min(aa.length, bb.length); i += 1) {
      const c = compareVaultValues(aa[i], bb[i]);
      if (c !== 0) return c;
    }
    return aa.length - bb.length;
  }
  return 0;
}

type RangeOp = { field: string; op: "eq" | "gt" | "gte" | "lt" | "lte"; value: unknown };

/** Records `q.eq(...).gt(...)` index-range calls; applied as a conjunction of field predicates. */
export class VaultIndexRange {
  readonly ops: RangeOp[] = [];
  eq(field: string, value: unknown): VaultIndexRange {
    this.ops.push({ field, op: "eq", value });
    return this;
  }
  gt(field: string, value: unknown): VaultIndexRange {
    this.ops.push({ field, op: "gt", value });
    return this;
  }
  gte(field: string, value: unknown): VaultIndexRange {
    this.ops.push({ field, op: "gte", value });
    return this;
  }
  lt(field: string, value: unknown): VaultIndexRange {
    this.ops.push({ field, op: "lt", value });
    return this;
  }
  lte(field: string, value: unknown): VaultIndexRange {
    this.ops.push({ field, op: "lte", value });
    return this;
  }
}

function matchesRange(doc: VaultDoc, ops: RangeOp[]): boolean {
  for (const { field, op, value } of ops) {
    const c = compareVaultValues(doc[field], value);
    if (op === "eq" && c !== 0) return false;
    if (op === "gt" && !(c > 0)) return false;
    if (op === "gte" && !(c >= 0)) return false;
    if (op === "lt" && !(c < 0)) return false;
    if (op === "lte" && !(c <= 0)) return false;
  }
  return true;
}

export interface VaultQuery {
  withIndex(index: string, range?: (q: VaultIndexRange) => VaultIndexRange): VaultQuery;
  /** Plain predicate (ported from Convex `.filter(q => ...)`). */
  filter(predicate: (doc: VaultDoc) => boolean): VaultQuery;
  order(direction: "asc" | "desc"): VaultQuery;
  collect(): VaultDoc[];
  take(n: number): VaultDoc[];
  first(): VaultDoc | null;
  /** The single match, or null; throws when more than one row matches (Convex semantics). */
  unique(): VaultDoc | null;
}

class LocalQuery implements VaultQuery {
  private indexFields: readonly string[] = [];
  private ops: RangeOp[] = [];
  private predicates: ((doc: VaultDoc) => boolean)[] = [];
  private direction: "asc" | "desc" = "asc";

  constructor(
    private readonly table: string,
    private readonly source: () => VaultDoc[]
  ) {}

  withIndex(index: string, range?: (q: VaultIndexRange) => VaultIndexRange): VaultQuery {
    this.indexFields = VAULT_INDEX_FIELDS[this.table]?.[index] ?? [];
    if (range) this.ops = range(new VaultIndexRange()).ops;
    return this;
  }

  filter(predicate: (doc: VaultDoc) => boolean): VaultQuery {
    this.predicates.push(predicate);
    return this;
  }

  order(direction: "asc" | "desc"): VaultQuery {
    this.direction = direction;
    return this;
  }

  collect(): VaultDoc[] {
    const rows = this.source().filter(
      (doc) => matchesRange(doc, this.ops) && this.predicates.every((p) => p(doc))
    );
    const keys = [...this.indexFields, "_creationTime", "_id"];
    rows.sort((a, b) => {
      for (const key of keys) {
        const c = compareVaultValues(a[key], b[key]);
        if (c !== 0) return c;
      }
      return 0;
    });
    if (this.direction === "desc") rows.reverse();
    return rows;
  }

  take(n: number): VaultDoc[] {
    return this.collect().slice(0, Math.max(0, n));
  }

  first(): VaultDoc | null {
    return this.collect()[0] ?? null;
  }

  unique(): VaultDoc | null {
    const rows = this.collect();
    if (rows.length > 1) {
      throw new Error(`unique() matched ${rows.length} ${this.table} rows`);
    }
    return rows[0] ?? null;
  }
}

export interface VaultReader {
  get(id: string): VaultDoc | null;
  query(table: string): VaultQuery;
}

export interface VaultWriter extends VaultReader {
  /** Insert a new document; returns its new local id. */
  insert(table: string, fields: Record<string, unknown>): string;
  /** Shallow-merge fields; an `undefined` value removes that field (Convex semantics). */
  patch(id: string, fields: Record<string, unknown>): void;
  replace(id: string, fields: Record<string, unknown>): void;
  delete(id: string): void;
}

// ---------------------------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------------------------

type Staged = { table: string; doc: VaultDoc | null; existed: boolean };

function withoutUndefined(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function parseStoredDoc(json: string): Record<string, unknown> | null {
  try {
    const doc: unknown = JSON.parse(json);
    return doc !== null && typeof doc === "object" && !Array.isArray(doc)
      ? (doc as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const SYSTEM_FIELDS = new Set(["_id", "_creationTime"]);

export interface VaultStoreOptions {
  subject: string;
  sql: VaultSql;
  newId: () => string;
  now?: () => number;
  codec?: VaultDocCodec;
}

export class VaultStore {
  readonly subject: string;
  private readonly sql: VaultSql;
  private readonly newId: () => string;
  private readonly now: () => number;
  private readonly codec: VaultDocCodec;
  private tables = new Map<string, Map<string, VaultDoc>>();
  private idToTable = new Map<string, string>();
  private version = 0;
  private readonly listeners = new Set<() => void>();
  /** Rows skipped at load because their JSON could not be parsed (surfaced, never silently lost). */
  corruptRowCount = 0;

  constructor(options: VaultStoreOptions) {
    this.subject = options.subject;
    this.sql = options.sql;
    this.newId = options.newId;
    this.now = options.now ?? Date.now;
    this.codec = options.codec ?? IDENTITY_CODEC;
    this.reloadFromDisk();
  }

  /** Re-read every live row from SQLite (initial open, and after the sync worker pulls). */
  reloadFromDisk(): void {
    const rows = this.sql.getAllSync<{ table_name: string; id: string; json: string }>(
      "SELECT table_name, id, json FROM entity_rows WHERE deleted = 0"
    );
    const tables = new Map<string, Map<string, VaultDoc>>();
    const idToTable = new Map<string, string>();
    let corrupt = 0;
    for (const row of rows) {
      const parsed = parseStoredDoc(row.json);
      if (!parsed) {
        corrupt += 1;
        continue;
      }
      const doc = this.codec.fromStored({
        ...parsed,
        _id: row.id,
        _creationTime: typeof parsed._creationTime === "number" ? parsed._creationTime : 0,
      });
      let table = tables.get(row.table_name);
      if (!table) {
        table = new Map();
        tables.set(row.table_name, table);
      }
      table.set(row.id, doc);
      idToTable.set(row.id, row.table_name);
    }
    this.tables = tables;
    this.idToTable = idToTable;
    this.corruptRowCount = corrupt;
    this.bump();
  }

  getVersion(): number {
    return this.version;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private bump(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /** Number of live documents per table (status UI, export summaries). */
  countByTable(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [table, docs] of this.tables) counts[table] = docs.size;
    return counts;
  }

  /** Committed read view. */
  reader(): VaultReader {
    return {
      get: (id) => {
        const table = this.idToTable.get(id);
        return table ? (this.tables.get(table)?.get(id) ?? null) : null;
      },
      query: (table) =>
        new LocalQuery(table, () => Array.from(this.tables.get(table)?.values() ?? [])),
    };
  }

  /**
   * Run `task` against a staged write view and persist everything it wrote — plus the optional
   * replication intent — in one SQLite transaction. Returns the task's result only after commit.
   * Throws the task's own error unchanged (validation), or `VaultWriteError` when persistence fails;
   * in both cases nothing is published.
   */
  commit<T>(
    task: (db: VaultWriter) => T,
    intent?: (result: T, touched: string[][]) => ReplicationIntent | ReplicationIntent[] | null
  ): T {
    const staged = new Map<string, Staged>();
    const now = this.now();

    const lookup = (id: string): { table: string; doc: VaultDoc } | null => {
      const s = staged.get(id);
      if (s) return s.doc ? { table: s.table, doc: s.doc } : null;
      const table = this.idToTable.get(id);
      const doc = table ? this.tables.get(table)?.get(id) : undefined;
      return table && doc ? { table, doc } : null;
    };

    const tableDocs = (table: string): VaultDoc[] => {
      const out: VaultDoc[] = [];
      for (const [id, doc] of this.tables.get(table) ?? []) {
        const s = staged.get(id);
        if (!s) out.push(doc);
        else if (s.doc) out.push(s.doc);
      }
      for (const [id, s] of staged) {
        if (s.table === table && s.doc && !this.tables.get(table)?.has(id)) out.push(s.doc);
      }
      return out;
    };

    const stage = (id: string, table: string, doc: VaultDoc | null) => {
      const prior = staged.get(id);
      const existed = prior ? prior.existed : this.idToTable.has(id);
      staged.set(id, { table, doc, existed });
    };

    const writer: VaultWriter = {
      get: (id) => lookup(id)?.doc ?? null,
      query: (table) => new LocalQuery(table, () => tableDocs(table)),
      insert: (table, fields) => {
        const id = this.newId();
        const doc = {
          ...withoutUndefined(fields),
          _id: id,
          _creationTime: now,
        } as VaultDoc;
        if (table !== "vaultSettings" && doc.updatedAt === undefined) doc.updatedAt = now;
        stage(id, table, doc);
        return id;
      },
      patch: (id, fields) => {
        const found = lookup(id);
        if (!found) throw new Error(`Document not found: ${id}`);
        const next: Record<string, unknown> = { ...found.doc };
        for (const [key, value] of Object.entries(fields)) {
          if (SYSTEM_FIELDS.has(key)) continue;
          if (value === undefined) delete next[key];
          else next[key] = value;
        }
        if (found.table !== "vaultSettings" && fields.updatedAt === undefined) next.updatedAt = now;
        stage(id, found.table, next as VaultDoc);
      },
      replace: (id, fields) => {
        const found = lookup(id);
        if (!found) throw new Error(`Document not found: ${id}`);
        stage(id, found.table, {
          ...withoutUndefined(fields),
          _id: id,
          _creationTime: found.doc._creationTime,
          updatedAt: now,
        } as VaultDoc);
      },
      delete: (id) => {
        const found = lookup(id);
        if (!found) throw new Error(`Document not found: ${id}`);
        stage(id, found.table, null);
      },
    };

    const result = task(writer);
    if (staged.size === 0 && !intent) return result;

    const touched = Array.from(staged.entries()).map(([id, s]) => [s.table, id]);
    const replication = intent ? intent(result, touched) : null;

    try {
      this.sql.withTransactionSync(() => {
        for (const [id, s] of staged) {
          if (s.doc) {
            const stored = this.codec.toStored(s.doc);
            const json = JSON.stringify(stored);
            this.sql.runSync(
              `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
               VALUES (?, ?, ?, ?, ?, NULL, 0)
               ON CONFLICT(table_name, id) DO UPDATE SET
                 json = excluded.json,
                 user_id = excluded.user_id,
                 updated_at = excluded.updated_at,
                 synced_at = NULL,
                 deleted = 0`,
              [s.table, id, this.subject, json, now]
            );
          } else if (s.existed) {
            // Never-replicated local rows can simply disappear; anything the cloud may hold keeps a
            // pending tombstone so a later sync can propagate the delete.
            const neverReplicated =
              s.table === "vaultSettings" ||
              (id.startsWith(LOCAL_ID_PREFIX) &&
                !this.sql.getFirstSync<{ c: number }>(
                  "SELECT 1 AS c FROM id_map WHERE client_id = ?",
                  [id]
                ));
            if (neverReplicated) {
              this.sql.runSync("DELETE FROM entity_rows WHERE table_name = ? AND id = ?", [
                s.table,
                id,
              ]);
            } else {
              this.sql.runSync(
                `UPDATE entity_rows SET deleted = 1, synced_at = NULL, updated_at = ?
                 WHERE table_name = ? AND id = ?`,
                [now, s.table, id]
              );
            }
          }
        }
        for (const entry of replication
          ? Array.isArray(replication)
            ? replication
            : [replication]
          : []) {
          this.sql.runSync(
            `INSERT INTO mutation_queue
               (idempotency_key, op, fn, args_json, client_id, created_at, status, touched_json)
             VALUES (?, 'mutation', ?, ?, ?, ?, 'pending', ?)`,
            [
              entry.idempotencyKey,
              entry.fn,
              JSON.stringify(entry.args ?? {}),
              entry.clientId ?? null,
              now,
              JSON.stringify(touched),
            ]
          );
        }
      });
    } catch (error) {
      throw new VaultWriteError(error);
    }

    for (const [id, s] of staged) {
      if (s.doc) {
        let table = this.tables.get(s.table);
        if (!table) {
          table = new Map();
          this.tables.set(s.table, table);
        }
        table.set(id, s.doc);
        this.idToTable.set(id, s.table);
      } else {
        this.tables.get(s.table)?.delete(id);
        this.idToTable.delete(id);
      }
    }
    this.bump();
    return result;
  }

  /** Every live row in stored (portable) form, ordered for stable exports. */
  exportRows(onUnreadable?: () => void): ImportedRow[] {
    const rows = this.sql.getAllSync<{ table_name: string; id: string; json: string }>(
      "SELECT table_name, id, json FROM entity_rows WHERE deleted = 0 ORDER BY table_name, id"
    );
    const out: ImportedRow[] = [];
    for (const row of rows) {
      const doc = parseStoredDoc(row.json);
      if (doc) {
        out.push({ table: row.table_name, id: row.id, doc });
      } else {
        onUnreadable?.();
      }
    }
    return out;
  }

  /**
   * A record can carry different ids on different devices: the device that created it keeps its
   * local id (`local:…`, mapped to the server id in `id_map`), while a device that pulled it from
   * the cloud stores the server id (with the original local id as `clientId`). Before merging a
   * backup, map every incoming id onto the row this vault already holds for the same record, and
   * rewrite references to it, so a restore merges instead of duplicating records and relations.
   */
  private reconcileImportIds(rows: readonly ImportedRow[]): ImportedRow[] {
    const localToServer = new Map<string, string>();
    const serverToLocal = new Map<string, string>();
    for (const { client_id, server_id } of this.sql.getAllSync<{
      client_id: string;
      server_id: string;
    }>("SELECT client_id, server_id FROM id_map")) {
      localToServer.set(client_id, server_id);
      serverToLocal.set(server_id, client_id);
    }
    const exists = (table: string, id: string) =>
      this.sql.getFirstSync<{ c: number }>(
        "SELECT 1 AS c FROM entity_rows WHERE table_name = ? AND id = ? AND deleted = 0",
        [table, id]
      ) !== null;
    const byClientId = (table: string, clientId: string) =>
      this.sql
        .getAllSync<{ id: string; json: string }>(
          "SELECT id, json FROM entity_rows WHERE table_name = ? AND deleted = 0",
          [table]
        )
        .find((row) => parseStoredDoc(row.json)?.clientId === clientId)?.id ?? null;

    const alias = new Map<string, string>();
    for (const row of rows) {
      if (exists(row.table, row.id)) continue;
      const candidates = [
        localToServer.get(row.id),
        serverToLocal.get(row.id),
        typeof row.doc.clientId === "string" ? row.doc.clientId : undefined,
      ];
      let target = candidates.find(
        (candidate): candidate is string => !!candidate && exists(row.table, candidate)
      );
      target ??= byClientId(row.table, row.id) ?? undefined;
      if (target && target !== row.id) {
        alias.set(row.id, target);
        if (row.id.startsWith(LOCAL_ID_PREFIX) !== target.startsWith(LOCAL_ID_PREFIX)) {
          const clientId = row.id.startsWith(LOCAL_ID_PREFIX) ? row.id : target;
          const serverId = row.id.startsWith(LOCAL_ID_PREFIX) ? target : row.id;
          this.sql.runSync(
            `INSERT INTO id_map (client_id, server_id, synced_at) VALUES (?, ?, ?)
             ON CONFLICT(client_id) DO UPDATE SET
               server_id = excluded.server_id, synced_at = excluded.synced_at`,
            [clientId, serverId, this.now()]
          );
        }
      }
    }
    if (alias.size === 0) return [...rows];

    const rewrite = (value: unknown, key?: string): unknown => {
      if (typeof value === "string") {
        if (key === "clientId") return value;
        const direct = alias.get(value);
        if (direct) return direct;
        // Composite keys embed ids as `kind:id` segments (e.g. entityKey "cosplayNode:<id>").
        if (key === "entityKey" || key === "dedupeKey") {
          let out = value;
          for (const [from, to] of alias) out = out.split(from).join(to);
          return out;
        }
        return value;
      }
      if (Array.isArray(value)) return value.map((item) => rewrite(item));
      if (value !== null && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([k, item]) => [k, rewrite(item, k)])
        );
      }
      return value;
    };
    return rows.map((row) => ({
      table: row.table,
      id: alias.get(row.id) ?? row.id,
      doc: rewrite(row.doc) as Record<string, unknown>,
    }));
  }

  private repairImportedHierarchies(changedParents: Map<string, Map<string, unknown>>): number {
    let conflicts = 0;
    for (const [table, previous] of changedParents) {
      const parentField = table === "cosplayNodes" ? "parentNodeId" : "parentId";
      const rows = this.sql.getAllSync<{ id: string; json: string }>(
        "SELECT id, json FROM entity_rows WHERE table_name = ? AND deleted = 0",
        [table]
      );
      const docs = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        const doc = parseStoredDoc(row.json);
        if (doc) docs.set(row.id, doc);
      }
      let repaired: boolean;
      do {
        repaired = false;
        for (const id of docs.keys()) {
          const path: string[] = [];
          let current: unknown = id;
          while (typeof current === "string" && docs.has(current)) {
            const start = path.indexOf(current);
            if (start !== -1) {
              const cycle = path.slice(start);
              const imported = cycle.filter((key) => previous.has(key));
              if (imported.length === 0) throw new Error("Invalid vault hierarchy");
              for (const key of imported) {
                docs.get(key)![parentField] = previous.get(key);
                previous.delete(key);
                conflicts += 1;
              }
              repaired = true;
              break;
            }
            path.push(current);
            current = docs.get(current)![parentField];
          }
        }
      } while (repaired);
      if (table === "workflowItems") {
        for (const doc of docs.values()) {
          const ancestors: string[] = [];
          let parent = doc.parentId;
          while (typeof parent === "string" && docs.has(parent)) {
            ancestors.unshift(parent);
            parent = docs.get(parent)!.parentId;
          }
          doc.ancestorIds = ancestors;
        }
      }
      for (const row of rows) {
        const doc = docs.get(row.id);
        if (!doc) continue;
        const json = JSON.stringify(doc);
        if (json !== row.json) {
          this.sql.runSync(
            "UPDATE entity_rows SET json = ?, synced_at = NULL WHERE table_name = ? AND id = ?",
            [json, table, row.id]
          );
        }
      }
    }
    return conflicts;
  }

  /**
   * Merge rows from a backup into this vault in ONE SQLite transaction: rows this vault lacks are
   * added, rows the backup holds a newer copy of (`updatedAt`) replace the local copy, everything
   * else is kept. Re-importing the same backup is therefore a no-op. Rows written by `sourceSubject`
   * are re-owned to this vault's account. Imported rows are local changes the cloud has not seen, so
   * the one-time upgrade backfill is re-armed for paid sync.
   */
  importRows(
    rows: readonly ImportedRow[],
    sourceSubject: string,
    availablePhotos: ReadonlySet<string> = new Set()
  ): ImportRowsResult {
    const result: ImportRowsResult = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      unknown: 0,
    };
    const changedParents = new Map<string, Map<string, unknown>>();
    const now = this.now();
    const known = new Set<string>(VAULT_TABLES);
    try {
      this.sql.withTransactionSync(() => {
        const incoming = this.reconcileImportIds(rows);
        for (const row of incoming) {
          if (!known.has(row.table)) {
            result.unknown += 1;
            continue;
          }
          const doc: Record<string, unknown> = { ...row.doc, _id: row.id };
          if (typeof doc._creationTime !== "number") doc._creationTime = now;
          for (const field of OWNER_FIELDS) {
            if (doc[field] === sourceSubject) doc[field] = this.subject;
          }
          const existing = this.sql.getFirstSync<{ json: string; deleted: number }>(
            "SELECT json, deleted FROM entity_rows WHERE table_name = ? AND id = ?",
            [row.table, row.id]
          );
          const local = existing && !existing.deleted ? parseStoredDoc(existing.json) : null;
          if (typeof local?.clientId === "string") doc.clientId = local.clientId;
          if (existing && !existing.deleted) {
            const localUpdatedAt = typeof local?.updatedAt === "number" ? local.updatedAt : 0;
            const incoming = typeof doc.updatedAt === "number" ? doc.updatedAt : 0;
            if (local && (row.table === "vaultSettings" || incoming <= localUpdatedAt)) {
              result.skipped += 1;
              // The local copy wins, but a cloud-only photo it references may now have its original
              // on this device (restored from this backup): point the row at the local file without
              // touching its timestamp or sync state, so newer edits are never overwritten.
              if (row.table !== "vaultSettings" && availablePhotos.size > 0) {
                const localized = localizeVaultPhotos(local, availablePhotos);
                const json = JSON.stringify(localized);
                if (json !== existing.json) {
                  this.sql.runSync(
                    "UPDATE entity_rows SET json = ? WHERE table_name = ? AND id = ?",
                    [json, row.table, row.id]
                  );
                }
              }
              continue;
            }
            result.updated += 1;
          } else {
            result.inserted += 1;
          }
          if (row.table === "cosplayNodes" || row.table === "workflowItems") {
            const field = row.table === "cosplayNodes" ? "parentNodeId" : "parentId";
            let changes = changedParents.get(row.table);
            if (!changes) {
              changes = new Map();
              changedParents.set(row.table, changes);
            }
            const previous = local?.[field];
            if (previous !== doc[field] && !changes.has(row.id)) changes.set(row.id, previous);
          }
          this.sql.runSync(
            `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
             VALUES (?, ?, ?, ?, ?, NULL, 0)
             ON CONFLICT(table_name, id) DO UPDATE SET
               json = excluded.json, user_id = excluded.user_id, updated_at = excluded.updated_at,
               synced_at = NULL, deleted = 0`,
            [row.table, row.id, this.subject, JSON.stringify(doc), now]
          );
        }
        result.conflicts = this.repairImportedHierarchies(changedParents);
        if (result.inserted + result.updated > 0) {
          this.sql.runSync("DELETE FROM sync_meta WHERE key = 'backfill:complete'");
        }
      });
    } catch (error) {
      throw new VaultWriteError(error);
    }
    this.reloadFromDisk();
    return result;
  }
}

export function isVaultTable(table: string): boolean {
  return (VAULT_TABLES as readonly string[]).includes(table);
}
