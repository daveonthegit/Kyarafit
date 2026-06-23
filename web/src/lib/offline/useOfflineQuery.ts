"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import {
  applyDocOverlay,
  applyListOverlay,
} from "@kyarafit/design-system/domain/offlineEntityOverlay";
import { offlineRuntime } from "./runtime";
import { offlineEntityQuery } from "./offlineEntityQueries";
import { getIsOnline } from "./connectivity";

/**
 * Offline-aware drop-in for Convex `useQuery` (stale-while-revalidate + optimistic overlay). The web
 * mirror of mobile's `useOfflineQuery`.
 *
 * - **Online / signed-in:** behaviour matches `useQuery` — the live Convex result is returned and
 *   written through to the local query cache (`runtime`).
 * - **Loading / offline:** while the live result is still `undefined`, the last cached snapshot for
 *   the same query+args is returned instead, so screens paint immediately and keep working offline.
 * - **Optimistic overlay:** for registered plain-document queries (`offlineEntityQuery` — the
 *   migrated Builds list), pending offline writes from the runtime overlay are merged onto the
 *   result so create/edit/delete show before they sync. With no pending writes the result is
 *   returned unchanged, so this stays a safe, additive replacement.
 *
 * This is the BRIDGE — the designated online path that is allowed to import `convex/react`.
 */
export function useOfflineQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const live = useQuery(query, ...args);

  const fnName = useMemo(() => {
    try {
      return getFunctionName(query);
    } catch {
      return null;
    }
  }, [query]);

  const key = useMemo(() => {
    if (fnName == null) return null;
    // `args` is a fresh array each render but its contents are the cache inputs; re-deriving the key
    // is cheap and the resulting string is stable by value across renders.
    return offlineQueryKey(fnName, args[0]);
  }, [fnName, args[0]]);

  // Persist each live result so the same query+args can paint offline next time.
  useEffect(() => {
    if (key != null && live !== undefined) {
      offlineRuntime.writeQueryCache(key, live);
    }
  }, [key, live]);

  // Re-read pending overlays whenever an offline write (or a drain that clears one) bumps the runtime.
  const version = useSyncExternalStore(
    offlineRuntime.subscribe,
    offlineRuntime.getVersion,
    offlineRuntime.getVersion
  );

  return useMemo(() => {
    const cached =
      key != null && live === undefined
        ? (offlineRuntime.readQueryCacheSync(key) as FunctionReturnType<Query> | undefined)
        : undefined;
    const base = live !== undefined ? live : cached;

    const overlay = fnName != null ? offlineEntityQuery(fnName) : null;
    if (overlay == null) return base;
    const pending = offlineRuntime.listPendingEntityRowsSync(overlay.table);

    // Fall back to the synced local store only when offline with no live/cached result (cold start);
    // while online an `undefined` base is a genuine loading state and must be preserved.
    const useLocalBase = base === undefined && !getIsOnline();

    if (overlay.kind === "list") {
      const localBase = useLocalBase
        ? (offlineRuntime.listSyncedEntityRowsSync(overlay.table) as { _id: string }[])
        : undefined;
      if (pending.length === 0) {
        return (localBase ?? base) as FunctionReturnType<Query>;
      }
      const list = Array.isArray(base) ? base : (localBase ?? []);
      return applyListOverlay(list as { _id: string }[], pending) as FunctionReturnType<Query>;
    }

    const viewedId = (args[0] as Record<string, unknown> | undefined)?.[overlay.idArg];
    let docBase = base as { _id: string } | null | undefined;
    if (useLocalBase && typeof viewedId === "string") {
      const local = offlineRuntime
        .listSyncedEntityRowsSync(overlay.table)
        .find((row) => (row as { _id?: string })._id === viewedId);
      if (local) docBase = local as { _id: string };
    }
    if (pending.length === 0) {
      return (docBase ?? base) as FunctionReturnType<Query>;
    }
    return applyDocOverlay(
      docBase,
      pending,
      typeof viewedId === "string" ? viewedId : undefined
    ) as FunctionReturnType<Query>;
  }, [key, live, fnName, version, args[0]]);
}
