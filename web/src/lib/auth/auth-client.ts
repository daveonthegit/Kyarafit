import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { bearerStoragePlugin } from "./bearer-storage-plugin";

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

export const authClient = createAuthClient({
  baseURL: convexSiteUrl ? `${convexSiteUrl}/auth` : undefined,
  // crossDomainClient stores the Set-Better-Auth-Cookie cookie in localStorage and
  // sends it on every request, enabling OAuth session persistence cross-origin.
  // It also exposes updateSession() used by ConvexBetterAuthProvider after OTT exchange.
  // bearerStoragePlugin handles email sign-in Bearer tokens (the two coexist safely).
  plugins: [convexClient(), crossDomainClient(), bearerStoragePlugin()],
});
