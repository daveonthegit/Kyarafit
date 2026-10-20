"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import { getFunctionName, type FunctionReference, type FunctionReturnType, type OptionalRestArgs } from "convex/server";
import { getIsOnline } from "./connectivity";
import { offlineRuntime } from "./runtime";
import { readLocalAccount } from "@/lib/auth/localAccount";
import { assertWebMutationAllowed } from "./publishedReadOnly";

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
  return useCallback(async (...args: OptionalRestArgs<Mutation>) => {
    if (!subject || offlineRuntime.getSubject() !== subject || subject !== readLocalAccount()) throw new AccountChangedError();
    assertWebMutationAllowed(getFunctionName(mutation));
    if (!getIsOnline()) throw new Error("This action requires a connection.");
    return convex.mutation(mutation, ...args);
  }, [convex, mutation, subject]);
}
