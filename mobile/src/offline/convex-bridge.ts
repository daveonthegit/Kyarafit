/**
 * Named entry points for offline-aware data (KFM-026).
 *
 * `useOfflineQuery` reads through the SQLite query cache (stale-while-revalidate) so Offline Core
 * screens paint instantly and survive going offline. `useOfflineMutation` calls Convex directly
 * when online (unchanged behaviour) and enqueues for replay when offline; the Sync Worker drains
 * the queue on reconnect.
 */
export { useOfflineQuery } from "./useOfflineQuery";
export { useOfflineMutation } from "./useOfflineMutation";
