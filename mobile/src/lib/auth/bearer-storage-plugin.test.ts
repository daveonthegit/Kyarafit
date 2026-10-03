// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthClient } from "better-auth/client";

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
  client = createAuthClient({
    baseURL: "https://auth.example.test/auth",
    plugins: [storage.bearerStoragePlugin()],
    fetchOptions: {
      customFetchImpl: async (_url, init) => {
        requests.push(new Headers(init?.headers));
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
