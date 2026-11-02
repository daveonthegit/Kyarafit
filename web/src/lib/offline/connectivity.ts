/**
 * Process-wide connectivity flag for the offline layer. Updated by `SyncWorkerProvider` (browser
 * `online`/`offline` events); read by `useOfflineMutation` to decide whether to call Convex directly
 * (online) or enqueue for later replay (offline).
 *
 * Defaults to `true` so before any event has fired — or on platforms without the events —
 * mutations behave exactly like a plain Convex call (no regression).
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
let online = true;

export function setOfflineConnectivity(isOnline: boolean): void {
  online = isOnline;
}

export function getIsOnline(): boolean {
  return online;
}
