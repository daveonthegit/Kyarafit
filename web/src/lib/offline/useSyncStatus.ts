"use client";

import { useEffect, useState } from "react";
import { offlineRuntime } from "./runtime";
import { IDLE_BACKFILL, type BackfillProgress } from "./backfill";

/** Observable sync status for the status UI (REQ-D64/D95): pending + failed + last-synced + backfill. */
export type SyncStatus = {
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
  /** One-time upgrade-backfill progress (REQ-D95); `running=false` when idle or complete. */
  backfill: BackfillProgress;
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
    backfill: IDLE_BACKFILL,
  });

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const [pending, failed, lastSyncedAt] = await Promise.all([
        offlineRuntime.countPendingMutations(),
        offlineRuntime.countFailedMutations(),
        offlineRuntime.getLastSyncedAt(),
      ]);
      if (active)
        setStatus({
          pending,
          failed,
          lastSyncedAt,
          backfill: offlineRuntime.getBackfillProgress(),
        });
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
