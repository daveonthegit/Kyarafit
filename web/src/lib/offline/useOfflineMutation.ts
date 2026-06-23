"use client";

import { useCallback } from "react";
import { useConvex } from "convex/react";
import {
  getFunctionName,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs,
} from "convex/server";
import { getIsOnline } from "./connectivity";
import { offlineRuntime } from "./runtime";
import { newIdempotencyKey } from "./idempotencyKey";
import { newClientId } from "./clientId";
import { isCreateMutation } from "./offlineCreateMutations";
import { overlayWritesFor } from "./offlineEntityWrites";
import { isOnlineOnlyMutation } from "./onlineOnlyMutations";

/**
 * Offline-aware drop-in for Convex `useMutation`. The web mirror of mobile's `useOfflineMutation`.
 *
 * - **Online:** behaviour is identical to `useMutation` — the Convex mutation is awaited and its real
 *   result is returned.
 * - **Offline:** the call is appended to the local mutation queue; the sync worker replays it on
 *   reconnect. **Create** mutations (`offlineCreateMutations`) resolve to an optimistic stub
 *   `{ _id: <clientId>, ...args }` so callers immediately have a stable id; the worker maps that
 *   client id to the real server id on replay and rewrites later queued ops that referenced it.
 *   Other mutations resolve to `undefined`. Pending writes are mirrored into the runtime overlay so
 *   registered list/detail queries reflect them immediately.
 * - **Online-only mutations** (e.g. `files:generateUploadUrl`) are never queued: they always call
 *   Convex directly, so offline they fail exactly like a plain Convex call.
 *
 * This is the BRIDGE — the designated online path that is allowed to import `convex/react`.
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
          const isCreate = isCreateMutation(name);
          const clientId = isCreate ? newClientId() : undefined;
          await offlineRuntime.enqueueMutation(name, args[0], newIdempotencyKey(), clientId);

          // Optimistic visibility: mirror the write into the overlay so registered list/detail
          // queries reflect it immediately (cleared by the sync worker once it replays).
          const writes = overlayWritesFor(name, args[0], clientId);
          if (writes.length) {
            const userId = String((args[0] as Record<string, unknown> | undefined)?.userId ?? "");
            for (const write of writes) {
              offlineRuntime.writeEntityOverlay(
                write.table,
                write.id,
                userId,
                write.doc,
                write.deleted
              );
            }
          }

          if (isCreate && clientId) {
            const input = (args[0] ?? {}) as Record<string, unknown>;
            return { ...input, _id: clientId } as FunctionReturnType<Mutation>;
          }
        } catch {
          // Best-effort enqueue; ignore.
        }
      }
      return undefined as FunctionReturnType<Mutation>;
    },
    [convex, mutation]
  );
}
