import { type ReactNode, useEffect } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useConvex, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { useTier } from "@/lib/useTier";
import { enforceOfflineStorageCaps, getOfflineDb, pruneOfflineTombstones } from "./db";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, uploadLocalImages, warmEntityRows } from "./syncWorker";

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
 *
 * The Convex-facing sync worker (queue drain **and** warm-up pull) is a paid, cloud feature: it
 * runs only when the user is signed in **and** on a paid tier (DATA_AND_SYNC.md §6, REQ-D60). The
 * single decision point is the pure `shouldRunSyncWorker(tier, signedIn)` predicate shared with
 * web. A free, signed-in (or signed-out) user therefore makes ZERO Convex personal-data calls —
 * the worker never drains the queue and never performs the warm-up pull (REQ-D10). Local SQLite
 * init, connectivity tracking, and maintenance are device-only and keep running for everyone.
 */
export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier(userId);
  const tier = tierInfo?.tier ?? null;
  const syncEnabled = shouldRunSyncWorker(tier, signedIn);

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
      // REQ-D60 gate: only a paid, signed-in user drains the queue or pulls from Convex. Free /
      // signed-out users still track connectivity and run local maintenance, but the worker never
      // touches Convex personal data (REQ-D10).
      if (syncEnabled && isOnline) {
        // Drain queued offline writes, top up the local store, then mirror local images to cloud.
        void drainMutationQueue(convex)
          .then(() => warmEntityRows(convex))
          .then(() => uploadLocalImages(convex, tier));
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
  }, [convex, syncEnabled, tier]);

  return <>{children}</>;
}
