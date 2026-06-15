import { useEffect, useMemo } from "react";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import { readOfflineQueryCache, writeOfflineQueryCache } from "./queryCache";

/**
 * Offline-aware drop-in for Convex `useQuery` (stale-while-revalidate).
 *
 * - **Online / signed-in:** behaviour is identical to `useQuery` — the live Convex result is
 *   returned and additionally written through to the SQLite query cache.
 * - **Loading / offline:** while the live result is still `undefined`, the last cached snapshot
 *   for the same query+args is returned instead, so screens paint immediately and keep working
 *   offline. When there is no cached snapshot it returns `undefined`, exactly like `useQuery`.
 *
 * Cache access is best-effort and never throws, so this is a safe, additive replacement: with no
 * cached data it is indistinguishable from a plain `useQuery`.
 */
export function useOfflineQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const live = useQuery(query, ...args);

  const key = useMemo(() => {
    try {
      return offlineQueryKey(getFunctionName(query), args[0]);
    } catch {
      return null;
    }
    // `args` is a fresh array each render but its contents are the cache inputs; re-deriving the
    // key is cheap and the resulting string is stable by value across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, args[0]]);

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

  return live !== undefined ? live : cached;
}
