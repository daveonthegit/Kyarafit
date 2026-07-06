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
} from "./localStore";
import { IDLE_BACKFILL, type BackfillProgress } from "./backfill";

function createDefaultStore(): LocalStore {
  // IndexedDB is browser-only; SSR / jsdom fall back to the in-memory engine. The browser store is
  // wired explicitly by `SyncWorkerProvider` so the default here stays dependency-free.
  return new InMemoryLocalStore();
}

class OfflineRuntime {
  private store: LocalStore = createDefaultStore();
  private version = 0;
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
  setStore(store: LocalStore): void {
    this.store = store;
    this.queryCache.clear();
    this.entityRows.clear();
    this.idMap.clear();
    this.bump();
  }

  getStore(): LocalStore {
    return this.store;
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
    void this.persist(() => this.store.writeQueryCache(key, json));
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
  ): void {
    const map = this.table(table);
    let merged: Record<string, unknown> = doc ?? {};
    if (!deleted && doc) {
      const existing = map.get(id);
      if (existing && !existing.synced) {
        merged = { ...(parseDoc(existing.json) ?? {}), ...doc };
      }
    }
    const row: StoredEntityRow = {
      table,
      id,
      userId,
      json: JSON.stringify(merged) ?? "{}",
      updatedAt: Date.now(),
      deleted,
      synced: false,
    };
    map.set(id, row);
    this.bump();
    void this.persist(() => this.store.putEntityRow(row));
  }

  /** Clear a pending overlay once its write has synced (sync worker on drain success). */
  clearEntityOverlay(table: string, id: string): void {
    const map = this.table(table);
    const existing = map.get(id);
    if (existing && !existing.synced) {
      map.delete(id);
      this.bump();
      void this.persist(() => this.store.deleteEntityRow(table, id));
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
    void this.persist(() => this.store.putEntityRow(row));
  }

  // --- mutation queue (consumed by the async sync worker) ---

  async enqueueMutation(
    fn: string,
    args: unknown,
    idempotencyKey: string,
    clientId?: string
  ): Promise<void> {
    const argsJson = (() => {
      try {
        return JSON.stringify(args ?? {}) ?? "{}";
      } catch {
        return "{}";
      }
    })();
    await this.persist(() =>
      this.store.enqueueMutation({ fn, argsJson, idempotencyKey, clientId: clientId ?? null })
    );
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
    this.idMap.set(clientId, serverId);
    await this.persist(() => this.store.setServerId(clientId, serverId));
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
    await this.persist(() => this.store.setMeta(key, value));
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
    const rows = await this.safe(() => this.store.listEntityRows());
    if (rows) {
      for (const row of rows) this.table(row.table).set(row.id, row);
    }
    const idMap = await this.safe(() => this.store.loadIdMap());
    if (idMap) this.idMap = new Map(Object.entries(idMap));
    this.bump();
  }

  /** Wipe local state (sign-out / account switch). Local data is never auto-deleted otherwise. */
  async reset(): Promise<void> {
    this.queryCache.clear();
    this.entityRows.clear();
    this.idMap.clear();
    this.bump();
    await this.persist(() => this.store.clearAll());
  }

  private async persist(op: () => Promise<void>): Promise<void> {
    try {
      await op();
    } catch {
      // Best-effort durability; the in-memory mirror remains authoritative for this session.
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

function parseDoc(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Process-wide offline runtime. */
export const offlineRuntime = new OfflineRuntime();
