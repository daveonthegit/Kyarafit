import type { BetterAuthClientPlugin } from "better-auth";

const BEARER_TOKEN_KEY = "better_auth_bearer_token";

/**
 * Persist and send Bearer token for cross-origin auth (e.g. app on localhost, auth on Convex).
 * Only the session token is stored (opaque to the client); no secrets or refresh tokens.
 * - After sign-in we store the token; this plugin sends it on every auth request.
 * - On sign-out we clear it.
 * Use setStoredBearerToken() after sign-in so session persists across navigation/refetches.
 */
export function setStoredBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(BEARER_TOKEN_KEY);
  }
}

function getStoredBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BEARER_TOKEN_KEY);
}

export const bearerStoragePlugin = (): BetterAuthClientPlugin => ({
  id: "bearer-storage",
  fetchPlugins: [
    {
      id: "bearer-storage-fetch",
      name: "BearerStorage",
      async init(url, options) {
        if (url.includes("/sign-out")) {
          setStoredBearerToken(null);
        }
        const token = getStoredBearerToken();
        const headers = new Headers(options?.headers);
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        return {
          url,
          options: { ...options, headers },
        };
      },
    },
  ],
});
