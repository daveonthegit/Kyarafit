"use client";

import { useCallback, useSyncExternalStore } from "react";
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
import { readLocalAccount } from "@/lib/auth/localAccount";

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
 * Every returned callback is bound to the local account that was active when it was created: a
 * retained callback (a pending import, a slow create) invoked after a different account signed in
 * rejects instead of writing the first account's data under the second account's session or store.
 *
 * This is the BRIDGE — the designated online path that is allowed to import `convex/react`.
 */
export class AccountChangedError extends Error {
  constructor() {
    super("The active account changed. Reopen this screen and try again.");
    this.name = "AccountChangedError";
  }
}

const getSubjectSnapshot = () => offlineRuntime.getSubject();
export function useOfflineMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
): (...args: OptionalRestArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const convex = useConvex();
  const subject = useSyncExternalStore(offlineRuntime.subscribe, getSubjectSnapshot, () => null);
  return useCallback(
    (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      const command = (async (): Promise<FunctionReturnType<Mutation>> => {
        if (offlineRuntime.getSubject() !== subject || subject !== readLocalAccount()) {
          throw new AccountChangedError();
        }
        let name: string | null = null;
        try {
          name = getFunctionName(mutation);
        } catch {
          name = null;
        }

        if (name !== "files:generateUploadUrl") {
          await offlineRuntime.assertPersonalWritesAllowed();
          if (offlineRuntime.getSubject() !== subject || subject !== readLocalAccount()) {
            throw new AccountChangedError();
          }
        }

        if (getIsOnline() || (name != null && isOnlineOnlyMutation(name))) {
          return convex.mutation(mutation, ...args);
        }

        if (name != null) {
          const isCreate = isCreateMutation(name);
          const clientId = isCreate ? newClientId() : undefined;
          await offlineRuntime.commitCommand(
            {
              fn: name,
              argsJson: JSON.stringify(args[0] ?? {}),
              idempotencyKey: newIdempotencyKey(),
              clientId: clientId ?? null,
            },
            overlayWritesFor(name, args[0], clientId)
          );

          if (isCreate && clientId) {
            const input = (args[0] ?? {}) as Record<string, unknown>;
            return {
              ...input,
              _id: clientId,
            } as FunctionReturnType<Mutation>;
          }
        }
        return undefined as FunctionReturnType<Mutation>;
      })();
      void command.catch(() => undefined);
      return command;
    },
    [convex, mutation, subject]
  );
}
