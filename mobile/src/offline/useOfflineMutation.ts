import { useCallback } from "react";
import { useConvex } from "convex/react";
import {
  getFunctionName,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs,
} from "convex/server";
import { getIsOnline } from "./connectivity";
import { enqueueMutation } from "./mutationQueue";
import { newIdempotencyKey } from "./idempotencyKey";
import { isOnlineOnlyMutation } from "./onlineOnlyMutations";

/**
 * Offline-aware drop-in for Convex `useMutation`.
 *
 * - **Online:** behaviour is identical to `useMutation` — the Convex mutation is awaited and its
 *   real result is returned.
 * - **Offline:** the call is appended to the SQLite mutation queue and resolves optimistically
 *   (`undefined`); the Sync Worker replays it on reconnect. Note the offline result has no server
 *   id yet, so offline create-then-reference flows are limited until the `clientId`/`id_map` slice
 *   lands — but the online path (the common case) is unchanged.
 * - **Online-only mutations** (e.g. `files.generateUploadUrl`, which mints a one-time URL that only
 *   makes sense against a live server) are never queued: they always call Convex directly, so
 *   offline they fail exactly like a plain Convex call rather than resolving to `undefined`.
 */
export function useOfflineMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
): (...args: OptionalRestArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const convex = useConvex();
  return useCallback(
    async (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      let name: string | null = null;
      try {
        name = getFunctionName(mutation);
      } catch {
        name = null;
      }

      if (getIsOnline() || (name != null && isOnlineOnlyMutation(name))) {
        return convex.mutation(mutation, ...args);
      }

      if (name != null) {
        try {
          enqueueMutation(name, args[0], newIdempotencyKey());
        } catch {
          // Best-effort enqueue; ignore.
        }
      }
      return undefined as FunctionReturnType<Mutation>;
    },
    [convex, mutation]
  );
}
