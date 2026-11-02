import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { AuthClient as ConvexAuthClient } from "@convex-dev/better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

// Same-origin by default: `/api/auth/*` is proxied to Convex (app/api/auth/[...all]/route.ts), so
// the session lives only in an HttpOnly cookie and script never stores or sends a session token.
// usernameClient adds signIn.username() for username-based login.
const client = createAuthClient({
  plugins: [convexClient(), usernameClient()],
});

// The integration's provider type still widens plugins to BetterAuthClientPlugin[],
// which infers a `never` session in Better Auth 1.6. Preserve concrete client inference
// at call sites while bridging only that upstream provider type; runtime is unchanged.
export const authClient = client as typeof client & ConvexAuthClient;

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
