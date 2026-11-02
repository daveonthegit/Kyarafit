import { useEffect, useSyncExternalStore } from "react";
import type { VaultAccount } from "@/vault/account";
import { unlockVault } from "@/vault/activeVault";
import { useVaultState } from "@/vault/hooks";
import { hasBearerToken, subscribeBearerToken } from "./bearer-storage-plugin";
import { authClient } from "./client";

/**
 * The app's sign-in state, combining the remote Better Auth session with the local vault.
 *
 * An account is required to start, but once an account has signed in on this device the planner
 * never depends on the network to open: the persisted active account unlocks its vault at launch,
 * and a missing, slow, or expired remote session only changes `connection`:
 *
 * - `verified` — the server confirmed the session.
 * - `offline`  — the session could not be checked (no network, server unreachable, still checking).
 * - `expired`  — the server answered that the session is gone. Local work continues; online
 *                features and sync wait until the user signs in again.
 */
export type AppSession =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "vaultError"; account: VaultAccount; message: string }
  | {
      status: "signedIn";
      account: VaultAccount;
      connection: "verified" | "offline" | "expired";
    };

type RemoteSession = {
  data: {
    user?: { id?: string; name?: string | null; email?: string | null; image?: string | null };
  } | null;
  isPending: boolean;
  error: { status?: number } | null;
};

/** Pure decision table (unit-tested): remote session × vault state → app session. */
export function deriveAppSession(
  remote: RemoteSession,
  vault: ReturnType<typeof useVaultState>,
  hasCredential = true
): AppSession {
  // Without a stored credential a cached remote user is stale (e.g. after an offline sign-out): it
  // can never unlock a vault.
  const remoteUserId = hasCredential ? (remote.data?.user?.id ?? null) : null;
  if (vault.status === "booting") return { status: "loading" };
  if (vault.status === "error") {
    return { status: "vaultError", account: vault.account, message: vault.message };
  }
  if (vault.status === "locked") {
    // A confirmed session is about to unlock its vault; a pending check may still resolve to one.
    if (remoteUserId || (remote.isPending && hasCredential)) return { status: "loading" };
    return { status: "signedOut" };
  }
  const { account } = vault;
  if (remoteUserId === account.subject) {
    return { status: "signedIn", account, connection: "verified" };
  }
  if (remoteUserId && remoteUserId !== account.subject) {
    // Another account just signed in; its vault is being unlocked.
    return { status: "loading" };
  }
  const unauthorized = remote.error?.status === 401;
  if (!remote.isPending && (unauthorized || (!remote.error && remote.data === null))) {
    return { status: "signedIn", account, connection: "expired" };
  }
  return { status: "signedIn", account, connection: "offline" };
}

/**
 * Hook form of `deriveAppSession`. Also keeps the vault in step with the remote session: when the
 * server confirms a user, that user's vault is unlocked (opening a different account's vault locks
 * the previous one; nothing is deleted).
 */
export function useAppSession(): AppSession {
  const remote = authClient.useSession() as unknown as RemoteSession;
  const vault = useVaultState();
  const hasCredential = useSyncExternalStore(subscribeBearerToken, hasBearerToken, hasBearerToken);
  const user = hasCredential ? remote.data?.user : undefined;

  useEffect(() => {
    if (!user?.id) return;
    if (vault.status === "booting") return;
    if (vault.status === "error" && vault.account.subject === user.id) return;
    const current = vault.status === "unlocked" ? vault.account : null;
    const changed =
      !current ||
      current.subject !== user.id ||
      current.name !== (user.name ?? null) ||
      current.email !== (user.email ?? null) ||
      current.image !== (user.image ?? null);
    if (!changed) return;
    void unlockVault({
      subject: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      lastVerifiedAt: Date.now(),
    }).catch((error: unknown) => console.error("[vault] unlock failed", error));
  }, [user?.id, user?.name, user?.email, user?.image, vault]);

  return deriveAppSession(remote, vault, hasCredential);
}
