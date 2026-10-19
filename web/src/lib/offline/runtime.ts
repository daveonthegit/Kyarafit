/**
 * Offline runtime singleton — the web equivalent of mobile's synchronous SQLite access layer.
 *
 * Mobile reads SQLite synchronously inside React render. The web engines (IndexedDB now, OPFS later)
 * are async, so the runtime keeps a synchronous in-memory MIRROR of the durable `LocalStore` for
 * render-time reads + reactivity (`useSyncExternalStore`), and write-THROUGHs persist to the store.
 * Writes update the mirror synchronously (immediate optimistic repaint) and persist asynchronously.
 *
 * OFFLINE CORE: never imports `convex/react`. Consumes only design-system pure logic + `./localStore`.
 */
import {
  applyListOverlay,
  type EntityOverlayRow,
} from "@kyarafit/design-system/domain/offlineEntityOverlay";
import {
  InMemoryLocalStore,
  type LocalStore,
  type PendingMutation,
  type StoredEntityRow,
  type EnqueueMutationInput,
} from "./localStore";
import { IDLE_BACKFILL, type BackfillProgress } from "./backfill";
import type { EntityOverlayWrite } from "./offlineEntityWrites";
import { RESTORE_SESSION_KEY, RestoreInProgressError } from "./restoreState";

function createDefaultStore(): LocalStore {
  // IndexedDB is browser-only; SSR / jsdom fall back to the in-memory engine. The browser store is
  // wired explicitly by `SyncWorkerProvider` so the default here stays dependency-free.
  return new InMemoryLocalStore();
}

export class OfflineRuntime {
  private store: LocalStore = createDefaultStore();
  private version = 0;
  private generation = 0;
  private subject: string | null = null;
  private commands: Promise<unknown> = Promise.resolve();
  private restoreInProgress = false;
  private restoreReady: Promise<void> = Promise.resolve();
  private restoreChannel: BroadcastChannel | null = null;

  getRestoreInProgress(): boolean {
    return this.restoreInProgress;
  }

  async assertPersonalWritesAllowed(): Promise<void> {
    const check = this.sessionGuard();
    await this.restoreReady;
    check();
    try {
      await this.loadRestoreState();
    } catch (error) {
      reportWriteError(error);
      throw error;
    }
    check();
    if (!this.subject || this.restoreInProgress) {
      const error = new RestoreInProgressError();
      reportWriteError(error);
      throw error;
    }
  }

  private async loadRestoreState(): Promise<void> {
    const check = this.sessionGuard();
    const raw = await this.store.getMeta(RESTORE_SESSION_KEY);
    check();
    this.restoreInProgress = Boolean(raw);
    this.bump();
  }

  getSubject(): string | null {
    return this.subject;
  }
  sessionGuard(): () => void {
    const generation = this.generation;
    return () => {
      if (generation !== this.generation) throw new Error("Local account changed");
    };
  }
  lock(): void {
    this.setStore(createDefaultStore());
  }
  private readonly listeners = new Set<() => void>();

  /** Parsed query payloads, keyed by `offlineQueryKey`. */
  private readonly queryCache = new Map<string, unknown>();
  /** Single row per (table,id); `synced=false` ⇒ pending optimistic overlay. */
  private readonly entityRows = new Map<string, Map<string, StoredEntityRow>>();
  private idMap = new Map<string, string>();
  /** In-memory upgrade-backfill progress mirror for the sync-status UI (REQ-D95). */
  private backfillProgress: BackfillProgress = IDLE_BACKFILL;

  // --- store wiring ---

  /** Swap the durable engine (browser wires IndexedDB; tests inject an in-memory store). Resets mirror. */
  setStore(store: LocalStore, subject: string | null = null): void {
    this.restoreChannel?.close();
    this.restoreChannel = null;
    this.generation += 1;
    this.subject = subject;
    this.store = store;
    this.queryCache.clear();
    this.entityRows.clear();
    this.idMap.clear();
    this.restoreInProgress = subject !== null;
    this.restoreReady = subject ? this.loadRestoreState() : Promise.resolve();
    void this.restoreReady.catch(() => undefined);
    if (subject && typeof window !== "undefined" && window.BroadcastChannel) {
      try {
        this.restoreChannel = new window.BroadcastChannel(`kyarafit-restore:${subject}`);
        this.restoreChannel.onmessage = () => {
          void this.loadRestoreState().catch(() => undefined);
        };
      } catch {
        this.restoreChannel = null;
      }
    }
    this.bump();
  }

  getStore(): LocalStore {
    return this.store;
  }

  async writeImportedEntityRow(row: StoredEntityRow): Promise<void> {
    if (!this.subject || row.userId !== this.subject) throw new Error("Local account changed");
    const assertCurrent = this.sessionGuard();
    const store = this.store;
    await this.persist(() => store.putEntityRow(row, { restore: true }));
    assertCurrent();
    this.table(row.table).set(row.id, row);
    this.bump();
  }

  /** Remove a row a restore wrote (undo of an incomplete restore), durably and from the mirror. */
  async removeImportedEntityRow(table: string, id: string): Promise<void> {
    if (!this.subject) throw new Error("Local vault is locked");
    const assertCurrent = this.sessionGuard();
    const store = this.store;
    await this.persist(() => store.deleteEntityRow(table, id));
    assertCurrent();
    this.table(table).delete(id);
    this.bump();
  }

  // --- reactivity (useSyncExternalStore) ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getVersion = (): number => this.version;

  private bump(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  private table(name: string): Map<string, StoredEntityRow> {
    let map = this.entityRows.get(name);
    if (!map) {
      map = new Map();
      this.entityRows.set(name, map);
    }
    return map;
  }

  // --- query cache (SWR base) ---

  /** Synchronous cache read for the render path; `undefined` on miss. */
  readQueryCacheSync(key: string): unknown {
    return this.queryCache.get(key);
  }

  /** Mirror + persist a live Convex result for offline replays of the same query+args. */
  writeQueryCache(key: string, payload: unknown): void {
    let json: string | undefined;
    try {
      json = JSON.stringify(payload);
    } catch {
      return;
    }
    if (json === undefined) return;
    this.queryCache.set(key, payload);
    void this.persist(() => this.store.writeQueryCache(key, json)).catch(() => undefined);
  }

  // --- entity overlays + synced base ---

  /** Pending (unsynced) overlays for a table, oldest first, ready for `applyListOverlay`. */
  listPendingEntityRowsSync(table: string): EntityOverlayRow[] {
    const rows = [...this.table(table).values()].filter((row) => !row.synced);
    rows.sort((a, b) => a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return rows.map((row) => ({ id: row.id, deleted: row.deleted, doc: parseDoc(row.json) }));
  }

  /** Non-deleted synced rows as the read base when there is no live/cached result (cold offline). */
  listSyncedEntityRowsSync(table: string): Record<string, unknown>[] {
    return [...this.table(table).values()]
      .filter((row) => row.synced && !row.deleted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => parseDoc(row.json) ?? {});
  }

  /**
   * Every local row for a table — the synced base with pending overlays applied and tombstoned rows
   * removed. This is the local-first read path for surfaces (e.g. data export) that must see a free
   * user's locally-created data, which never reaches Convex (REQ-D100/D10).
   */
  listLocalEntityRowsSync(table: string): Record<string, unknown>[] {
    const base = this.listSyncedEntityRowsSync(table) as { _id: string }[];
    const pending = this.listPendingEntityRowsSync(table);
    return applyListOverlay(base, pending) as Record<string, unknown>[];
  }

  /**
   * Upsert a pending overlay for an offline write. Edits shallow-merge onto an existing pending row
   * for the same entity so repeated offline edits compose (mirrors mobile `writeEntityOverlay`).
   */
  writeEntityOverlay(
    table: string,
    id: string,
    userId: string,
    doc: Record<string, unknown> | null,
    deleted: boolean
  ): Promise<void> {
    const map = this.table(table);
    const row = this.overlayRow({ table, id, doc, deleted }, userId);
    const assertCurrent = this.sessionGuard();
    const previous = map.get(id);
    map.set(id, row);
    this.bump();
    return this.persist(() => this.store.putEntityRow(row)).then(
      () => {
        assertCurrent();
      },
      (error: unknown) => {
        if (map.get(id) === row) {
          if (previous) map.set(id, previous);
          else map.delete(id);
          this.bump();
        }
        throw error;
      }
    );
  }

  private overlayRow(write: EntityOverlayWrite, userId: string): StoredEntityRow {
    const existing = this.table(write.table).get(write.id);
    const owner = existing?.userId || userId;
    const merged = write.deleted
      ? {}
      : {
          ...(existing ? parseDoc(existing.json) : {}),
          ...write.doc,
          userId: owner,
        };
    return {
      table: write.table,
      id: write.id,
      userId: owner,
      json: JSON.stringify(merged),
      updatedAt: Date.now(),
      deleted: write.deleted,
      synced: false,
    };
  }

  commitCommand(input: EnqueueMutationInput, writes: EntityOverlayWrite[]): Promise<void> {
    const assertCurrent = this.sessionGuard();
    const store = this.store;
    const subject = this.subject;
    const result = this.commands.then(async () => {
      assertCurrent();
      if (!subject) throw new Error("Local vault is locked");
      await this.assertPersonalWritesAllowed();
      assertCurrent();
      const rows = writes.map((write) => this.overlayRow(write, subject));
      await this.persist(() => store.commitCommand(input, rows));
      assertCurrent();
      for (const row of rows) this.table(row.table).set(row.id, row);
      this.bump();
    });
    this.commands = result.catch(() => undefined);
    return result;
  }

  /** Clear a pending overlay once its write has synced (sync worker on drain success). */
  clearEntityOverlay(table: string, id: string): void {
    const map = this.table(table);
    const existing = map.get(id);
    if (existing && !existing.synced) {
      map.delete(id);
      this.bump();
      void this.persist(() => this.store.deleteEntityRow(table, id)).catch(() => undefined);
    }
  }

  /** Write a server doc as a SYNCED row (warm-up pull). Never clobbers a pending local write. */
  upsertSyncedEntityRow(
    table: string,
    id: string,
    userId: string,
    doc: Record<string, unknown>
  ): void {
    const map = this.table(table);
    const existing = map.get(id);
    if (existing && !existing.synced) return;
    const row: StoredEntityRow = {
      table,
      id,
      userId,
      json: JSON.stringify(doc) ?? "{}",
      updatedAt: Date.now(),
      deleted: false,
      synced: true,
    };
    map.set(id, row);
    this.bump();
    void this.persist(() => this.store.putEntityRow(row)).catch(() => undefined);
  }

  // --- mutation queue (consumed by the async sync worker) ---

  async enqueueMutation(
    fn: string,
    args: unknown,
    idempotencyKey: string,
    clientId?: string
  ): Promise<void> {
    if (!this.subject) throw new Error("Local vault is locked");
    const assertCurrent = this.sessionGuard();
    const argsJson = JSON.stringify(args ?? {}) ?? "{}";
    await this.persist(() =>
      this.store.enqueueMutation({ fn, argsJson, idempotencyKey, clientId: clientId ?? null })
    );
    assertCurrent();
  }

  async listPendingMutations(limit?: number): Promise<PendingMutation[]> {
    return (await this.safe(() => this.store.listPendingMutations(limit))) ?? [];
  }

  async deleteMutation(id: number): Promise<void> {
    await this.persist(() => this.store.deleteMutation(id));
  }

  async bumpMutationRetry(id: number): Promise<void> {
    await this.persist(() => this.store.bumpMutationRetry(id));
  }

  async failMutation(id: number): Promise<void> {
    await this.persist(() => this.store.failMutation(id));
  }

  async countPendingMutations(): Promise<number> {
    return (await this.safe(() => this.store.countPendingMutations())) ?? 0;
  }

  async countFailedMutations(): Promise<number> {
    return (await this.safe(() => this.store.countFailedMutations())) ?? 0;
  }

  async requeueFailedMutations(): Promise<number> {
    return (await this.safe(() => this.store.requeueFailedMutations())) ?? 0;
  }

  // --- id map ---

  async setServerId(clientId: string, serverId: string): Promise<void> {
    const assertCurrent = this.sessionGuard();
    await this.persist(() => this.store.setServerId(clientId, serverId));
    assertCurrent();
    this.idMap.set(clientId, serverId);
  }

  async loadIdMap(): Promise<Record<string, string>> {
    const fromStore = (await this.safe(() => this.store.loadIdMap())) ?? {};
    return { ...Object.fromEntries(this.idMap), ...fromStore };
  }

  // --- sync cursor ---

  async getSyncCursor(): Promise<number> {
    return (await this.safe(() => this.store.getSyncCursor())) ?? 0;
  }

  async setSyncCursor(cursor: number): Promise<void> {
    await this.persist(() => this.store.setSyncCursor(cursor));
  }

  // --- last-synced timestamp (sync-status, REQ-D64) ---

  async getLastSyncedAt(): Promise<number | null> {
    return (await this.safe(() => this.store.getLastSyncedAt())) ?? null;
  }

  async setLastSyncedAt(ts: number): Promise<void> {
    await this.persist(() => this.store.setLastSyncedAt(ts));
  }

  // --- generic per-device flags ---

  async getMeta(key: string): Promise<string | null> {
    return (await this.safe(() => this.store.getMeta(key))) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const check = this.sessionGuard();
    if (key === RESTORE_SESSION_KEY) {
      await this.restoreReady;
      check();
      if (value) {
        this.restoreInProgress = true;
        this.bump();
      }
    }
    await this.persist(() => this.store.setMeta(key, value));
    check();
    if (key === RESTORE_SESSION_KEY) {
      this.restoreInProgress = Boolean(value);
      try {
        this.restoreChannel?.postMessage(Boolean(value));
      } catch {
        this.restoreChannel = null;
      }
      this.bump();
    }
  }

  // --- upgrade-backfill progress (sync-status, REQ-D95) ---

  /** Current aggregate backfill progress for the render path. */
  getBackfillProgress(): BackfillProgress {
    return this.backfillProgress;
  }

  /** Update the backfill progress mirror and repaint subscribers. */
  setBackfillProgress(progress: BackfillProgress): void {
    this.backfillProgress = progress;
    this.bump();
  }

  // --- lifecycle ---

  /** Hydrate the in-memory mirror from the durable store (cold start). Best-effort. */
  async hydrate(): Promise<void> {
    const assertCurrent = this.sessionGuard();
    await this.restoreReady;
    assertCurrent();
    this.restoreReady = this.loadRestoreState();
    await this.restoreReady;
    assertCurrent();
    const rows = await this.safe(() => this.store.listEntityRows());
    assertCurrent();
    if (rows) {
      for (const row of rows) this.table(row.table).set(row.id, row);
    }
    const idMap = await this.safe(() => this.store.loadIdMap());
    assertCurrent();
    if (idMap) this.idMap = new Map(Object.entries(idMap));
    this.bump();
  }

  private async persist(op: () => Promise<void>): Promise<void> {
    try {
      await op();
    } catch (error) {
      reportWriteError(error);
      throw error;
    }
  }

  private async safe<T>(op: () => Promise<T>): Promise<T | undefined> {
    try {
      return await op();
    } catch {
      return undefined;
    }
  }
}

function reportWriteError(error: unknown): void {
  const message =
    error instanceof RestoreInProgressError ? error.message : "Couldn't save on this device";
  console.error(message, error);
  if (typeof window !== "undefined") window.alert(message);
}

function parseDoc(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Process-wide offline runtime. */
export const offlineRuntime = new OfflineRuntime();
