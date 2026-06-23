"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks browser connectivity for online-only surfaces (social, groups, billing —
 * see PRODUCT_SPEC.md §5 REQ-082/101). Starts optimistic (`true`) so server render
 * and the first client paint never flash an offline banner, then reconciles with
 * `navigator.onLine` after mount and on the `online`/`offline` events.
 */
export function useIsOnline(): { isOnline: boolean; recheck: () => void } {
  const [isOnline, setIsOnline] = useState(true);

  const recheck = useCallback(() => {
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    recheck();
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [recheck]);

  return { isOnline, recheck };
}
