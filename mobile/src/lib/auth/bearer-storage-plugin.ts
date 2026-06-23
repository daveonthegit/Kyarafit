import type { BetterAuthClientPlugin } from "better-auth";
import * as SecureStore from "expo-secure-store";

const BEARER_TOKEN_KEY = "better_auth_bearer_token";

/** In-memory cache so the fetch hook can attach the header without awaiting every request after hydration. */
let memoryToken: string | null = null;

export async function hydrateBearerFromSecureStore(): Promise<void> {
  try {
    memoryToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
}

/**
 * Persist Bearer session token (opaque to the client). Call after sign-in; pass null on sign-out.
 */
export async function setStoredBearerToken(token: string | null): Promise<void> {
  memoryToken = token;
  if (token) {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

async function getStoredBearerToken(): Promise<string | null> {
  if (memoryToken !== null) return memoryToken;
  try {
    memoryToken = await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
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

export function bearerStoragePlugin(): BetterAuthClientPlugin {
  return {
    id: "bearer-storage",
    fetchPlugins: [
      {
        id: "bearer-storage-fetch",
        name: "BearerStorage",
        async init(url, options) {
          if (url.includes("/sign-out")) {
            await setStoredBearerToken(null);
          }
          const token = await getStoredBearerToken();
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
  };
}
