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
  const hydrationRevision = revision;
  await serializeStorage(async () => {
    if (hydrated || hydrationRevision !== revision) return;
    try {
      const token = await SecureStore.getItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
      if (hydrationRevision !== revision) return;
      // iOS updates do not change an existing item's accessibility: recreate it instead.
      if (token) {
        await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
        if (hydrationRevision !== revision) return;
        await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token, STORE_OPTIONS);
      }
      if (hydrationRevision === revision) {
        memoryToken = token;
        hydrated = true;
      }
    } catch {
      // A locked device or transient rewrite failure may recover on a later request.
      // Explicit logout/account-switch nulls remain authoritative via the revision guard.
      if (hydrationRevision === revision) memoryToken = null;
    }
  });
}

/** Persist after sign-in; null immediately clears memory even if disk deletion fails. */
export async function setStoredBearerToken(token: string | null): Promise<void> {
  const writeRevision = ++revision;
  hydrated = true;
  memoryToken = null;
  await serializeStorage(async () => {
    if (token) {
      try {
        // Recreate even if sign-in occurs before hydration of an older installed client.
        await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
        await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token, STORE_OPTIONS);
      } catch (error) {
        // Do not keep using an older session after a failed account switch.
        await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS).catch(() => {});
        throw error;
      }
    } else {
      await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY, STORE_OPTIONS);
    }
    if (writeRevision === revision) memoryToken = token;
  });
}

async function getStoredBearerSnapshot(): Promise<{ token: string | null; revision: number }> {
  await hydrateBearerFromSecureStore();
  // Capture both fields synchronously, before the requesting hook resumes after its await.
  return { token: memoryToken, revision };
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
  const resetRevisions = new WeakMap<object, number>();
  const logoutRevisions = new WeakMap<object, number>();
  return {
    id: "bearer-storage",
    fetchPlugins: [
      {
        id: "bearer-storage-fetch",
        name: "BearerStorage",
        hooks: {
          async onRequest(context) {
            const { token, revision: requestRevision } = await getStoredBearerSnapshot();
            const headers = toHeaders(context.headers);
            if (token) {
              headers.set("Authorization", `Bearer ${token}`);
            }
            // Better Fetch merges a hook's return value into this original context.
            // Response hooks receive the original, not a separately returned object.
            const request = context;
            request.headers = headers;
            if (isAuthEndpoint(context.url.toString(), "reset-password")) {
              resetRevisions.set(request, requestRevision);
            }
            // A disk failure must not prevent the authenticated server revocation request.
            // Memory clears immediately; persistence is retried after the server responds.
            if (
              isAuthEndpoint(context.url.toString(), "sign-out") &&
              requestRevision === revision
            ) {
              const logoutRevision = revision + 1;
              await setStoredBearerToken(null).catch(() => {
                logoutRevisions.set(request, logoutRevision);
              });
            }
            return request;
          },
          async onResponse(context) {
            if (logoutRevisions.get(context.request) === revision) {
              // If this still fails, surface non-durable logout, but revocation was attempted.
              await setStoredBearerToken(null);
            }
          },
          async onSuccess(context) {
            if (resetRevisions.get(context.request) === revision) {
              await setStoredBearerToken(null);
            }
          },
        },
      },
    ],
  };
}
