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

/**
 * Normalize the loosely-typed better-auth request headers (which may be a `Headers`, a tuple array,
 * or a record whose values can be `undefined`) into a `Headers` instance, dropping undefined values.
 */
function toHeaders(input: unknown): Headers {
  const headers = new Headers();
  if (!input) return headers;
  if (input instanceof Headers) {
    input.forEach((value, key) => headers.set(key, value));
  } else if (Array.isArray(input)) {
    for (const entry of input) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") {
        headers.set(entry[0], entry[1]);
      }
    }
  } else if (typeof input === "object") {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string") {
        headers.set(key, value);
      }
    }
  }
  return headers;
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
        const headers = toHeaders(options?.headers);
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
