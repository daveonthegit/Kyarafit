import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import { getVaultDataVersion, getVaultState, subscribeVault } from "@/vault/activeVault";
import { hasLocalQuery, runLocalQuery } from "@/vault/functions";
import { readOfflineQueryCache, writeOfflineQueryCache } from "./queryCache";

const CURRENT_USER_FN = "auth:getCurrentUser";

/**
 * The one read hook for screens.
 *
 * - **Personal data** (every function registered in `@/vault/handlers`): answered by the local
 *   vault, synchronously, for every user — online or offline, free or paid. Convex is never asked
 *   (the underlying `useQuery` is always `"skip"`), so a free user makes zero personal-data calls and
 *   an offline cold start renders immediately. The result re-derives on every committed vault write.
 * - **`auth:getCurrentUser`**: the unlocked vault's account (subject/name/email/image), so screens
 *   keep their user id offline and after a session token expires.
 * - **Online surfaces** (social, groups, public pages, billing): the live Convex result, with the last
 *   cached snapshot returned while loading/offline.
 */
export function useOfflineQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const fnName = useMemo(() => {
    try {
      return getFunctionName(query);
    } catch {
      return null;
    }
  }, [query]);

  const isLocal = fnName != null && (fnName === CURRENT_USER_FN || hasLocalQuery(fnName));
  const skipped = args[0] === "skip";

  const live = useQuery(
    query,
    ...((isLocal ? ["skip"] : args) as unknown as OptionalRestArgsOrSkip<Query>)
  );

  const vaultVersion = useSyncExternalStore(
    subscribeVault,
    getVaultDataVersion,
    getVaultDataVersion
  );

  // Stable-by-value key for the args (a fresh object each render).
  const argsKey = useMemo(() => {
    if (skipped) return "skip";
    try {
      return JSON.stringify(args[0] ?? {});
    } catch {
      return String(Math.random());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipped, args[0]]);

  const cacheKey = useMemo(() => {
    if (isLocal || fnName == null || skipped) return null;
    return offlineQueryKey(fnName, args[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, fnName, argsKey]);

  useEffect(() => {
    if (cacheKey != null && live !== undefined) writeOfflineQueryCache(cacheKey, live);
  }, [cacheKey, live]);

  return useMemo(() => {
    if (isLocal) {
      if (skipped) return undefined;
      const state = getVaultState();
      if (fnName === CURRENT_USER_FN) {
        if (state.status !== "unlocked") return undefined;
        const { account } = state;
        return {
          subject: account.subject,
          tokenIdentifier: account.subject,
          name: account.name ?? undefined,
          email: account.email ?? undefined,
          pictureUrl: account.image ?? undefined,
        } as FunctionReturnType<Query>;
      }
      if (state.status !== "unlocked") return undefined;
      return runLocalQuery(fnName as string, args[0]) as FunctionReturnType<Query>;
    }
    if (live !== undefined) return live;
    return cacheKey != null
      ? (readOfflineQueryCache(cacheKey) as FunctionReturnType<Query> | undefined)
      : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocal, skipped, fnName, argsKey, vaultVersion, live, cacheKey]);
}
