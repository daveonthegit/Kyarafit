"use client";

import { type ReactNode, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime } from "./runtime";
import { createBrowserLocalStore } from "./engineSelection";
import { setOfflineConnectivity } from "./connectivity";

export function SyncWorkerProvider({ children }: { children: ReactNode }) {
  const { userId } = useCurrentUser();
  useEffect(() => {
    let cancelled = false;
    offlineRuntime.lock();
    if (userId)
      void (async () => {
        const store = await createBrowserLocalStore(userId);
        if (cancelled) return;
        offlineRuntime.setStore(store, userId);
        await offlineRuntime.hydrate();
      })().catch((error: unknown) => console.error("Local vault could not open", error));
    return () => {
      cancelled = true;
      offlineRuntime.lock();
    };
  }, [userId]);
  useEffect(() => {
    const online = () => setOfflineConnectivity(true);
    const offline = () => setOfflineConnectivity(false);
    setOfflineConnectivity(navigator.onLine !== false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  return <>{children}</>;
}
