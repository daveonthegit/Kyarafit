import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { bearerStoragePlugin } from "./bearer-storage-plugin";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

export const authClient = createAuthClient({
  baseURL: convexSiteUrl ? `${convexSiteUrl}/auth` : undefined,
  // crossDomainClient stores the Set-Better-Auth-Cookie cookie in localStorage and
  // sends it on every request, enabling OAuth session persistence cross-origin.
  // It also exposes updateSession() used by ConvexBetterAuthProvider after OTT exchange.
  // bearerStoragePlugin handles credential sign-in Bearer tokens (the two coexist safely).
  // usernameClient adds signIn.username() for username-based login.
  plugins: [convexClient(), crossDomainClient(), usernameClient(), bearerStoragePlugin()],
});

type DeleteUserArgs = {
  callbackURL?: string;
  password?: string;
  token?: string;
};

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
