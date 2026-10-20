import { useCallback } from "react";
import { useConvex } from "convex/react";
import {
  getFunctionName,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs,
} from "convex/server";
import { hasLocalMutation, runLocalMutation } from "@/vault/functions";
import { useActiveVault } from "@/vault/hooks";
import { getIsOnline } from "./connectivity";

/** Thrown when an online-only action (social, groups, publishing, uploads) is attempted offline. */
export class NeedsConnectionError extends Error {
  constructor() {
    super("This needs an internet connection. Your planner keeps working offline.");
    this.name = "NeedsConnectionError";
  }
}

/**
 * The one write hook for screens.
 *
 * - **Personal data** (registered in `@/vault/handlers`): committed to the local vault in a single
 *   SQLite transaction and resolved only after that commit — for everyone, online or offline, free
 *   or paid. Convex is never called from here; managed sync replicates the outbox ops recorded in
 *   the same transaction. A failed write REJECTS (`VaultWriteError`); there is no
 *   placeholder result for unsaved work.
 * - **Online surfaces** (social, groups, profile, billing, uploads): called on Convex directly; when
 *   the device is offline they reject immediately with `NeedsConnectionError` instead of hanging or
 *   being silently queued.
 */
export function useOfflineMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
): (...args: OptionalRestArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const convex = useConvex();
  const vault = useActiveVault();
  return useCallback(
    async (...args: OptionalRestArgs<Mutation>): Promise<FunctionReturnType<Mutation>> => {
      const name = getFunctionName(mutation);
      if (hasLocalMutation(name)) {
        return runLocalMutation(name, args[0], vault) as FunctionReturnType<Mutation>;
      }
      if (!getIsOnline()) throw new NeedsConnectionError();
      return convex.mutation(mutation, ...args);
    },
    [convex, mutation, vault]
  );
}
