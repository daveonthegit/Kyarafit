import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import {
  bearerStoragePlugin,
  hydrateBearerFromSecureStore,
  setStoredBearerToken,
} from "./bearer-storage-plugin";
import { resetOfflineDatabaseForAccountSwitch } from "@/offline/db";
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

export async function signOut() {
  await authClient.signOut();
  resetOfflineDatabaseForAccountSwitch();
}
