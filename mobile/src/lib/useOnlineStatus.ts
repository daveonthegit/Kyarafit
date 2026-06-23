import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { getIsOnline, setOfflineConnectivity } from "@/offline/connectivity";

function isOnlineFromState(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Reactive view of the process-wide connectivity flag tracked in `offline/connectivity.ts`.
 *
 * Online-only surfaces (social, groups, billing — REQ-082/101) use this to decide whether to show
 * an offline banner. Seeds from the shared `getIsOnline()` flag so the first paint matches whatever
 * the `SyncWorkerProvider` NetInfo listener has already recorded, then keeps both the local React
 * state and the shared flag in sync as connectivity changes. We never gate local-first work on this.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => getIsOnline());

  useEffect(() => {
    let cancelled = false;

    const apply = (next: boolean) => {
      if (cancelled) return;
      setOfflineConnectivity(next);
      setOnline(next);
    };

    void NetInfo.fetch()
      .then((state) => apply(isOnlineFromState(state)))
      .catch(() => {
        /* leave connectivity at its current value; the listener will correct it */
      });

    const unsubscribe = NetInfo.addEventListener((state) => apply(isOnlineFromState(state)));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return online;
}
