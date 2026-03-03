"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

/**
 * Returns the current authenticated user's identity from Convex.
 * The `subject` field is the canonical userId used across all Convex documents.
 */
export function useCurrentUser() {
  const identity = useQuery(api.auth.getCurrentUser);
  return {
    identity,
    userId: identity?.subject ?? null,
    isLoading: identity === undefined,
    isAuthenticated: identity !== null && identity !== undefined,
  };
}
