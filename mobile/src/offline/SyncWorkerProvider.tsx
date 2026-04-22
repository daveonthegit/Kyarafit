import { type ReactNode, useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { getOfflineDb } from "./db";

/**
 * Initializes SQLite and subscribes to connectivity (Phase 2 shell).
 * Full FIFO flush + Convex replay lands with feature screens (§3.13.3).
 */
export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      getOfflineDb();
    } catch (e) {
      console.warn("[offline] db init failed", e);
    }
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(() => {
      /* Future: drain mutation_queue when online */
    });
    return () => unsub();
  }, []);

  return <>{children}</>;
}
