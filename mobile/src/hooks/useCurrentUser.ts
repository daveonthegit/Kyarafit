import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

/**
 * Returns the current authenticated user's Convex identity.
 * The `subject` field is the canonical userId used across all Convex documents.
 * Returns null userId when not signed in (anonymous / local-only mode).
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
