import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import {
  applyDocOverlay,
  applyListOverlay,
} from "@kyarafit/design-system/domain/offlineEntityOverlay";
import {
  applyPlannerOverlay,
  type PlannerOverlayItem,
} from "@kyarafit/design-system/domain/offlinePlannerOverlay";
import {
  applyBuildTreeOverlay,
  type BuildTreeResult,
} from "@kyarafit/design-system/domain/offlineBuildTreeOverlay";
import { readOfflineQueryCache, writeOfflineQueryCache } from "./queryCache";
import { listPendingEntityRows, listSyncedEntityRows } from "./entityRows";
import { offlineEntityQuery } from "./offlineEntityQueries";
import { getOverlayVersion, subscribeOverlay } from "./entityOverlayStore";
import { getIsOnline } from "./connectivity";

/**
 * Offline-aware drop-in for Convex `useQuery` (stale-while-revalidate + optimistic overlay).
 *
 * - **Online / signed-in:** behaviour matches `useQuery` — the live Convex result is returned and
 *   written through to the SQLite query cache.
 * - **Loading / offline:** while the live result is still `undefined`, the last cached snapshot for
 *   the same query+args is returned instead, so screens paint immediately and keep working offline.
 * - **Optimistic overlay:** for registered plain-document queries (`offlineEntityQuery` — builds /
 *   conventions lists + detail), pending offline writes from `entity_rows` are merged onto the
 *   result so create/edit/delete show before they sync. With no pending writes the result is
 *   returned unchanged, so this stays a safe, additive replacement.
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
    return offlineQueryKey(fnName, args[0]);
    // `args` is a fresh array each render but its contents are the cache inputs; re-deriving the
    // key is cheap and the resulting string is stable by value across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnName, args[0]]);

  useEffect(() => {
    if (key != null && live !== undefined) {
      writeOfflineQueryCache(key, live);
    }
  }, [key, live]);

  const cached = useMemo(() => {
    if (key != null && live === undefined) {
      return readOfflineQueryCache(key) as FunctionReturnType<Query> | undefined;
    }
    return undefined;
  }, [key, live]);

  const base = live !== undefined ? live : cached;

  // Re-read pending overlays whenever an offline write (or a drain that clears one) bumps the store.
  const overlayVersion = useSyncExternalStore(
    subscribeOverlay,
    getOverlayVersion,
    getOverlayVersion
  );

  return useMemo(() => {
    const overlay = fnName != null ? offlineEntityQuery(fnName) : null;
    if (overlay == null) return base;
    const pending = listPendingEntityRows(overlay.table);

    if (overlay.kind === "planner") {
      if (pending.length === 0) return base;
      const list = Array.isArray(base) ? (base as PlannerOverlayItem[]) : [];
      const today = new Date().toISOString().slice(0, 10);
      return applyPlannerOverlay(list, pending, today) as FunctionReturnType<Query>;
    }

    if (overlay.kind === "buildTree") {
      if (pending.length === 0 || base == null) return base;
      const buildId = (args[0] as Record<string, unknown> | undefined)?.[overlay.idArg];
      if (typeof buildId !== "string") return base;
      return applyBuildTreeOverlay(
        base as unknown as BuildTreeResult,
        pending,
        buildId
      ) as FunctionReturnType<Query>;
    }

    // Fall back to the synced local store only when offline with no live/cached result (cold
    // start); while online an `undefined` base is a genuine loading state and must be preserved.
    const useLocalBase = base === undefined && !getIsOnline();

    if (overlay.kind === "list") {
      const localBase = useLocalBase
        ? (listSyncedEntityRows(overlay.table) as { _id: string }[])
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
      const local = listSyncedEntityRows(overlay.table).find((row) => row._id === viewedId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, fnName, overlayVersion, args[0]]);
}
