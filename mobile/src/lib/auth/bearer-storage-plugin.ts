import type { BetterAuthClientPlugin } from "better-auth";
import * as SecureStore from "expo-secure-store";

const BEARER_TOKEN_KEY = "better_auth_bearer_token";
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** A hydrated null is authoritative: logout must not re-read an old persisted token. */
let memoryToken: string | null = null;
let hydrated = false;
let revision = 0;
let storageQueue: Promise<void> = Promise.resolve();

function serializeStorage(operation: () => Promise<void>): Promise<void> {
  const pending = storageQueue.then(operation);
  storageQueue = pending.catch(() => {});
  return pending;
}

export async function hydrateBearerFromSecureStore(): Promise<void> {
  if (hydrated) return;
  const startedAt = revision;
  await serializeStorage(async () => {
    if (hydrated || startedAt !== revision) return;
    try {
      const token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
      if (startedAt !== revision) return;
      // Rewrite existing items to apply the device-only policy, without changing the key/service.
      if (token) await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token, STORE_OPTIONS);
      if (startedAt === revision) memoryToken = token;
    } catch {
      if (startedAt === revision) memoryToken = null;
    } finally {
      if (startedAt === revision) hydrated = true;
    }
  });
}

/** Persist after sign-in; null immediately clears memory even if disk deletion fails. */
export async function setStoredBearerToken(token: string | null): Promise<void> {
  const changedAt = ++revision;
  hydrated = true;
  memoryToken = null;
  await serializeStorage(async () => {
    if (token) {
      try {
        await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token, STORE_OPTIONS);
      } catch (error) {
        // Do not keep using an older session after a failed account switch.
        await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS).catch(() => {});
        throw error;
      }
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
    }
    if (changedAt === revision) memoryToken = token;
  });
}

async function getStoredBearerToken(): Promise<string | null> {
  await hydrateBearerFromSecureStore();
  return memoryToken;
}

function isAuthEndpoint(url: string, endpoint: string): boolean {
  return new URL(url, "https://auth.invalid").pathname.endsWith(`/${endpoint}`);
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
        hooks: {
          async onRequest(context) {
            const token = await getStoredBearerToken();
            const headers = toHeaders(context.headers);
            if (token) {
              headers.set("Authorization", `Bearer ${token}`);
            }
            // Keep authentication on the outgoing revocation request, then clear locally.
            if (isAuthEndpoint(context.url.toString(), "sign-out")) {
              await setStoredBearerToken(null);
            }
            return { ...context, headers };
          },
          async onSuccess(context) {
            if (isAuthEndpoint(context.request.url.toString(), "reset-password")) {
              await setStoredBearerToken(null);
            }
          },
        },
      },
    ],
  };
}
