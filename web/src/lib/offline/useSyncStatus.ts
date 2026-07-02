"use client";

import { useEffect, useState } from "react";
import { offlineRuntime } from "./runtime";

/** Observable sync status for the status UI (REQ-D64): pending + failed counts + last-synced. */
export type SyncStatus = {
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
};

const POLL_MS = 2000;

/**
 * Reactive sync status polled from the offline runtime, mirroring mobile's `useSyncStatus`.
 * Surfaces the pending badge, the failed-sync error state, and the last-synced timestamp (REQ-D64).
 * The runtime's queue counters are async (IndexedDB/OPFS), so this polls rather than subscribing.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
  });

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const [pending, failed, lastSyncedAt] = await Promise.all([
        offlineRuntime.countPendingMutations(),
        offlineRuntime.countFailedMutations(),
        offlineRuntime.getLastSyncedAt(),
      ]);
      if (active) setStatus({ pending, failed, lastSyncedAt });
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return status;
}
