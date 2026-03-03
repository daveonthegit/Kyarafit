/**
 * React hook that keeps SQLite in sync with Convex for signed-in users.
 *
 * Pull: subscribes to Convex data via useQuery and writes arriving data to
 *       SQLite so the app works offline after the first successful sync.
 *
 * Push: processes the local outbox (mutations made while offline or before
 *       sign-in) by calling Convex mutations.  Runs on sign-in and whenever
 *       the app returns to the foreground.
 */

import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useQuery, useConvex } from "convex/react";
import { api } from "convex/_generated/api";
import {
  pushToConvex,
  pullClosetItems,
  pullBuilds,
  pullConventions,
  type ConvexClosetItem,
  type ConvexBuildWithDetails,
  type ConvexConventionWithDetails,
} from "../services/convexSync";
import { getPendingCount } from "../storage/outboxRepo";

export interface SyncState {
  syncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  errors: string[];
}

export function useConvexSync(userId: string | null): SyncState {
  const client = useConvex();
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const pushingRef = useRef(false);

  // ── Subscribe to Convex data (pull direction) ──────────────────────────────
  const closetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip");
  const buildsWithDetails = useQuery(api.builds.listWithDetails, userId ? { userId } : "skip");
  const conventionsWithDetails = useQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );

  // Pull: write closet items to SQLite when Convex data arrives/changes
  useEffect(() => {
    if (!closetItems || !userId) return;
    pullClosetItems(closetItems as ConvexClosetItem[]).catch((e) =>
      console.warn("[convexSync] pull closet:", e)
    );
  }, [closetItems, userId]);

  // Pull: write builds to SQLite
  useEffect(() => {
    if (!buildsWithDetails || !userId) return;
    pullBuilds(buildsWithDetails as ConvexBuildWithDetails[]).catch((e) =>
      console.warn("[convexSync] pull builds:", e)
    );
  }, [buildsWithDetails, userId]);

  // Pull: write conventions (with plans + packing) to SQLite
  useEffect(() => {
    if (!conventionsWithDetails || !userId) return;
    pullConventions(conventionsWithDetails as ConvexConventionWithDetails[]).catch((e) =>
      console.warn("[convexSync] pull conventions:", e)
    );
  }, [conventionsWithDetails, userId]);

  // ── Push direction ─────────────────────────────────────────────────────────

  const runPush = async () => {
    if (!userId || pushingRef.current) return;
    pushingRef.current = true;
    setSyncing(true);
    try {
      const count = await getPendingCount();
      setPendingCount(count);
      if (count > 0) {
        const result = await pushToConvex(client, userId);
        if (result.errors.length > 0) {
          setErrors(result.errors);
          console.warn("[convexSync] push errors:", result.errors);
        } else {
          setErrors([]);
        }
        const remaining = await getPendingCount();
        setPendingCount(remaining);
      }
      setLastSyncedAt(new Date());
    } catch (e) {
      console.warn("[convexSync] push failed:", e);
    } finally {
      setSyncing(false);
      pushingRef.current = false;
    }
  };

  // Push on sign-in
  useEffect(() => {
    if (userId) {
      runPush();
    } else {
      // Clear sync state when signed out
      setPendingCount(0);
      setLastSyncedAt(null);
      setErrors([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Push when app comes back to foreground
  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runPush();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Periodically update pending count display
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
    }, 10_000);
    return () => clearInterval(interval);
  }, [userId]);

  return { syncing, pendingCount, lastSyncedAt, errors };
}
