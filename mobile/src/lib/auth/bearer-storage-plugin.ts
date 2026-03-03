import type { BetterAuthClientPlugin } from "better-auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BEARER_TOKEN_KEY = "better_auth_bearer_token";

// In-memory cache so the token is available synchronously after setStoredBearerToken()
// is called — without this, better-auth's 10ms session-signal timer fires and reads from
// AsyncStorage before the write completes, sending the session-refresh GET without a
// bearer token and getting a null session back.
let memoryToken: string | null = null;
let memoryTokenLoaded = false;

/**
 * Persist and send Bearer token for cross-origin auth on React Native (Expo).
 * Sets the in-memory copy synchronously so the token is immediately available
 * to bearerStoragePlugin on the very next fetch (e.g. the session-signal refresh
 * that better-auth triggers ~10ms after signIn.email() resolves).
 */
export async function setStoredBearerToken(token: string | null): Promise<void> {
  // Set in memory first — synchronous, available immediately for any in-flight fetch.
  memoryToken = token;
  memoryTokenLoaded = true;
  // Persist to AsyncStorage for survival across app restarts.
  if (token) {
    await AsyncStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(BEARER_TOKEN_KEY);
  }
}

async function getStoredBearerToken(): Promise<string | null> {
  if (!memoryTokenLoaded) {
    // First call after app start: hydrate from AsyncStorage, then cache.
    memoryToken = await AsyncStorage.getItem(BEARER_TOKEN_KEY);
    memoryTokenLoaded = true;
  }
  return memoryToken;
}

export const bearerStoragePlugin = (): BetterAuthClientPlugin => ({
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
});
