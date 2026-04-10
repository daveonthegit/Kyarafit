import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { bearerStoragePlugin } from "./bearer-storage-plugin";

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

// In-memory storage for crossDomainClient on React Native. The plugin falls back to
// localStorage when window exists, but localStorage doesn't exist in RN — passing
// an explicit storage avoids ReferenceError and keeps credentials:"omit" behavior.
const crossDomainStorage = {
  _data: {} as Record<string, string>,
  getItem(key: string): string | null {
    return this._data[key] ?? null;
  },
  setItem(key: string, value: string): void {
    this._data[key] = value;
  },
};

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL ? `${CONVEX_SITE_URL}/auth` : undefined,
  // crossDomainClient MUST be included alongside bearerStoragePlugin.
  // Without it, better-auth defaults to credentials:"include" on every fetch.
  // On Expo Web that means cross-origin requests require Access-Control-Allow-Credentials,
  // which Convex doesn't set — the browser silently blocks the response, GET /auth/get-session
  // fails, the session atom stays null, and useSession() never sees a logged-in user.
  // crossDomainClient sets credentials:"omit" so only the explicit Authorization:Bearer
  // header (from bearerStoragePlugin) carries auth — no cookie negotiation needed.
  plugins: [
    convexClient(),
    crossDomainClient({ storage: crossDomainStorage }),
    usernameClient(),
    bearerStoragePlugin(),
  ],
});

type DeleteUserArgs = {
  callbackURL?: string;
  password?: string;
  token?: string;
};

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

export async function deleteAccount(args: DeleteUserArgs = {}) {
  return (
    authClient as typeof authClient & {
      deleteUser: (input: DeleteUserArgs) => Promise<{ error?: { message?: string } | null }>;
    }
  ).deleteUser(args);
}

export async function signOut() {
  await authClient.signOut();
}
