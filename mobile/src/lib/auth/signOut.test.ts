import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOut } from "./client";

const h = vi.hoisted(() => ({
  serverSignOut: vi.fn(),
  setStoredBearerToken: vi.fn(),
  lockVault: vi.fn(),
  deleteVault: vi.fn(),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signOut: h.serverSignOut }),
}));
vi.mock("@convex-dev/better-auth/client/plugins", () => ({
  convexClient: () => ({}),
  crossDomainClient: () => ({}),
}));
vi.mock("better-auth/client/plugins", () => ({ usernameClient: () => ({}) }));
vi.mock("./bearer-storage-plugin", () => ({
  bearerStoragePlugin: () => ({}),
  hydrateBearerFromSecureStore: vi.fn(),
  setStoredBearerToken: h.setStoredBearerToken,
}));
vi.mock("@/config/env", () => ({ EXPO_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site" }));
vi.mock("@/vault/activeVault", () => ({ lockVault: h.lockVault }));
vi.mock("@/offline/db", () => ({ deleteVaultDatabase: h.deleteVault }));

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.setStoredBearerToken.mockResolvedValue(undefined);
    h.lockVault.mockResolvedValue(undefined);
  });

  it("revokes the session, forgets the credential and locks — never deletes — the vault", async () => {
    h.serverSignOut.mockResolvedValue({});
    await signOut();
    expect(h.serverSignOut).toHaveBeenCalledTimes(1);
    expect(h.setStoredBearerToken).toHaveBeenCalledWith(null);
    expect(h.lockVault).toHaveBeenCalledTimes(1);
    expect(h.deleteVault).not.toHaveBeenCalled();
  });

  it("locks the vault even when deleting the persisted credential fails", async () => {
    const failure = new Error("SecureStore deletion failed");
    h.serverSignOut.mockResolvedValue({});
    h.setStoredBearerToken.mockRejectedValueOnce(failure);
    await expect(signOut()).rejects.toBe(failure);
    expect(h.lockVault).toHaveBeenCalledTimes(1);
    expect(h.deleteVault).not.toHaveBeenCalled();
  });

  it("reports both local persistence errors after attempting both cleanup operations", async () => {
    const credentialFailure = new Error("SecureStore deletion failed");
    const lockFailure = new Error("Active account persistence failed");
    h.serverSignOut.mockResolvedValue({});
    h.setStoredBearerToken.mockRejectedValueOnce(credentialFailure);
    h.lockVault.mockRejectedValueOnce(lockFailure);
    await expect(signOut()).rejects.toMatchObject({ errors: [credentialFailure, lockFailure] });
    expect(h.lockVault).toHaveBeenCalledTimes(1);
  });

  it("still signs out locally when the server is unreachable (offline)", async () => {
    h.serverSignOut.mockRejectedValue(new TypeError("Network request failed"));
    await expect(signOut()).resolves.toBeUndefined();
    expect(h.setStoredBearerToken).toHaveBeenCalledWith(null);
    expect(h.lockVault).toHaveBeenCalledTimes(1);
    expect(h.deleteVault).not.toHaveBeenCalled();
  });
});
