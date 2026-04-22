import { useEffect, useState } from "react";
import { getOfflineDb } from "./db";

/** Reactive count of pending mutation_queue rows (ConnectivityBanner / dev offline lab). */
export function usePendingQueueCount(): number {
  const [n, setN] = useState(0);

  useEffect(() => {
    const tick = () => {
      try {
        const db = getOfflineDb();
        const row = db.getFirstSync<{ c: number }>(
          `SELECT COUNT(*) as c FROM mutation_queue WHERE status = 'pending'`
        );
        setN(row?.c ?? 0);
      } catch {
        setN(0);
      }
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  return n;
}
