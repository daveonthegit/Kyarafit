import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { bearerStoragePlugin } from "./bearer-storage-plugin";

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL ? `${CONVEX_SITE_URL}/auth` : undefined,
  plugins: [convexClient(), bearerStoragePlugin()],
});

export { setStoredBearerToken } from "./bearer-storage-plugin";

interface SessionData {
  user: { id: string; name: string; email: string; image?: string } | null;
}

/**
 * React hook that provides the current session state.
 * Keeps the same API shape as the old Supabase hook.
 */
export function useSession() {
  const { data, isPending } = authClient.useSession();
  return {
    data,
    isPending,
    session: data,
    loading: isPending,
  };
}

/** Get current session (async, non-hook). */
export async function getSession(): Promise<SessionData | null> {
  const { data } = await authClient.getSession();
  return data;
}

/** Token for backend API sync. Returns null if not authenticated. */
export async function getTokenForSync(): Promise<string | null> {
  return null;
}

export const signIn = {
  social: async ({
    provider,
    callbackURL,
  }: {
    provider: "google" | "github";
    callbackURL?: string;
  }) => {
    return authClient.signIn.social({ provider, callbackURL });
  },
};

export async function signOut() {
  await authClient.signOut();
}
