import { useMemo } from "react";
import { useCurrentUser } from "./useCurrentUser";

/**
 * Centralizes signed-in vs local-only mode for Convex + SQLite dual paths.
 * Use `userQueryArgs` with `useQuery(api.*, userQueryArgs)` when the query only needs `{ userId }`.
 */
export function useDataSource() {
  const { userId, isLoading } = useCurrentUser();

  return useMemo(
    () => ({
      userId,
      /** True when signed in — Convex is the source of truth. */
      isCloud: userId != null,
      /** True when browsing without an account — SQLite repos apply. */
      isLocalOnly: userId == null,
      isLoadingUser: isLoading,
      /**
       * Typical Convex list/query args: `{ userId }` or `"skip"` when local-only.
       * For queries that need more fields, build args manually and still use `userId ? ... : "skip"`.
       */
      userQueryArgs: userId ? ({ userId } as const) : ("skip" as const),
    }),
    [userId, isLoading]
  );
}
