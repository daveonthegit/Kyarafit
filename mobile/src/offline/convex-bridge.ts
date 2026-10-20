/**
 * Named entry points for offline-aware data (KFM-026).
 *
 * Personal data reads and writes go to the local vault (`@/vault/functions`); managed sync
 * replicates committed vault rows separately (`@/vault/replica`). Online-only surfaces call Convex
 * directly and fail fast offline.
 */
export { useOfflineQuery } from "./useOfflineQuery";
export { useOfflineMutation } from "./useOfflineMutation";
