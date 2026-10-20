import {
  REPLICA_MAX_PULL_ROWS,
  REPLICA_MAX_PUSH_OPS,
  REPLICA_RETENTION_MS,
  REPLICA_SYSTEM_FIELDS,
  REPLICA_CONFLICT_BUILD_IDS,
  replicaBuildIdOf,
  isReplicaTable,
  replicaLinksFor,
  type ReplicaConflict,
  type ReplicaOp,
  type ReplicaPullResult,
  type ReplicaPulledRow,
  type ReplicaPushResult,
} from "@kyarafit/design-system/domain/replicaProtocol";
import type { VaultDoc, VaultPersistHook, VaultRowChange, VaultSql } from "../store";
import { queuePublicationRemoval } from "../publicationRemovals";
import { conflictBuildIds } from "./buildMembership";

/**
 * Device half of managed sync (Kyarafit Cloud): replicates this vault's rows to the account's
 * row replica (`convex/replica.ts`).
 *
 * - `recordChanges` is the vault's `onPersist` hook: inside the commit's SQLite transaction it turns
 *   each changed row into an outbox op (a field patch or a delete). A local write and its sync
 *   intent are one commit; nothing is ever "optimistically" queued.
 * - `sync()` pushes the outbox oldest-first, then pulls the account's change stream from the last
 *   complete-prefix cursor. Each pulled page commits with its cursor; pulled rows are rebased under
 *   still-pending local field edits, and a pending local delete wins locally.
 * - Failures never drop or expire ops: offline, signed-out, not-entitled and server errors are
 *   separate states, and the caller retries with backoff.
 * - A device behind the server's retention horizon resnapshots: it pulls the whole replica again
 *   and drops synced rows the replica no longer has.
 * - Conflicts ("changes that didn't apply") arrive with the rows and are kept locally until the
 *   user restores or dismisses them.
 */

export interface ReplicaTransport {
  push(
    deviceId: string,
    ops: ReplicaOp[],
    after?: number,
    generation?: string
  ): Promise<ReplicaPushResult>;
  pull(after: number, limit: number, snapshot?: boolean): Promise<ReplicaPullResult>;
  dismissConflicts(ids: string[]): Promise<void>;
}

/** The session is missing or expired: sign in again to sync. Local use is unaffected. */
export class ReplicaAuthError extends Error {
  constructor(message = "Sign in again to sync") {
    super(message);
    this.name = "ReplicaAuthError";
  }
}
/** The device is offline (or the request never reached the server). */
export class ReplicaOfflineError extends Error {
  constructor(message = "Offline") {
    super(message);
    this.name = "ReplicaOfflineError";
  }
}
/** The account is not on Kyarafit Cloud (any more). Ops wait; nothing is discarded. */
export class ReplicaEntitlementError extends Error {
  constructor(message = "Sync requires Kyarafit Cloud") {
    super(message);
    this.name = "ReplicaEntitlementError";
  }
}

export type ReplicaStatus =
  "disabled" | "idle" | "syncing" | "offline" | "needs-auth" | "not-entitled" | "error";

export interface ReplicatorOptions {
  newOpId: () => string;
  now?: () => number;
  /** Called after pulled rows changed the vault on disk (reload the in-memory store). */
  onRowsChanged?: () => void;
}

const META = {
  enabled: "replica:enabled",
  cursor: "replica:cursor",
  deviceId: "replica:deviceId",
  resnapshot: "replica:resnapshot",
  lastSyncedAt: "replica:lastSyncedAt",
  generation: "replica:generation",
} as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function readMeta(sql: VaultSql, key: string): string | null {
  return (
    sql.getFirstSync<{ value: string }>("SELECT value FROM sync_meta WHERE key = ?", [key])
      ?.value ?? null
  );
}

function writeMeta(sql: VaultSql, key: string, value: string): void {
  sql.runSync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

function baseRevOf(sql: VaultSql, table: string, rowId: string): number {
  return (
    sql.getFirstSync<{ rev: number }>(
      "SELECT rev FROM replica_state WHERE table_name = ? AND row_id = ?",
      [table, rowId]
    )?.rev ?? 0
  );
}

/** The fields `after` changes relative to `before`; a removed field patches to `null`. */
export function fieldPatch(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (!REPLICA_SYSTEM_FIELDS.has(key) && (!before || !same(before[key], value)))
      patch[key] = value;
  }
  for (const key of Object.keys(before ?? {})) {
    if (!REPLICA_SYSTEM_FIELDS.has(key) && !(key in after)) patch[key] = null;
  }
  return patch;
}

/** Exponential backoff with jitter for transient failures: 2s, 4s, … capped at 5 minutes. */
export function replicaBackoffMs(failures: number, random: () => number = Math.random): number {
  const base = Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.5 + random() / 2));
}

type OutboxRow = {
  seq: number;
  op_id: string;
  table_name: string;
  row_id: string;
  kind: "put" | "delete";
  fields_json: string | null;
  base_rev: number;
  attempted_at: number | null;
};

export class Replicator {
  private transport: ReplicaTransport | null = null;
  private running: Promise<void> | null = null;
  private rerun = false;
  private disposed = false;
  private readonly listeners = new Set<() => void>();
  status: ReplicaStatus;
  lastError: unknown = null;
  /** Consecutive transient failures (drives backoff); reset by a successful pass. */
  failures = 0;
  readonly deviceId: string;

  constructor(
    private readonly sql: VaultSql,
    private readonly options: ReplicatorOptions
  ) {
    let deviceId = readMeta(sql, META.deviceId);
    if (!deviceId) {
      deviceId = `device:${options.newOpId()}`;
      writeMeta(sql, META.deviceId, deviceId);
    }
    this.deviceId = deviceId;
    this.status = this.enabled ? "idle" : "disabled";
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  /** Subscribe to status / pending-count / conflict changes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private setStatus(status: ReplicaStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit();
  }

  get enabled(): boolean {
    return readMeta(this.sql, META.enabled) === "1";
  }

  get lastSyncedAt(): number | null {
    const value = readMeta(this.sql, META.lastSyncedAt);
    return value ? Number(value) : null;
  }

  pendingCount(): number {
    return (
      this.sql.getFirstSync<{ c: number }>(
        "SELECT (SELECT COUNT(*) FROM replica_outbox) + (SELECT COUNT(*) FROM replica_conflicts WHERE dismiss_pending = 1) AS c"
      )?.c ?? 0
    );
  }

  /** The signed-in session's transport, or null while signed out / switching accounts. */
  setTransport(transport: ReplicaTransport | null): void {
    this.transport = transport;
  }

  /** Stop all work for this vault (it is being locked or switched). In-flight passes stop writing. */
  dispose(): void {
    this.disposed = true;
    this.transport = null;
    this.listeners.clear();
  }

  private enqueue(
    table: string,
    rowId: string,
    kind: "put" | "delete",
    fields: Record<string, unknown> | null
  ): void {
    this.sql.runSync(
      `INSERT INTO replica_outbox (op_id, table_name, row_id, kind, fields_json, base_rev)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        this.options.newOpId(),
        table,
        rowId,
        kind,
        fields ? JSON.stringify(fields) : null,
        baseRevOf(this.sql, table, rowId),
      ]
    );
  }

  /** The vault's `onPersist` hook: one outbox op per changed replicated row, in the same commit. */
  readonly recordChanges: VaultPersistHook = (sql, changes: readonly VaultRowChange[]) => {
    if (readMeta(sql, META.enabled) !== "1") return;
    let queued = 0;
    for (const change of changes) {
      if (!isReplicaTable(change.table)) continue;
      if (!change.after) {
        this.enqueue(change.table, change.id, "delete", null);
        queued += 1;
        continue;
      }
      const patch = fieldPatch(change.before, change.after);
      if (Object.keys(patch).length > 0) {
        this.enqueue(change.table, change.id, "put", patch);
        queued += 1;
      }
    }
    if (queued > 0) queueMicrotask(() => this.emit());
  };

  /**
   * Turn managed sync on for this vault (first paid sign-in, or an upgrade of a free vault): every
   * live row the cloud has never seen is queued once, and deletes the legacy sync path left pending
   * are converted to delete ops. Idempotent; returns the number of ops queued.
   */
  enableReplication(): number {
    let queued = 0;
    this.sql.withTransactionSync(() => {
      writeMeta(this.sql, META.enabled, "1");
      const rows = this.sql.getAllSync<{ table_name: string; id: string; json: string }>(
        `SELECT e.table_name, e.id, e.json FROM entity_rows e
         WHERE e.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM replica_state s
                           WHERE s.table_name = e.table_name AND s.row_id = e.id)
           AND NOT EXISTS (SELECT 1 FROM replica_outbox o
                           WHERE o.table_name = e.table_name AND o.row_id = e.id)
         ORDER BY e.table_name, e.id`
      );
      for (const row of rows) {
        if (!isReplicaTable(row.table_name)) continue;
        let doc: VaultDoc;
        try {
          doc = JSON.parse(row.json) as VaultDoc;
        } catch {
          continue; // Unreadable rows stay on disk untouched (surfaced by the store).
        }
        this.enqueue(row.table_name, row.id, "put", fieldPatch(null, doc));
        queued += 1;
      }
      const tombstones = this.sql.getAllSync<{ table_name: string; id: string }>(
        "SELECT table_name, id FROM entity_rows WHERE deleted = 1"
      );
      for (const row of tombstones) {
        if (isReplicaTable(row.table_name)) {
          this.enqueue(row.table_name, row.id, "delete", null);
          queued += 1;
        }
      }
      this.sql.runSync("DELETE FROM entity_rows WHERE deleted = 1");
    });
    if (this.status === "disabled") this.setStatus("idle");
    this.emit();
    return queued;
  }

  /**
   * One sync pass: push dismissals and the outbox, then pull. Single flight: a call while a pass is
   * running schedules exactly one more pass. Never throws; the outcome is `status`.
   */
  sync(): Promise<void> {
    if (this.disposed || !this.enabled) return Promise.resolve();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.rerun = false;
          if (!(await this.pass())) break;
        } while (this.rerun && !this.disposed);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async pass(): Promise<boolean> {
    const transport = this.transport;
    if (!transport) {
      this.setStatus("needs-auth");
      return false;
    }
    this.setStatus("syncing");
    try {
      const check = await transport.pull(
        Number(readMeta(this.sql, META.cursor) ?? 0),
        1,
        readMeta(this.sql, META.resnapshot) === "1"
      );
      this.assertLive();
      const oldestAttempt =
        this.sql.getFirstSync<{ at: number | null }>(
          `SELECT MIN(at) AS at FROM (
          SELECT attempted_at AS at FROM replica_outbox
          UNION ALL SELECT unpulled_at AS at FROM replica_state
        )`
        )?.at ?? null;
      const syncedAt = this.lastSyncedAt;
      const historyAt =
        syncedAt === null
          ? oldestAttempt
          : oldestAttempt === null
            ? syncedAt
            : Math.min(syncedAt, oldestAttempt);
      if (
        check.resnapshot ||
        (readMeta(this.sql, META.resnapshot) !== "1" &&
          historyAt !== null &&
          this.now() - historyAt >= REPLICA_RETENTION_MS)
      ) {
        this.beginResnapshot();
      }
      if (
        readMeta(this.sql, META.resnapshot) === "1" ||
        (check.generation ?? "initial") !== (readMeta(this.sql, META.generation) ?? "initial")
      ) {
        await this.pull(transport);
      }
      await this.pushDismissals(transport);
      if (!(await this.push(transport))) {
        this.beginResnapshot();
        await this.pull(transport);
        this.rerun = true;
        return true;
      }
      await this.pull(transport);
      if (this.disposed) return false;
      writeMeta(this.sql, META.lastSyncedAt, String(this.now()));
      this.failures = 0;
      this.lastError = null;
      this.setStatus("idle");
      return true;
    } catch (error) {
      if (this.disposed) return false;
      this.lastError = error;
      if (error instanceof ReplicaAuthError) this.setStatus("needs-auth");
      else if (error instanceof ReplicaOfflineError) this.setStatus("offline");
      else if (error instanceof ReplicaEntitlementError) this.setStatus("not-entitled");
      else {
        this.failures += 1;
        this.setStatus("error");
      }
      this.emit();
      return false;
    }
  }

  private assertLive(): void {
    if (this.disposed) throw new Error("Sync stopped: the vault was locked");
  }

  private async pushDismissals(transport: ReplicaTransport): Promise<void> {
    for (;;) {
      const ids = this.sql
        .getAllSync<{ id: string }>(
          "SELECT id FROM replica_conflicts WHERE dismiss_pending = 1 ORDER BY rev LIMIT ?",
          [REPLICA_MAX_PUSH_OPS]
        )
        .map((row) => row.id);
      if (ids.length === 0) return;
      await transport.dismissConflicts(ids);
      this.assertLive();
      this.sql.withTransactionSync(() => {
        for (const id of ids) this.sql.runSync("DELETE FROM replica_conflicts WHERE id = ?", [id]);
      });
    }
  }

  private async push(transport: ReplicaTransport): Promise<boolean> {
    for (;;) {
      const pending = this.sql.getAllSync<OutboxRow>("SELECT * FROM replica_outbox ORDER BY seq");
      const groups = new Map<string, OutboxRow[]>();
      const key = (table: string, id: string) => JSON.stringify([table, id]);
      for (const row of pending) {
        const id = key(row.table_name, row.row_id);
        const group = groups.get(id) ?? [];
        group.push(row);
        groups.set(id, group);
      }
      const ordered: OutboxRow[] = [];
      const visited = new Set<string>();
      const visit = (id: string) => {
        if (visited.has(id)) return;
        visited.add(id);
        const group = groups.get(id);
        if (!group) return;
        const first = group[0];
        const local = this.sql.getFirstSync<{ json: string }>(
          "SELECT json FROM entity_rows WHERE table_name = ? AND id = ? AND deleted = 0",
          [first.table_name, first.row_id]
        );
        const doc: Record<string, unknown> = local ? JSON.parse(local.json) : {};
        for (const row of group) {
          const fields = JSON.parse(row.fields_json ?? "{}");
          const state = { ...doc, ...fields };
          for (const rule of replicaLinksFor(row.table_name, state)) {
            const target = state[rule.field];
            if (typeof target === "string") visit(key(rule.target, target));
          }
        }
        ordered.push(...group);
      };
      for (const id of groups.keys()) visit(id);
      const rows = ordered.slice(0, REPLICA_MAX_PUSH_OPS);
      if (rows.length === 0) return true;
      const ops: ReplicaOp[] = rows.map((row) => ({
        opId: row.op_id,
        table: row.table_name,
        rowId: row.row_id,
        kind: row.kind,
        ...(row.fields_json ? { fields: JSON.parse(row.fields_json) } : {}),
        baseRev: row.base_rev,
      }));
      this.sql.withTransactionSync(() => {
        for (const row of rows)
          this.sql.runSync(
            `UPDATE replica_outbox SET attempted_at = COALESCE(attempted_at, ?)
           WHERE seq = ? AND kind = 'put' AND base_rev = 0
             AND NOT EXISTS (SELECT 1 FROM replica_state s
               WHERE s.table_name = replica_outbox.table_name AND s.row_id = replica_outbox.row_id)`,
            [this.now(), row.seq]
          );
      });
      const result = await transport.push(
        this.deviceId,
        ops,
        Number(readMeta(this.sql, META.cursor) ?? 0),
        readMeta(this.sql, META.generation) ?? "initial"
      );
      this.assertLive();
      if (result.resnapshot) {
        this.sql.withTransactionSync(() => {
          for (const row of rows) {
            if (row.attempted_at === null)
              this.sql.runSync("UPDATE replica_outbox SET attempted_at = NULL WHERE seq = ?", [
                row.seq,
              ]);
          }
        });
        return false;
      }
      // Acknowledged (applied, or rejected and kept as a conflict server-side).
      const outcomes = new Map(result.outcomes.map((outcome) => [outcome.opId, outcome]));
      this.sql.withTransactionSync(() => {
        for (const row of rows) {
          const outcome = outcomes.get(row.op_id);
          if (row.kind === "put" && outcome) {
            this.sql.runSync(
              `INSERT INTO replica_state (table_name, row_id, rev, unpulled_at) VALUES (?, ?, ?, ?)
               ON CONFLICT(table_name, row_id) DO UPDATE SET
                 unpulled_at = COALESCE(replica_state.unpulled_at, excluded.unpulled_at)`,
              [row.table_name, row.row_id, outcome.rev, this.now()]
            );
          }
          this.sql.runSync("DELETE FROM replica_outbox WHERE seq = ?", [row.seq]);
        }
      });
      this.emit();
    }
  }

  private beginResnapshot(): void {
    this.sql.withTransactionSync(() => {
      writeMeta(this.sql, META.resnapshot, "1");
      writeMeta(this.sql, META.cursor, "0");
      this.sql.runSync("DELETE FROM replica_seen");
      const pending = this.sql.getAllSync<{ seq: number }>("SELECT seq FROM replica_outbox");
      for (const op of pending)
        this.sql.runSync("UPDATE replica_outbox SET op_id = ? WHERE seq = ?", [
          this.options.newOpId(),
          op.seq,
        ]);
    });
  }

  private async pull(transport: ReplicaTransport): Promise<void> {
    for (;;) {
      const resnapshotting = readMeta(this.sql, META.resnapshot) === "1";
      const after = Number(readMeta(this.sql, META.cursor) ?? 0);
      const page = await transport.pull(after, REPLICA_MAX_PULL_ROWS, resnapshotting);
      this.assertLive();
      const generation = page.generation ?? "initial";
      if (generation !== (readMeta(this.sql, META.generation) ?? "initial")) {
        this.sql.withTransactionSync(() => {
          this.sql.runSync("DELETE FROM replica_state WHERE unpulled_at IS NULL");
          this.sql.runSync(`DELETE FROM replica_outbox WHERE kind = 'put' AND attempted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM replica_state s
                WHERE s.table_name = replica_outbox.table_name AND s.row_id = replica_outbox.row_id)`);
          this.sql.runSync("UPDATE replica_outbox SET base_rev = 0 WHERE kind = 'delete'");
          this.sql.runSync("DELETE FROM replica_assets");
          this.sql.runSync("DELETE FROM replica_seen");
          this.sql.runSync("DELETE FROM sync_meta WHERE key = ?", [META.resnapshot]);
          writeMeta(this.sql, META.cursor, "0");
        });
        this.beginResnapshot();
        this.enableReplication();
        writeMeta(this.sql, META.generation, generation);
        continue;
      }
      if (page.resnapshot) {
        this.beginResnapshot();
        continue;
      }
      // Rows, conflicts and the cursor commit together: a crash or a dropped page resumes from
      // a complete prefix.
      this.sql.withTransactionSync(() => {
        for (const row of page.rows) {
          if (!isReplicaTable(row.table)) continue;
          this.applyPulled(row, resnapshotting);
          if (resnapshotting && !row.deleted) {
            this.sql.runSync(
              "INSERT OR IGNORE INTO replica_seen (table_name, row_id) VALUES (?, ?)",
              [row.table, row.rowId]
            );
          }
        }
        for (const conflict of page.conflicts) this.applyConflict(conflict);
        writeMeta(this.sql, META.cursor, String(page.cursor));
        if (resnapshotting && !page.hasMore) this.finishResnapshot();
      });
      if (page.rows.length > 0 || page.conflicts.length > 0 || resnapshotting) {
        this.options.onRowsChanged?.();
        this.emit();
      }
      if (!page.hasMore) break;
    }
  }

  /** Synced rows the replica no longer holds were deleted while this device was away. */
  private finishResnapshot(): void {
    const gone = this.sql.getAllSync<{ table_name: string; row_id: string }>(
      `SELECT s.table_name, s.row_id FROM replica_state s
       WHERE NOT EXISTS (SELECT 1 FROM replica_seen x
                         WHERE x.table_name = s.table_name AND x.row_id = s.row_id)
       UNION
       SELECT o.table_name, o.row_id FROM replica_outbox o
       WHERE o.kind = 'put' AND o.attempted_at IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM replica_state s
                         WHERE s.table_name = o.table_name AND s.row_id = o.row_id)
         AND NOT EXISTS (SELECT 1 FROM replica_seen x
                         WHERE x.table_name = o.table_name AND x.row_id = o.row_id)`
    );
    const recovery = gone.map((row) => ({
      ...row,
      buildIds: [...conflictBuildIds(this.sql, row.table_name, row.row_id, {})],
    }));
    for (const row of recovery) {
      this.removeReplicaRow(
        row.table_name,
        row.row_id,
        { [REPLICA_CONFLICT_BUILD_IDS]: row.buildIds },
        true
      );
      this.enqueue(row.table_name, row.row_id, "delete", null);
    }
    this.sql.runSync("DELETE FROM replica_seen");
    this.sql.runSync("DELETE FROM sync_meta WHERE key = ?", [META.resnapshot]);
  }

  private removeReplicaRow(
    table: string,
    rowId: string,
    recovery: Record<string, unknown>,
    resnapshotting: boolean
  ): void {
    const pending = this.sql.getAllSync<{ fields_json: string | null }>(
      "SELECT fields_json FROM replica_outbox WHERE table_name = ? AND row_id = ? AND kind = 'put' ORDER BY seq",
      [table, rowId]
    );
    const local = this.sql.getFirstSync<{ json: string }>(
      "SELECT json FROM entity_rows WHERE table_name = ? AND id = ?",
      [table, rowId]
    );
    const unpulled = this.sql.getFirstSync<{ unpulled_at: number | null }>(
      "SELECT unpulled_at FROM replica_state WHERE table_name = ? AND row_id = ?",
      [table, rowId]
    )?.unpulled_at;
    if (pending.length || (resnapshotting && local && unpulled != null)) {
      const lost: Record<string, unknown> = {
        ...(local ? JSON.parse(local.json) : {}),
        ...recovery,
      };
      for (const op of pending) {
        for (const [field, value] of Object.entries(JSON.parse(op.fields_json ?? "{}"))) {
          if (value === null) delete lost[field];
          else lost[field] = value;
        }
      }
      this.applyConflict({
        id: this.options.newOpId(),
        table,
        rowId,
        kind: "edit-after-delete",
        lost,
        rev: 0,
        createdAt: this.now(),
        dismissed: false,
      });
    }
    this.sql.runSync("DELETE FROM replica_outbox WHERE table_name = ? AND row_id = ?", [
      table,
      rowId,
    ]);
    queuePublicationRemoval(this.sql, table, rowId);
    this.sql.runSync("DELETE FROM entity_rows WHERE table_name = ? AND id = ?", [table, rowId]);
    this.sql.runSync("DELETE FROM replica_state WHERE table_name = ? AND row_id = ?", [
      table,
      rowId,
    ]);
  }

  private applyPulled(row: ReplicaPulledRow, resnapshotting: boolean): void {
    if (row.deleted) {
      this.removeReplicaRow(row.table, row.rowId, row.doc ?? {}, resnapshotting);
      return;
    }
    const pending = this.sql.getAllSync<{ kind: string; fields_json: string | null }>(
      "SELECT kind, fields_json FROM replica_outbox WHERE table_name = ? AND row_id = ? ORDER BY seq",
      [row.table, row.rowId]
    );
    // A local delete not yet pushed wins locally; the server applies it on the next push.
    if (pending.some((op) => op.kind === "delete")) return;
    const doc: Record<string, unknown> = { ...(row.doc ?? {}), _id: row.rowId };
    for (const op of pending) {
      for (const [key, value] of Object.entries(
        JSON.parse(op.fields_json ?? "{}") as Record<string, unknown>
      )) {
        if (value === null) delete doc[key];
        else doc[key] = value;
      }
    }
    const now = this.now();
    const subject = readMeta(this.sql, "vault:subject") ?? "";
    this.sql.runSync(
      `INSERT INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(table_name, id) DO UPDATE SET json = excluded.json, user_id = excluded.user_id,
         updated_at = excluded.updated_at, synced_at = excluded.synced_at, deleted = 0`,
      [row.table, row.rowId, subject, JSON.stringify(doc), now, pending.length ? null : now]
    );
    this.sql.runSync(
      `INSERT INTO replica_state (table_name, row_id, rev) VALUES (?, ?, ?)
       ON CONFLICT(table_name, row_id) DO UPDATE SET rev = excluded.rev, unpulled_at = NULL`,
      [row.table, row.rowId, row.rev]
    );
    this.sql.runSync(
      "UPDATE replica_outbox SET attempted_at = NULL WHERE table_name = ? AND row_id = ?",
      [row.table, row.rowId]
    );
  }

  private applyConflict(conflict: ReplicaConflict): void {
    if (conflict.dismissed) {
      this.sql.runSync("DELETE FROM replica_conflicts WHERE id = ?", [conflict.id]);
      return;
    }
    const buildIds = [...conflictBuildIds(this.sql, conflict.table, conflict.rowId, conflict.lost)];
    const buildId = buildIds[0] ?? null;
    const direct = replicaBuildIdOf(conflict.table, { ...conflict.lost, _id: conflict.rowId });
    const lost = { ...conflict.lost };
    if (buildIds.some((id) => id !== direct)) lost[REPLICA_CONFLICT_BUILD_IDS] = buildIds;
    else delete lost[REPLICA_CONFLICT_BUILD_IDS];
    this.sql.runSync(
      `INSERT OR IGNORE INTO replica_conflicts
         (id, table_name, row_id, kind, lost_json, build_id, rev, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conflict.id,
        conflict.table,
        conflict.rowId,
        conflict.kind,
        JSON.stringify(lost),
        buildId,
        conflict.rev,
        conflict.createdAt,
      ]
    );
  }

  /** Resolve conflicts locally (after a restore, or a dismissal); the server learns on next sync. */
  resolveConflicts(ids: readonly string[]): void {
    this.sql.withTransactionSync(() => {
      for (const id of ids) {
        this.sql.runSync(
          "UPDATE replica_conflicts SET resolved = 1, dismiss_pending = 1 WHERE id = ?",
          [id]
        );
      }
    });
    this.emit();
  }
}
