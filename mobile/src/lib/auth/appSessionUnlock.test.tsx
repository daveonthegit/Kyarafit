import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSession } from "./appSession";
import { __setActiveVaultForTests, lockVault, unlockVault } from "@/vault/activeVault";
import * as db from "@/offline/db";
import { setStoredBearerToken } from "./bearer-storage-plugin";

const remote = vi.hoisted(() => ({ user: { id: "owner", name: "A" } }));
vi.mock("./client", () => ({
  authClient: {
    useSession: () => ({ data: { user: remote.user }, isPending: false, error: null }),
  },
}));

beforeEach(async () => {
  remote.user = { id: "owner", name: "A" };
  __setActiveVaultForTests(null);
  await setStoredBearerToken("token-a");
});
afterEach(async () => {
  cleanup();
  await lockVault();
  vi.restoreAllMocks();
});

describe("vault-open errors", () => {
  it("waits for explicit retry for the same account but allows an account switch", async () => {
    const realOpen = db.openVaultDatabase;
    const open = vi.spyOn(db, "openVaultDatabase").mockImplementation(() => {
      throw new Error("Database is damaged");
    });
    const { result, rerender } = renderHook(() => useAppSession());
    await waitFor(() => expect(result.current.status).toBe("vaultError"));
    expect(open).toHaveBeenCalledTimes(1);
    remote.user = { id: "owner", name: "Updated profile" };
    rerender();
    await act(async () => {});
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => {
      await unlockVault({ subject: "owner", lastVerifiedAt: 1 });
    });
    expect(open).toHaveBeenCalledTimes(2);
    remote.user = { id: "other", name: "B" };
    rerender();
    await waitFor(() => expect(open).toHaveBeenCalledTimes(3));
    expect(result.current).toMatchObject({ status: "vaultError", account: { subject: "other" } });
    open.mockImplementation(realOpen);
    await act(async () => {
      await unlockVault({ subject: "other", lastVerifiedAt: 2 });
    });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    rerender();
    expect(open).toHaveBeenCalledTimes(4);
  });
});

describe("sign-out lock", () => {
  it("a cached remote user cannot re-open the vault after an offline sign-out", async () => {
    const { result } = renderHook(() => useAppSession());
    await waitFor(() => expect(result.current.status).toBe("signedIn"));

    // Offline sign-out: the server revoke failed, so the auth client still caches the user, but
    // the credential is gone and the vault is locked.
    await act(async () => {
      await setStoredBearerToken(null);
      await lockVault();
    });
    await act(async () => {});
    expect(result.current).toEqual({ status: "signedOut" });

    // Only a new sign-in (a fresh stored credential) unlocks again.
    await act(async () => {
      await setStoredBearerToken("token-b");
    });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
  });
});
