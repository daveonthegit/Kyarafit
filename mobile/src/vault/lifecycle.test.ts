import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteVaultDatabase } from "@/offline/db";
import { loadActiveAccount } from "./account";
import { getActiveVault, getVaultState, lockVault, unlockVault } from "./activeVault";

/**
 * Vault lifecycle races: an unlock suspended in its profile save must not re-open the vault after
 * sign-out locked it, nor land after a newer account switch.
 */

const ACCOUNT_A = { subject: "life_a", name: "A", lastVerifiedAt: 1 };
const ACCOUNT_B = { subject: "life_b", name: "B", lastVerifiedAt: 1 };

function deferSetItem() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = AsyncStorage.setItem.bind(AsyncStorage);
  const spy = vi.spyOn(AsyncStorage, "setItem").mockImplementationOnce(async (key, value) => {
    await gate;
    return original(key, value);
  });
  return { release, spy };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await lockVault();
  await deleteVaultDatabase(ACCOUNT_A.subject);
  await deleteVaultDatabase(ACCOUNT_B.subject);
});

describe("vault lifecycle", () => {
  it("publishes a retryable storage error if the account record cannot be saved", async () => {
    vi.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disk full"));
    await unlockVault(ACCOUNT_A);
    expect(getVaultState()).toMatchObject({ status: "error", account: ACCOUNT_A, message: "disk full" });
    expect(getActiveVault()).toBeNull();
    await unlockVault(ACCOUNT_A);
    expect(getVaultState()).toMatchObject({ status: "unlocked", account: ACCOUNT_A });
  });

  it("a pending unlock cannot re-open the vault after sign-out locks it", async () => {
    const { release } = deferSetItem();
    const unlocking = unlockVault(ACCOUNT_A);
    const locking = lockVault();
    expect(getVaultState().status).toBe("locked");

    release();
    await unlocking;
    await locking;

    expect(getVaultState().status).toBe("locked");
    expect(getActiveVault()).toBeNull();
    expect(await loadActiveAccount()).toBeNull();
  });

  it("a slow unlock of one account cannot land after switching to another", async () => {
    const { release } = deferSetItem();
    const first = unlockVault(ACCOUNT_A);
    const second = unlockVault(ACCOUNT_B);

    release();
    await first;
    await second;

    expect(getVaultState()).toMatchObject({ status: "unlocked", account: { subject: "life_b" } });
    expect(getActiveVault()?.subject).toBe("life_b");
    expect((await loadActiveAccount())?.subject).toBe("life_b");
  });
});
