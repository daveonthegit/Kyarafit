"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useConvexAuth, useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType } from "convex/server";
import { offlineQueryKey } from "@kyarafit/design-system/domain/offlineQueryCache";
import { offlineRuntime } from "./runtime";
import { readLocalAccount } from "@/lib/auth/localAccount";

export function useOfflineQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  const live = useQuery(
    query,
    ...((isAuthenticated ? args : ["skip"]) as OptionalRestArgsOrSkip<Query>)
  );
  const key = args[0] === "skip" ? null : offlineQueryKey(getFunctionName(query), args[0]);
  useSyncExternalStore(
    offlineRuntime.subscribe,
    offlineRuntime.getVersion,
    offlineRuntime.getVersion
  );
  const subject = offlineRuntime.getSubject();
  const matches = subject !== null && subject === readLocalAccount();
  useEffect(() => {
    if (matches && key && live !== undefined) offlineRuntime.writeQueryCache(key, live);
  }, [key, live, matches, subject]);
  if (!matches || key === null) return undefined;
  return live !== undefined
    ? live
    : (offlineRuntime.readQueryCacheSync(key) as FunctionReturnType<Query> | undefined);
}
