import { useEffect, useState } from "react";
import { countFailedMutations, countPendingMutations } from "./mutationQueue";
import { getLastSyncedAt } from "./syncCursor";

const POLL_MS = 2000;

/** Reactive count of pending mutation_queue rows (ConnectivityBanner / dev offline lab). */
export function usePendingQueueCount(): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    const tick = () => setN(countPendingMutations());
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return n;
}

/** Observable sync status for the status UI (REQ-D64): pending + failed counts + last-synced. */
export type SyncStatus = {
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
};

/**
 * Reactive sync status polled from the local store, mirroring `usePendingQueueCount`'s cadence.
 * Surfaces the pending badge, the failed-sync error state, and the last-synced timestamp (REQ-D64).
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    const tick = () =>
      setStatus({
        pending: countPendingMutations(),
        failed: countFailedMutations(),
        lastSyncedAt: getLastSyncedAt(),
      });
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return status;
}
