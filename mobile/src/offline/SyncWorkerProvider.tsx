import { type ReactNode, useEffect } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useConvex } from "convex/react";
import { enforceOfflineStorageCaps, getOfflineDb, pruneOfflineTombstones } from "./db";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, warmEntityRows } from "./syncWorker";

function isOnlineFromState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function runMaintenance(): void {
  try {
    enforceOfflineStorageCaps();
    pruneOfflineTombstones();
  } catch (e) {
    console.warn("[offline] maintenance failed", e);
  }
}

/**
 * Initializes SQLite, tracks connectivity, and drains the offline mutation queue on reconnect.
 * Full SQLite SWR + per-entity reconciliation continues to land incrementally (§3.13).
 */
export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();

  useEffect(() => {
    try {
      getOfflineDb();
    } catch (e) {
      console.warn("[offline] db init failed", e);
    }
    runMaintenance();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Apply the latest connectivity, run bounded maintenance, and drain only when confirmed online.
    const apply = (isOnline: boolean) => {
      if (cancelled) return;
      setOfflineConnectivity(isOnline);
      runMaintenance();
      if (isOnline) {
        // Drain queued offline writes first, then top up the local store from the server.
        void drainMutationQueue(convex).then(() => warmEntityRows(convex));
      }
    };

    // Establish the real initial state before any drain — never drain on the optimistic default.
    void NetInfo.fetch()
      .then((state) => apply(isOnlineFromState(state)))
      .catch(() => {
        /* leave connectivity at its current value; the listener will correct it */
      });

    const unsub = NetInfo.addEventListener((state) => apply(isOnlineFromState(state)));
    return () => {
      cancelled = true;
      unsub();
    };
  }, [convex]);

  return <>{children}</>;
}
