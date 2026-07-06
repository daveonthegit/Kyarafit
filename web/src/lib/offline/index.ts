/**
 * Public barrel for the web local-first offline runtime (DATA_AND_SYNC.md §5/§6).
 *
 * Screens consume `useOfflineQuery` / `useOfflineMutation`; the app shell mounts `SyncWorkerProvider`.
 * The `LocalStore` interface + engines are exported so the durable backend stays swappable
 * (IndexedDB today, OPFS + wa-sqlite later) without touching callers.
 */
export { useOfflineQuery } from "./useOfflineQuery";
export { useOfflineMutation } from "./useOfflineMutation";
export { SyncWorkerProvider } from "./SyncWorkerProvider";
export { offlineRuntime } from "./runtime";
export { getIsOnline, setOfflineConnectivity } from "./connectivity";
export {
  drainMutationQueue,
  warmEntityRows,
  syncNow,
  uploadLocalImages,
  runBackfill,
} from "./syncWorker";
export {
  runUpgradeBackfill,
  IDLE_BACKFILL,
  BACKFILL_TABLES,
  type BackfillProgress,
  type BackfillDeps,
} from "./backfill";
export { useSyncStatus, type SyncStatus } from "./useSyncStatus";
export {
  InMemoryLocalStore,
  type LocalStore,
  type PendingMutation,
  type StoredEntityRow,
  type StoredQueryCache,
} from "./localStore";
export { IndexedDbLocalStore } from "./indexedDbStore";
export { WaSqliteLocalStore, isWaSqliteOpfsSupported } from "./waSqliteStore";
export {
  createBrowserLocalStore,
  selectLocalStoreEngine,
  type EngineCapabilities,
  type EngineSelectionDeps,
} from "./engineSelection";
