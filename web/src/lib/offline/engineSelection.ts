/**
 * Durable storage engine selection (DATA_AND_SYNC.md §5). A single, well-named async factory chooses
 * the best available `LocalStore` engine for the current environment, so callers stay storage-agnostic
 * behind the `LocalStore` seam:
 *
 *   1. OPFS + wa-sqlite (`WaSqliteLocalStore`) — preferred in capable browsers.
 *   2. IndexedDB (`IndexedDbLocalStore`) — automatic fallback where OPFS is unavailable.
 *   3. In-memory (`InMemoryLocalStore`) — SSR / tests / no durable storage at all.
 *
 * The pure decision logic (`selectLocalStoreEngine`) takes injected dependencies so it can be unit
 * tested with fake capability flags WITHOUT instantiating real wa-sqlite (which cannot run in jsdom).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
import { IndexedDbLocalStore } from "./indexedDbStore";
import { InMemoryLocalStore, type LocalStore } from "./localStore";
import { WaSqliteLocalStore, isWaSqliteOpfsSupported } from "./waSqliteStore";

/** Detected environment capabilities relevant to engine selection. */
export interface EngineCapabilities {
  /** OPFS + synchronous AccessHandle VFS available (wa-sqlite can run here). */
  opfsAvailable: boolean;
}

/** Injectable dependencies for {@link selectLocalStoreEngine} (real wiring or test fakes). */
export interface EngineSelectionDeps {
  detectCapabilities: () => EngineCapabilities;
  createWaSqliteStore: () => Promise<LocalStore>;
  createFallbackStore: () => LocalStore;
}

/**
 * Pure selection logic: prefer wa-sqlite when OPFS is available, else fall back. If wa-sqlite is
 * advertised as available but fails to initialize, degrade gracefully to the fallback engine.
 */
export async function selectLocalStoreEngine(deps: EngineSelectionDeps): Promise<LocalStore> {
  const { opfsAvailable } = deps.detectCapabilities();
  if (opfsAvailable) {
    try {
      return await deps.createWaSqliteStore();
    } catch {
      // OPFS probe passed but the engine failed to open (locked handles, quota, etc.) — fall back.
      return deps.createFallbackStore();
    }
  }
  return deps.createFallbackStore();
}

/** Fallback engine: durable IndexedDB in the browser, in-memory during SSR / tests. */
function createFallbackStore(): LocalStore {
  if (typeof indexedDB !== "undefined") {
    return new IndexedDbLocalStore();
  }
  return new InMemoryLocalStore();
}

/**
 * Production browser factory: wires real capability detection + engine constructors. Call once per
 * session (e.g. from `SyncWorkerProvider`) and hand the result to the offline runtime.
 */
export function createBrowserLocalStore(): Promise<LocalStore> {
  return selectLocalStoreEngine({
    detectCapabilities: () => ({ opfsAvailable: isWaSqliteOpfsSupported() }),
    createWaSqliteStore: async () => {
      const store = new WaSqliteLocalStore();
      await store.init();
      return store;
    },
    createFallbackStore,
  });
}
