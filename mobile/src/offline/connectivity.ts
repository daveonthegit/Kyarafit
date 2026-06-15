/**
 * Process-wide connectivity flag for the offline layer. Updated by the NetInfo listener in
 * `SyncWorkerProvider`; read by `useOfflineMutation` to decide whether to call Convex directly
 * (online) or enqueue for later replay (offline).
 *
 * Defaults to `true` so that before NetInfo has reported — or on platforms where it is
 * unavailable — mutations behave exactly like a plain Convex call (no regression).
 */
let online = true;

export function setOfflineConnectivity(isOnline: boolean): void {
  online = isOnline;
}

export function getIsOnline(): boolean {
  return online;
}
