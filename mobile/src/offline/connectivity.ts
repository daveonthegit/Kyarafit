/**
 * Process-wide connectivity flag for the offline layer. Updated by the NetInfo listener in
 * `ReplicaProvider`; read by `useOfflineMutation` to fail online-only actions fast while offline,
 * and by managed sync to wait for a connection.
 *
 * Defaults to `true` so that before NetInfo has reported — or on platforms where it is
 * unavailable — online actions behave exactly like a plain Convex call (no regression).
 */
let online = true;

export function setOfflineConnectivity(isOnline: boolean): void {
  online = isOnline;
}

export function getIsOnline(): boolean {
  return online;
}
