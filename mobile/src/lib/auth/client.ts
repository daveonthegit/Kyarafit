import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import {
  bearerStoragePlugin,
  getBearerToken,
  hydrateBearerFromSecureStore,
  setStoredBearerToken,
} from "./bearer-storage-plugin";
import { lockVault } from "@/vault/activeVault";
import { EXPO_PUBLIC_CONVEX_SITE_URL } from "@/config/env";

const CONVEX_SITE_URL = EXPO_PUBLIC_CONVEX_SITE_URL || undefined;

const crossDomainStorage = {
  _data: {} as Record<string, string>,
  getItem(key: string): string | null {
    return this._data[key] ?? null;
  },
  setItem(key: string, value: string): void {
    this._data[key] = value;
  },
};

export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL ? `${CONVEX_SITE_URL}/auth` : undefined,
  plugins: [
    convexClient(),
    crossDomainClient({ storage: crossDomainStorage }),
    usernameClient(),
    bearerStoragePlugin(),
  ],
});

type DeleteUserArgs = {
  callbackURL?: string;
  password?: string;
  token?: string;
};

export { hydrateBearerFromSecureStore, setStoredBearerToken };

export function useSession() {
  const { data, isPending } = authClient.useSession();
  return {
    data,
    isPending,
    session: data,
    loading: isPending,
  };
}

export async function getSession() {
  return authClient.getSession();
}

export async function deleteAccount(args: DeleteUserArgs = {}) {
  return (
    authClient as typeof authClient & {
      deleteUser: (input: DeleteUserArgs) => Promise<{ error?: { message?: string } | null }>;
    }
  ).deleteUser(args);
}

type SetPasswordArgs = { newPassword: string };

/** Adds a credential password for OAuth-only users (Better Auth `setPassword` endpoint). */
export async function setCredentialPassword(args: SetPasswordArgs) {
  return (
    authClient as typeof authClient & {
      setPassword: (input: SetPasswordArgs) => Promise<{ error?: { message?: string } | null }>;
    }
  ).setPassword(args);
}

/**
 * Sign out: revoke the server session when reachable, forget the local credential, and LOCK this
 * account's vault. The vault (planner data and photos) stays on the device and unlocks again when
 * this account signs back in; other accounts get their own vaults. Works offline — an unreachable
 * server never keeps a user signed in on this device.
 */
export async function signOut() {
  const token = getBearerToken();
  const results = await Promise.allSettled([setStoredBearerToken(null), lockVault()]);
  if (token) {
    void authClient
      .signOut({
        fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
      })
      .catch((error: unknown) => {
        console.warn("[auth] server sign-out failed; signed out locally", error);
      });
  }
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, "Could not finish signing out on this device");
}
