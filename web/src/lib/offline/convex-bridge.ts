/**
 * Named entry points for offline-aware data (web mirror of mobile's `convex-bridge`).
 *
 * `useOfflineQuery` reads through the local query cache (stale-while-revalidate) + optimistic overlay
 * so Offline Core screens paint instantly and survive going offline. `useOfflineMutation` calls
 * Convex directly when online and enqueues for replay when offline; the sync worker drains the queue
 * on reconnect (paid + signed-in only).
 *
 * This module is the designated online path; importing `convex/react` here is allowed.
 */
export { useOfflineQuery } from "./useOfflineQuery";
export { useOfflineMutation } from "./useOfflineMutation";
