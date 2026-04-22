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
  };
}
