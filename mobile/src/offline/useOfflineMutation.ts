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
import { newClientId } from "./clientId";
import { isCreateMutation } from "./offlineCreateMutations";
import { isOnlineOnlyMutation } from "./onlineOnlyMutations";

/**
 * Offline-aware drop-in for Convex `useMutation`.
 *
 * - **Online:** behaviour is identical to `useMutation` — the Convex mutation is awaited and its
 *   real result is returned.
 * - **Offline:** the call is appended to the SQLite mutation queue; the Sync Worker replays it on
 *   reconnect. **Create** mutations (`offlineCreateMutations`) resolve to an optimistic stub
 *   `{ _id: <clientId>, ...args }` so callers immediately have a stable id to reference; the worker
 *   maps that client id to the real server id on replay (`./idMap`) and rewrites later queued ops
 *   that referenced it. Other mutations resolve to `undefined`.
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
          if (isCreateMutation(name)) {
            const clientId = newClientId();
            enqueueMutation(name, args[0], newIdempotencyKey(), clientId);
            const input = (args[0] ?? {}) as Record<string, unknown>;
            return { ...input, _id: clientId } as FunctionReturnType<Mutation>;
          }
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
