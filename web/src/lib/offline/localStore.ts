/**
 * Web local-first store contract (DATA_AND_SYNC.md §5, REQ-D50). The single `LocalStore` interface
 * is the seam between the platform-agnostic offline runtime/sync logic and the underlying storage
 * engine. The production engine is IndexedDB (`./indexedDbStore`), which the spec will later swap
 * for OPFS + wa-sqlite WITHOUT touching any caller — they only ever see this interface.
 *
 * It is the web mirror of mobile's SQLite tables (`entity_rows`, `mutation_queue`, `id_map`,
 * `query_cache`, sync metadata). All methods are async because IndexedDB/OPFS are async; the
 * runtime keeps a synchronous in-memory mirror on top for React's render-time reads.
 *
 * This file is OFFLINE CORE: it must never import `convex/react` (the bridge owns the online path).
 */

/** A cached Convex query payload (stale-while-revalidate base). */
export interface StoredQueryCache {
  key: string;
  payloadJson: string;
  fetchedAt: number;
}

/**
 * One local entity row. Pending (unsynced) rows are optimistic offline writes overlaid onto the
 * server snapshot; synced rows are the warm-up-pulled local base. `synced=false` ⇒ pending.
 */
export interface StoredEntityRow {
  table: string;
  id: string;
  userId: string;
  json: string;
  updatedAt: number;
  deleted: boolean;
  synced: boolean;
}

/** A queued offline mutation awaiting replay by the sync worker. */
export interface PendingMutation {
  id: number;
  idempotency_key: string;
  fn: string;
  args_json: string;
  retry_count: number;
  /** Optimistic client id minted for an offline create; null otherwise. */
  client_id: string | null;
}

/** Input for appending a mutation to the queue. */
export interface EnqueueMutationInput {
  fn: string;
  argsJson: string;
  idempotencyKey: string;
  clientId: string | null;
}

/**
 * Platform-agnostic local store. Implemented by `IndexedDbLocalStore` (production) and
 * `InMemoryLocalStore` (tests / SSR / engines-unavailable fallback). Every method is best-effort
 * from the caller's perspective: the runtime wraps calls so a storage failure degrades to a no-op
 * rather than crashing the UI.
 */
export interface LocalStore {
  // --- query cache (SWR base) ---
  readQueryCache(key: string): Promise<StoredQueryCache | undefined>;
  writeQueryCache(key: string, payloadJson: string): Promise<void>;

  // --- entity rows (overlays + synced base) ---
  putEntityRow(row: StoredEntityRow): Promise<void>;
  deleteEntityRow(table: string, id: string): Promise<void>;
  listEntityRows(): Promise<StoredEntityRow[]>;

  // --- mutation queue ---
  enqueueMutation(input: EnqueueMutationInput): Promise<void>;
  listPendingMutations(limit?: number): Promise<PendingMutation[]>;
  deleteMutation(id: number): Promise<void>;
  bumpMutationRetry(id: number): Promise<void>;
  failMutation(id: number): Promise<void>;
  /** Count of pending rows awaiting replay (sync-status badge, REQ-D64). */
  countPendingMutations(): Promise<number>;
  /** Count of rows past the retry ceiling (failed-sync error state, REQ-D64). */
  countFailedMutations(): Promise<number>;
  /** Reset failed rows to pending so a manual "sync now" retries them; returns the count requeued. */
  requeueFailedMutations(): Promise<number>;

  // --- id map (clientId -> serverId) ---
  setServerId(clientId: string, serverId: string): Promise<void>;
  loadIdMap(): Promise<Record<string, string>>;

  // --- sync cursor (listChangedSince) ---
  getSyncCursor(): Promise<number>;
  setSyncCursor(cursor: number): Promise<void>;

  // --- last-synced timestamp (sync-status, REQ-D64) ---
  /** Timestamp (ms) of the last successful warm-up pull, or `null` if never synced. */
  getLastSyncedAt(): Promise<number | null>;
  setLastSyncedAt(ts: number): Promise<void>;

  // --- maintenance ---
  /** Wipe everything (sign-out / account switch). Local data is never auto-deleted otherwise. */
  clearAll(): Promise<void>;
}

const CURSOR_KEY = "listChangedSince:cursor";
const LAST_SYNCED_KEY = "sync:lastSyncedAt";

/**
 * In-memory `LocalStore`. Used by unit tests (jsdom has no IndexedDB) and as a safe fallback during
 * SSR or where IndexedDB is unavailable. Behaviour mirrors the IndexedDB engine exactly so callers
 * are storage-agnostic.
 */
export class InMemoryLocalStore implements LocalStore {
  private readonly queryCache = new Map<string, StoredQueryCache>();
  private readonly entityRows = new Map<string, StoredEntityRow>();
  private readonly mutations = new Map<
    number,
    PendingMutation & { status: string; createdAt: number }
  >();
  private readonly idMap = new Map<string, string>();
  private readonly meta = new Map<string, string>();
  private nextMutationId = 1;

  private rowKey(table: string, id: string): string {
    return `${table}\u0000${id}`;
  }

  async readQueryCache(key: string): Promise<StoredQueryCache | undefined> {
    return this.queryCache.get(key);
  }

  async writeQueryCache(key: string, payloadJson: string): Promise<void> {
    this.queryCache.set(key, { key, payloadJson, fetchedAt: Date.now() });
  }

  async putEntityRow(row: StoredEntityRow): Promise<void> {
    this.entityRows.set(this.rowKey(row.table, row.id), { ...row });
  }

  async deleteEntityRow(table: string, id: string): Promise<void> {
    this.entityRows.delete(this.rowKey(table, id));
  }

  async listEntityRows(): Promise<StoredEntityRow[]> {
    return [...this.entityRows.values()].map((row) => ({ ...row }));
  }

  async enqueueMutation(input: EnqueueMutationInput): Promise<void> {
    // Idempotency key is unique: re-enqueues are ignored (mirrors `INSERT OR IGNORE`).
    for (const row of this.mutations.values()) {
      if (row.idempotency_key === input.idempotencyKey) return;
    }
    const id = this.nextMutationId++;
    this.mutations.set(id, {
      id,
      idempotency_key: input.idempotencyKey,
      fn: input.fn,
      args_json: input.argsJson,
      retry_count: 0,
      client_id: input.clientId,
      status: "pending",
      createdAt: Date.now(),
    });
  }

  async listPendingMutations(limit = 100): Promise<PendingMutation[]> {
    return [...this.mutations.values()]
      .filter((row) => row.status === "pending")
      .sort((a, b) => a.id - b.id)
      .slice(0, limit)
      .map(({ id, idempotency_key, fn, args_json, retry_count, client_id }) => ({
        id,
        idempotency_key,
        fn,
        args_json,
        retry_count,
        client_id,
      }));
  }

  async deleteMutation(id: number): Promise<void> {
    this.mutations.delete(id);
  }

  async bumpMutationRetry(id: number): Promise<void> {
    const row = this.mutations.get(id);
    if (row) row.retry_count += 1;
  }

  async failMutation(id: number): Promise<void> {
    const row = this.mutations.get(id);
    if (row) row.status = "failed";
  }

  async countPendingMutations(): Promise<number> {
    let n = 0;
    for (const row of this.mutations.values()) if (row.status === "pending") n += 1;
    return n;
  }

  async countFailedMutations(): Promise<number> {
    let n = 0;
    for (const row of this.mutations.values()) if (row.status === "failed") n += 1;
    return n;
  }

  async requeueFailedMutations(): Promise<number> {
    let n = 0;
    for (const row of this.mutations.values()) {
      if (row.status === "failed") {
        row.status = "pending";
        row.retry_count = 0;
        n += 1;
      }
    }
    return n;
  }

  async setServerId(clientId: string, serverId: string): Promise<void> {
    this.idMap.set(clientId, serverId);
  }

  async loadIdMap(): Promise<Record<string, string>> {
    return Object.fromEntries(this.idMap);
  }

  async getSyncCursor(): Promise<number> {
    const raw = this.meta.get(CURSOR_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async setSyncCursor(cursor: number): Promise<void> {
    this.meta.set(CURSOR_KEY, String(cursor));
  }

  async getLastSyncedAt(): Promise<number | null> {
    const raw = this.meta.get(LAST_SYNCED_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  async setLastSyncedAt(ts: number): Promise<void> {
    this.meta.set(LAST_SYNCED_KEY, String(ts));
  }

  async clearAll(): Promise<void> {
    this.queryCache.clear();
    this.entityRows.clear();
    this.mutations.clear();
    this.idMap.clear();
    this.meta.clear();
    this.nextMutationId = 1;
  }
}
