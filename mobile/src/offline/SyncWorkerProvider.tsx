import { type ReactNode, useEffect, useRef } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useConvex } from "convex/react";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { useTier } from "@/lib/useTier";
import { useVaultState } from "@/vault/hooks";
import { onReplicationRequested, setReplicationEnabled } from "@/vault/replication";
import { enforceOfflineStorageCaps, pruneOfflineTombstones } from "./db";
import { getIsOnline, setOfflineConnectivity } from "./connectivity";
import {
  drainMutationQueue,
  invalidateSyncSession,
  runBackfill,
  uploadLocalImages,
  warmEntityRows,
} from "./syncWorker";

function isOnlineFromState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function runMaintenance(): void {
  enforceOfflineStorageCaps();
  pruneOfflineTombstones();
}

/**
 * Tracks connectivity, runs vault maintenance, and drives PAID cloud sync.
 *
 * The local vault (opened at launch by the root layout) is the source of truth for everyone; this
 * provider never gates reading or writing it. The Convex-facing worker — queue drain, warm-up pull,
 * image mirroring, upgrade backfill — runs only for a signed-in account on a paid tier
 * (`shouldRunSyncWorker`, shared with web), so a free account makes ZERO Convex personal-data calls.
 *
 * The last known paid state is persisted in the vault (`setReplicationEnabled`) so a paid user who
 * launches offline keeps queueing edits for sync before the server re-confirms their tier.
 */
export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const vault = useVaultState();
  const userId = vault.status === "unlocked" ? vault.account.subject : null;
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier(userId);
  const liveTier = tierInfo?.tier ?? null;

  // Persist the server-confirmed tier so offline launches know whether to queue for sync.
  useEffect(() => {
    if (!signedIn || liveTier == null) return;
    try {
      setReplicationEnabled(isPaidConvexTier(liveTier));
    } catch (error) {
      console.warn("[sync] could not persist sync state", error);
    }
  }, [signedIn, liveTier, userId]);

  const syncEnabled = shouldRunSyncWorker(liveTier, signedIn);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled || !syncEnabled || !getIsOnline()) return;
      // Drain queued local writes, top up the vault, mirror local images, then (once) backfill
      // everything created while free.
      void drainMutationQueue(convex)
        .then(() => {
          if (!cancelled) return warmEntityRows(convex);
        })
        .then(() => {
          if (!cancelled) return uploadLocalImages(convex, liveTier);
        })
        .then(() => {
          if (!cancelled) return runBackfill(convex, liveTier);
        })
        .catch((error: unknown) => console.warn("[sync] pass failed", error));
    };
    syncRef.current = sync;

    const apply = (isOnline: boolean) => {
      if (cancelled) return;
      setOfflineConnectivity(isOnline);
      runMaintenance();
      if (isOnline) sync();
    };

    // Establish the real initial state before any drain — never drain on the optimistic default.
    void NetInfo.fetch()
      .then((state) => apply(isOnlineFromState(state)))
      .catch(() => {
        /* leave connectivity at its current value; the listener will correct it */
      });

    const unsubNet = NetInfo.addEventListener((state) => apply(isOnlineFromState(state)));
    const unsubRequests = onReplicationRequested(() => syncRef.current());
    return () => {
      cancelled = true;
      invalidateSyncSession();
      unsubNet();
      unsubRequests();
    };
  }, [convex, syncEnabled, liveTier, userId]);

  return <>{children}</>;
}
