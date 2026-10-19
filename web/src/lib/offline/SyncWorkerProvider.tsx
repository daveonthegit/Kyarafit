"use client";

import { type ReactNode, useEffect } from "react";
import { useConvex } from "convex/react";
import { shouldRunSyncWorker } from "@kyarafit/design-system/domain/syncPolicy";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTier } from "@/lib/api/useTier";
import { offlineRuntime } from "./runtime";
import { createBrowserLocalStore } from "./engineSelection";
import { setOfflineConnectivity } from "./connectivity";
import { drainMutationQueue, runBackfill, uploadLocalImages, warmEntityRows } from "./syncWorker";

/**
 * Wires the web local-first runtime and gates the Convex-facing sync worker.
 *
 * The sync worker (queue drain + warm-up pull) is a paid, cloud feature: it runs ONLY when the user
 * is signed in AND on a paid tier (DATA_AND_SYNC.md §6, REQ-D60). The single decision point is the
 * pure `shouldRunSyncWorker(tier, signedIn)` predicate shared with mobile. A free or signed-out user
 * therefore makes ZERO Convex personal-data calls — the worker never drains the queue and never
 * performs the warm-up pull (REQ-D10). Local store init + connectivity tracking run for everyone.
 *
 * Mounted app-wide (see `AppProviders`) but inert for free/signed-out users.
 */
export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { userId } = useCurrentUser();
  const signedIn = userId !== null;
  const { data: tierInfo } = useTier();
  const tier = tierInfo?.tier ?? null;
  const syncEnabled = shouldRunSyncWorker(tier, signedIn);

  // Select the best durable engine in the browser (OPFS + wa-sqlite, else IndexedDB), then hydrate
  // the in-memory mirror from it once. SSR/tests keep the default in-memory store.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      offlineRuntime.lock();
      if (!userId) return;
      const store = await createBrowserLocalStore(userId);
      if (cancelled) return;
      offlineRuntime.setStore(store, userId);
      await offlineRuntime.hydrate();
      if (!cancelled && syncEnabled && navigator.onLine !== false) {
        await drainMutationQueue(convex);
        if (!cancelled) await warmEntityRows(convex);
        if (!cancelled) await uploadLocalImages(convex, tier);
        if (!cancelled) await runBackfill(convex, tier);
      }
    })().catch((error: unknown) => console.error("Local vault could not open", error));
    return () => {
      cancelled = true;
      offlineRuntime.lock();
    };
  }, [userId, convex, syncEnabled, tier]);

  useEffect(() => {
    let cancelled = false;

    const apply = (isOnline: boolean) => {
      if (cancelled) return;
      setOfflineConnectivity(isOnline);
      // REQ-D60 gate: only a paid, signed-in user drains the queue or pulls from Convex. Free /
      // signed-out users still track connectivity, but the worker never touches Convex (REQ-D10).
      if (syncEnabled && isOnline && userId && offlineRuntime.getSubject() === userId) {
        void drainMutationQueue(convex)
          .then(() => {
            if (!cancelled) return warmEntityRows(convex);
          })
          .then(() => {
            if (!cancelled) return uploadLocalImages(convex, tier);
          })
          // REQ-D95: one-time upgrade backfill of rows created while FREE (idempotent; marked done).
          .then(() => {
            if (!cancelled) return runBackfill(convex, tier);
          })
          .catch((error: unknown) => console.error("Sync stopped", error));
      }
    };

    apply(typeof navigator !== "undefined" ? navigator.onLine !== false : true);

    const handleOnline = () => apply(true);
    const handleOffline = () => apply(false);
    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [convex, syncEnabled, tier, userId]);

  return <>{children}</>;
}
