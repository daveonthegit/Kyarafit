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
import { deleteUserOwnedData } from "../lib/accountDeletion";

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

/** One source for HTTP CORS and Better Auth's CSRF origins. Default is release-safe.
 * Convex dev deployments also run production bundles, so NODE_ENV is not a dev signal.
 * Set AUTH_ENVIRONMENT=development only on an isolated development deployment.
 */
export function getAuthOrigins() {
  const environment = process.env.AUTH_ENVIRONMENT ?? "production";
  if (environment !== "production" && environment !== "development") {
    throw new Error("AUTH_ENVIRONMENT must be production or development");
  }
  const development = environment === "development";
  const configured = [
    ...(process.env.SITE_URL ? [process.env.SITE_URL] : []),
    ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(",").filter((s) => s.trim()) ?? []),
  ].map((value) => {
    const url = new URL(value.trim());
    if (
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      (!development &&
        (url.protocol !== "https:" ||
          url.hostname.replace(/\.$/, "") === "localhost" ||
          url.hostname.endsWith(".localhost") ||
          url.hostname.startsWith("127.") ||
          url.hostname === "[::1]")) ||
      (development && !["https:", "http:", "exp:"].includes(url.protocol))
    ) {
      throw new Error("Auth origins must be origins; production requires non-loopback HTTPS");
    }
    return `${url.protocol}//${url.host}`;
  });
  const corsOrigins = [
    ...new Set([
      "https://app.kyarafit.com",
      "https://www.kyarafit.com",
      "https://kyarafit.com",
      ...configured,
      ...(development
        ? [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8081",
            "http://127.0.0.1:8081",
            "exp://localhost:8081",
            "exp://127.0.0.1:8081",
          ]
        : []),
    ]),
  ];
  return {
    corsOrigins,
    // Retain installed mobile callbacks until the claimed-link package lands.
    trustedOrigins: [...corsOrigins, "kyarafit://", "https://appleid.apple.com"],
  };
}

// Also consumed by Convex's createApi during module analysis, before deployment env
// is available. Building schema/options must not initialize auth or require secrets.
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  // OAuth redirect_uri must match the host the clients use (`NEXT_PUBLIC_CONVEX_SITE_URL` / mobile
  // `EXPO_PUBLIC_CONVEX_SITE_URL` → `*.convex.site/auth`). Using SITE_URL here made Apple/Google
  // expect `https://<SITE_URL>/auth/callback/...` while Return URLs were registered for
  // `*.convex.site` → "Invalid web redirect url". Next.js does not serve `/auth/callback/*`.
  // Prefer CONVEX_SITE_URL (always set on Convex) for baseURL; keep SITE_URL in trustedOrigins/CORS.
  const baseURL = convexSiteUrl
    ? `${convexSiteUrl.replace(/\/$/, "")}/auth`
    : siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/auth`
      : undefined;
  return {
    appName: "Kyarafit",
    baseURL,
    basePath: "/auth", // Must match client baseURL path so Convex registers /auth/* not /api/auth/*
    secret: process.env.BETTER_AUTH_SECRET,
    // Apple uses form_post → cross-site POST to *.convex.site; Lax session cookies are unreliable
    // on that navigation. None + Secure matches HTTPS Convex URLs and avoids OAuth edge cases
    // (see better-auth discussions on Apple / POST callbacks).
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    // Resolve the shared origin policy only at runtime, not during schema analysis.
    trustedOrigins: () => getAuthOrigins().trustedOrigins,
    database: authComponent.adapter(ctx),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
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

    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
        // Apple often returns a private-relay address while the profile email is the
        // user's real address (or vice versa). Without this, /link-social → OAuth
        // callback fails with email_doesn't_match and Apple never appears linked.
        allowDifferentEmails: true,
        updateUserInfoOnLink: true,
      },
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: process.env.APPLE_CLIENT_ID,
              clientSecret: process.env.APPLE_CLIENT_SECRET,
              ...(process.env.APPLE_APP_BUNDLE_IDENTIFIER
                ? { appBundleIdentifier: process.env.APPLE_APP_BUNDLE_IDENTIFIER }
                : {}),
            },
          }
        : {}),
    },

    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await deleteUserOwnedData(ctx as never, user.id);
        },
      },
    },

    plugins: [
      convex({ authConfig, options: { basePath: "/auth" } }),
      // crossDomain enables OTT-based OAuth callback for both web and mobile.
      // siteUrl falls back to CONVEX_SITE_URL so mobile OAuth (absolute deep-link
      // callbackURL) works even without SITE_URL set; set SITE_URL in production
      // so web relative callbackURLs are rewritten to the app domain correctly.
      crossDomain({ siteUrl: (siteUrl ?? convexSiteUrl)! }),
      // Keep min/max aligned with Convex `validateUsername` (convex/lib/validation.ts).
      username({
        minUsernameLength: 1,
        maxUsernameLength: 80,
      }),
    ],
  } satisfies BetterAuthOptions;
};

// Static schema options for `npx auth` CLI commands; never an initialized auth instance.
export const options = createAuthOptions({} as GenericCtx<DataModel>);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Only request-time initialization reaches this path. Convex module analysis
  // imports schema/options without runtime environment variables.
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be explicitly configured with at least 32 characters");
  }
  getAuthOrigins();
  return betterAuth({ ...createAuthOptions(ctx), secret });
};
