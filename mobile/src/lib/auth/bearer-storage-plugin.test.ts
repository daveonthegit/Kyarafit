// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

const store = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
}));
vi.mock("expo-secure-store", () => store);

const key = "better_auth_bearer_token";
const options = { keychainAccessible: store.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
let storage: typeof import("./bearer-storage-plugin");
let requests: Headers[];
let responseStatus: number;
let responseWait: Promise<void> | undefined;
let client: ReturnType<typeof createAuthClient>;

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  store.getItemAsync.mockResolvedValue(null);
  store.setItemAsync.mockResolvedValue(undefined);
  store.deleteItemAsync.mockResolvedValue(undefined);
  storage = await import("./bearer-storage-plugin");
  requests = [];
  responseStatus = 200;
  responseWait = undefined;
  client = createAuthClient({
    baseURL: "https://auth.example.test/auth",
    plugins: [storage.bearerStoragePlugin()],
    fetchOptions: {
      customFetchImpl: async (_url, init) => {
        requests.push(new Headers(init?.headers));
        if (responseWait) await responseWait;
        return new Response(JSON.stringify(responseStatus === 200 ? { success: true } : {}), {
          status: responseStatus,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
});

describe("device-only bearer storage", () => {
  it("hydrates and upgrades existing persistence, then caches for subsequent requests", async () => {
    store.getItemAsync.mockResolvedValue("existing-session");
    await storage.hydrateBearerFromSecureStore();
    await client.getSession();
    await client.getSession();
    expect(store.getItemAsync).toHaveBeenCalledExactlyOnceWith(key, options);
    expect(store.setItemAsync).toHaveBeenCalledExactlyOnceWith(key, "existing-session", options);
    expect(requests.map((headers) => headers.get("Authorization"))).toEqual([
      "Bearer existing-session",
      "Bearer existing-session",
    ]);
  });

  it("persists a sign-in token with device-only options", async () => {
    await storage.setStoredBearerToken("new-session");
    await client.getSession();
    expect(store.setItemAsync).toHaveBeenCalledExactlyOnceWith(key, "new-session", options);
    expect(requests[0].get("Authorization")).toBe("Bearer new-session");
  });

  it("authenticates sign-out revocation but never rehydrates the cleared session", async () => {
    await storage.setStoredBearerToken("session-to-revoke");
    await client.signOut();
    store.getItemAsync.mockResolvedValue("stale-disk-copy");
    await client.getSession();
    expect(requests[0].get("Authorization")).toBe("Bearer session-to-revoke");
    expect(requests[1].get("Authorization")).toBeNull();
    expect(store.deleteItemAsync).toHaveBeenCalledExactlyOnceWith(key, options);
    expect(store.getItemAsync).not.toHaveBeenCalled();
  });

  it("still attempts authenticated revocation after disk deletion fails, then retries cleanup", async () => {
    await storage.setStoredBearerToken("session-to-revoke");
    store.deleteItemAsync.mockRejectedValueOnce(new Error("transient delete failure"));
    await client.signOut();
    expect(requests[0].get("Authorization")).toBe("Bearer session-to-revoke");
    expect(store.deleteItemAsync).toHaveBeenCalledTimes(2);
    await client.getSession();
    expect(requests[1].get("Authorization")).toBeNull();
  });

  it("surfaces persistent deletion failure only after server revocation was attempted", async () => {
    await storage.setStoredBearerToken("session-to-revoke");
    store.deleteItemAsync.mockRejectedValue(new Error("persistent delete failure"));
    await expect(client.signOut()).rejects.toThrow("persistent delete failure");
    expect(requests[0].get("Authorization")).toBe("Bearer session-to-revoke");
    await client.getSession();
    expect(requests[1].get("Authorization")).toBeNull();
  });

  it("clears locally even when server sign-out fails", async () => {
    await storage.setStoredBearerToken("session-to-revoke");
    responseStatus = 500;
    await client.signOut();
    responseStatus = 200;
    await client.getSession();
    expect(requests[1].get("Authorization")).toBeNull();
  });

  it("clears after successful password reset, but not after failed reset", async () => {
    await storage.setStoredBearerToken("old-session");
    responseStatus = 400;
    await client.resetPassword({ newPassword: "test-password", token: "reset-token" });
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    responseStatus = 200;
    await client.getSession();
    expect(requests[1].get("Authorization")).toBe("Bearer old-session");
    await client.resetPassword({ newPassword: "test-password", token: "reset-token" });
    await client.getSession();
    expect(store.deleteItemAsync).toHaveBeenCalledExactlyOnceWith(key, options);
    expect(requests[3].get("Authorization")).toBeNull();
  });

  it("does not clear a newer sign-in when an earlier reset response arrives", async () => {
    await storage.setStoredBearerToken("old-session");
    let finishReset!: () => void;
    responseWait = new Promise<void>((resolve) => (finishReset = resolve));
    const reset = client.resetPassword({ newPassword: "test-password", token: "reset-token" });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await storage.setStoredBearerToken("new-session");
    responseWait = undefined;
    finishReset();
    await reset;
    await client.getSession();
    expect(requests[1].get("Authorization")).toBe("Bearer new-session");
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("retries hydration after unlock and after a transient policy rewrite failure", async () => {
    store.getItemAsync.mockRejectedValueOnce(new Error("locked"));
    await client.getSession();
    expect(requests[0].get("Authorization")).toBeNull();
    store.getItemAsync.mockResolvedValue("existing-session");
    store.setItemAsync.mockRejectedValueOnce(new Error("rewrite failed"));
    await client.getSession();
    expect(requests[1].get("Authorization")).toBeNull();
    await storage.hydrateBearerFromSecureStore();
    await client.getSession();
    expect(requests[2].get("Authorization")).toBe("Bearer existing-session");
    expect(store.getItemAsync).toHaveBeenCalledTimes(3);
  });

  it.each<{ headers: HeadersInit }>([
    { headers: new Headers({ "X-Test": "preserved" }) },
    { headers: [["X-Test", "preserved"]] },
    { headers: { "X-Test": "preserved" } },
  ])("preserves supplied headers while adding session authentication", async ({ headers }) => {
    await storage.setStoredBearerToken("session");
    await client.getSession({ fetchOptions: { headers } });
    expect(requests[0].get("X-Test")).toBe("preserved");
    expect(requests[0].get("Authorization")).toBe("Bearer session");
  });

  it("fails closed when SecureStore cannot read or persist", async () => {
    store.getItemAsync.mockRejectedValue(new Error("locked"));
    await client.getSession();
    expect(requests[0].get("Authorization")).toBeNull();
    store.setItemAsync.mockRejectedValue(new Error("write failed"));
    await expect(storage.setStoredBearerToken("not-persisted")).rejects.toThrow("write failed");
    await client.getSession();
    expect(requests[1].get("Authorization")).toBeNull();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(key, options);
  });

  it("keeps memory cleared after failed disk deletion", async () => {
    await storage.setStoredBearerToken("old-session");
    store.deleteItemAsync.mockRejectedValue(new Error("delete failed"));
    await expect(storage.setStoredBearerToken(null)).rejects.toThrow("delete failed");
    await client.getSession();
    expect(requests[0].get("Authorization")).toBeNull();
    expect(store.getItemAsync).not.toHaveBeenCalled();
  });

  it("does not restore a token from an in-flight hydration after logout", async () => {
    let completeRead!: (token: string) => void;
    store.getItemAsync.mockReturnValue(new Promise<string>((resolve) => (completeRead = resolve)));
    const hydration = storage.hydrateBearerFromSecureStore();
    await vi.waitFor(() => expect(store.getItemAsync).toHaveBeenCalled());
    const clear = storage.setStoredBearerToken(null);
    completeRead("stale-session");
    await Promise.all([hydration, clear]);
    await client.getSession();
    expect(requests[0].get("Authorization")).toBeNull();
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  it("preserves bearer authentication with the production auth plugin composition", async () => {
    const data = new Map<string, string>();
    const composed = createAuthClient({
      baseURL: "https://auth.example.test/auth",
      plugins: [
        convexClient(),
        crossDomainClient({
          storage: {
            getItem: (key) => data.get(key) ?? null,
            setItem: (key, value) => {
              data.set(key, value);
            },
          },
        }),
        usernameClient(),
        storage.bearerStoragePlugin(),
      ],
      fetchOptions: {
        customFetchImpl: async (_url, init) => {
          requests.push(new Headers(init?.headers));
          return Response.json({ success: true });
        },
      },
    });
    await storage.setStoredBearerToken("session-to-revoke");
    await composed.getSession();
    await composed.signOut();
    await composed.getSession();
    expect(requests.map((headers) => headers.get("Authorization"))).toEqual([
      "Bearer session-to-revoke",
      "Bearer session-to-revoke",
      null,
    ]);
  });

  it("serializes a pending token write before clearing persistence", async () => {
    let completeWrite!: () => void;
    store.setItemAsync.mockReturnValue(new Promise<void>((resolve) => (completeWrite = resolve)));
    const save = storage.setStoredBearerToken("old-session");
    await vi.waitFor(() => expect(store.setItemAsync).toHaveBeenCalled());
    const clear = storage.setStoredBearerToken(null);
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    completeWrite();
    await Promise.all([save, clear]);
    expect(store.deleteItemAsync).toHaveBeenCalledExactlyOnceWith(key, options);
    await client.getSession();
    expect(requests[0].get("Authorization")).toBeNull();
  });
});
