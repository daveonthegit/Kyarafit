import type { BetterAuthClientPlugin } from "better-auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BEARER_TOKEN_KEY = "better_auth_bearer_token";

/**
 * Persist and send Bearer token for cross-origin auth on React Native (Expo).
 * Same idea as web: no cookies to Convex origin, so we store the session token
 * and send it on every auth request. Use setStoredBearerToken() after sign-in
 * (e.g. when you receive a token from OAuth callback or email sign-in).
 */
export async function setStoredBearerToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(BEARER_TOKEN_KEY);
  }
}

async function getStoredBearerToken(): Promise<string | null> {
  return AsyncStorage.getItem(BEARER_TOKEN_KEY);
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
