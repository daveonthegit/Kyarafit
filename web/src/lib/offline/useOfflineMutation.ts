"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import {
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs,
} from "convex/server";
import { getIsOnline } from "./connectivity";
import { offlineRuntime } from "./runtime";
import { readLocalAccount } from "@/lib/auth/localAccount";
import { OfflineWriteError, reportWriteFailure } from "./writeFailures";

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
    async (...args: OptionalRestArgs<Mutation>) => {
      if (!subject || offlineRuntime.getSubject() !== subject || subject !== readLocalAccount())
        throw new AccountChangedError();
      // Web edits save straight to Convex (ADR-0006). Every failure is reported app-wide once, so
      // a screen that keeps its form open for retry never fails silently.
      try {
        if (!getIsOnline()) throw new OfflineWriteError();
        return await convex.mutation(mutation, ...args);
      } catch (error) {
        reportWriteFailure(error);
        throw error;
      }
    },
    [convex, mutation, subject]
  );
}
