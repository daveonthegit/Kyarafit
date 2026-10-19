"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth/auth-client";
import {
  readLocalAccount,
  readOnline,
  rememberLocalAccount,
  subscribeConnectivity,
  subscribeLocalAccount,
} from "@/lib/auth/localAccount";
import { api } from "convex/_generated/api";

/**
 * Returns the current authenticated user's identity from Convex.
 * The `subject` field is the canonical userId used across all Convex documents.
 */
export function useCurrentUser() {
  const identity = useQuery(api.auth.getCurrentUser);
  const { data: session, isPending } = authClient.useSession();
  const remembered = useSyncExternalStore(subscribeLocalAccount, readLocalAccount, () => null);
  const online = useSyncExternalStore(subscribeConnectivity, readOnline, () => true);
  const subject = identity?.subject;
  const confirmedAbsent = identity === null && online && !isPending && !session;
  useEffect(() => {
    if (subject) rememberLocalAccount(subject);
    else if (confirmedAbsent) rememberLocalAccount(null);
  }, [subject, confirmedAbsent]);
  const userId = confirmedAbsent ? null : remembered ? (subject ?? remembered) : null;
  return {
    identity,
    userId,
    isLoading: identity === undefined && !userId,
    isAuthenticated: identity !== null && identity !== undefined,
  };
}
