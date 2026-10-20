import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useConvex } from "convex/react";
import { isPaidConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { useSession } from "@/lib/auth/client";
import { getBearerToken, subscribeBearerToken } from "@/lib/auth/bearer-storage-plugin";
import { useTier } from "@/lib/useTier";
import { enforceOfflineStorageCaps, pruneOfflineTombstones } from "@/offline/db";
import { getIsOnline, setOfflineConnectivity } from "@/offline/connectivity";
import {
  activeVaultImageDir,
  getActiveReplicator,
  getActiveVaultSql,
  subscribeVault,
} from "../activeVault";
import { useVaultState } from "../hooks";
import { flushPublicationRemovals } from "../publications";
import { syncReplicaAssets } from "./assets";
import { convexReplicaTransport, timedConvexClient } from "./convexTransport";
import { deviceReplicaAssetIo } from "./deviceAssets";
import { ReplicaScheduler } from "./scheduler";

function isOnlineFromState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

let activeScheduler: ReplicaScheduler | null = null;

/** Manual "Sync now" (Settings). Resolves when the pass is done; a no-op when sync can't run. */
export function syncNow(): Promise<void> {
  return activeScheduler?.run() ?? Promise.resolve();
}

/**
 * Tracks connectivity, runs vault maintenance, and drives managed sync (Kyarafit Cloud).
 *
 * The local vault is the source of truth for everyone; this provider never gates reading or
 * writing it. Row sync runs only for the vault's own signed-in account on a paid tier, so a free
 * account makes zero personal-data calls. The first confirmed paid session turns replication on
 * for the vault (queueing every row the cloud has never seen); a lapsed plan pauses it without
 * discarding anything.
 */
export function ReplicaProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const vault = useVaultState();
  const userId = vault.status === "unlocked" ? vault.account.subject : null;
  const remote = useSession();
  const credential = useSyncExternalStore(subscribeBearerToken, getBearerToken, getBearerToken);
  const signedIn = Boolean(
    credential && userId && !remote.isPending && remote.data?.user?.id === userId
  );
  const { data: tierInfo } = useTier(signedIn ? userId : null);
  const entitled = isPaidConvexTier(tierInfo?.tier ?? null);
  const replicator = useSyncExternalStore(subscribeVault, getActiveReplicator, getActiveReplicator);
  const live = useRef({ signedIn, entitled });
  live.current = { signedIn, entitled };

  // Bind (or unbind) this vault's replicator to the signed-in session.
  useEffect(() => {
    if (!replicator || !userId) return;
    replicator.setTransport(
      signedIn ? convexReplicaTransport(convex, { subject: userId, isOnline: getIsOnline }) : null
    );
  }, [replicator, signedIn, convex, userId, credential]);

  // First confirmed paid session on this vault: start replicating it.
  useEffect(() => {
    if (replicator && signedIn && entitled && !replicator.enabled) {
      try {
        replicator.enableReplication();
      } catch (error) {
        console.warn("[sync] could not enable sync for this vault", error);
      }
    }
  }, [replicator, signedIn, entitled]);

  useEffect(() => {
    if (!userId) return;
    const scheduler = new ReplicaScheduler(replicator, {
      canSync: () => live.current.signedIn && getIsOnline(),
      isEntitled: () => live.current.entitled,
      afterPass: async (synced) => {
        const client = timedConvexClient(convex);
        const sql = getActiveVaultSql();
        if (!sql || getActiveReplicator() !== replicator) return;
        if (synced && replicator) {
          const imageDir = activeVaultImageDir();
          if (imageDir) {
            await syncReplicaAssets(
              sql,
              deviceReplicaAssetIo(client, userId, imageDir),
              () => getActiveReplicator() === replicator && getIsOnline()
            );
          }
        }
        // Publication removals apply to every tier (publishing is free).
        await flushPublicationRemovals(client, sql);
      },
    });
    activeScheduler = scheduler;

    const apply = (isOnline: boolean) => {
      const wasOnline = getIsOnline();
      setOfflineConnectivity(isOnline);
      enforceOfflineStorageCaps();
      pruneOfflineTombstones();
      if (isOnline && !wasOnline) void scheduler.run();
    };
    // Establish the real connectivity before the first pass — never sync on the optimistic default.
    void NetInfo.fetch()
      .then((state) => {
        setOfflineConnectivity(isOnlineFromState(state));
        enforceOfflineStorageCaps();
        void scheduler.run();
      })
      .catch(() => {
        /* the listener corrects connectivity */
      });
    const unsubscribeNet = NetInfo.addEventListener((state) => apply(isOnlineFromState(state)));
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") scheduler.request();
    });
    // A deleted published row queues removal of its server copy (any tier): flush it soon.
    const unsubscribeVault = subscribeVault(() => {
      const sql = getActiveVaultSql();
      try {
        if (sql?.getFirstSync("SELECT 1 AS c FROM publish_removals LIMIT 1")) scheduler.request();
      } catch {
        /* vault locked mid-notification */
      }
    });
    // Every committed local change (and every sync state change) asks for a pass soon.
    let lastPending = replicator?.pendingCount() ?? 0;
    const unsubscribeReplicator = replicator?.subscribe(() => {
      const pending = replicator.pendingCount();
      if (pending > lastPending) scheduler.request();
      lastPending = pending;
    });
    return () => {
      if (activeScheduler === scheduler) activeScheduler = null;
      scheduler.dispose();
      unsubscribeNet();
      unsubscribeVault();
      appState.remove();
      unsubscribeReplicator?.();
    };
  }, [convex, replicator, userId]);

  // Becoming signed in or entitled is itself a trigger.
  useEffect(() => {
    if (signedIn) activeScheduler?.request();
  }, [signedIn, entitled]);

  return <>{children}</>;
}
