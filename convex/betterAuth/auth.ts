import { createClient } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "../emailHelpers";

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  // When SITE_URL is set, email links use app domain (app proxies to Convex). Otherwise use Convex URL.
  const baseURL = siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/auth`
    : convexSiteUrl
      ? `${convexSiteUrl.replace(/\/$/, "")}/auth`
      : undefined;
  const extraOrigins =
    process.env.ADDITIONAL_CORS_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter((s): s is string => s.length > 0) ?? [];

  // IMPORTANT: trustedOrigins is Better Auth's own CSRF check — completely separate from the
  // HTTP-level CORS config in http.ts. If an origin passes CORS but is absent here, Better Auth
  // returns 403 Forbidden on every auth request. Keep this list in sync with allowedOrigins in
  // http.ts. See docs/auth.md → "Origin Configuration" for the full explanation.
  // Device LAN IPs (e.g. for Expo Go on a phone) should be added via ADDITIONAL_CORS_ORIGINS in
  // the Convex dashboard; they are automatically merged in via extraOrigins below.
  const trustedOrigins: string[] = [
    // Local dev origins (must match http.ts allowedOrigins)
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "exp://localhost:8081",
    "exp://127.0.0.1:8081",
    // Mobile deep-link scheme. Better Auth validates callbackURL origins against this list.
    // Use kyarafit:/// (not kyarafit://(tabs)) — parentheses are invalid hostname characters
    // and cause Better Auth to reject the request with 403 + "Invalid callbackURL".
    "kyarafit://",
    // Production app origin and any custom additions (e.g. device LAN IPs from ADDITIONAL_CORS_ORIGINS)
    ...(siteUrl ? [siteUrl] : []),
    ...extraOrigins,
  ];
  return {
    appName: "Kyarafit",
    baseURL,
    basePath: "/auth", // Must match client baseURL path so Convex registers /auth/* not /api/auth/*
    secret: process.env.BETTER_AUTH_SECRET,
    // CORS: registerRoutes merges these with http.ts cors.allowedOrigins (localhost, Expo, etc.)
    trustedOrigins,
    database: authComponent.adapter(ctx),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendPasswordResetEmail(user.email, url);
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        await sendVerificationEmail(user.email, url);
      },
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      ...(process.env.GITHUB_CLIENT_ID
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID!,
              clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            },
          }
        : {}),
    },

    plugins: [
      convex({ authConfig, options: { basePath: "/auth" } }),
      // crossDomain enables OTT-based OAuth callback for both web and mobile.
      // siteUrl falls back to CONVEX_SITE_URL so mobile OAuth (absolute deep-link
      // callbackURL) works even without SITE_URL set; set SITE_URL in production
      // so web relative callbackURLs are rewritten to the app domain correctly.
      crossDomain({ siteUrl: (siteUrl ?? convexSiteUrl)! }),
      username(),
    ],
  } satisfies BetterAuthOptions;
};

// For `npx auth` CLI commands
export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};
