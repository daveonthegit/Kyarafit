import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { isMutationCtx, isRunMutationCtx, type GenericCtx } from "@convex-dev/better-auth/utils";
import { makeFunctionReference } from "convex/server";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "../emailHelpers";
import { deleteUserOwnedData } from "../lib/accountDeletion";
import { deletionJob } from "../lib/deletionReferences";
import { isNativeReturnURL, nativeOAuth } from "./nativeOAuth";

/** Better Auth's default; the web app proxies `/api/auth/*` here so cookies stay first-party. */
export const AUTH_BASE_PATH = "/api/auth";
const accountAvailable = makeFunctionReference<"query", { externalId: string }, boolean>(
  "emailRecipients:accountAvailable"
);
async function recipientAvailable(ctx: GenericCtx<DataModel>, externalId: string) {
  return "db" in ctx
    ? !(await deletionJob(ctx, externalId))
    : ctx.runQuery(accountAvailable, { externalId });
}

export const authComponent = createClient<DataModel, typeof schema>(components.betterAuth, {
  local: { schema },
  verbose: false,
});

/** One source for HTTP CORS and Better Auth's CSRF origins. Default is release-safe.
 * Convex dev deployments also run production bundles, so NODE_ENV is not a dev signal.
 * Set AUTH_ENVIRONMENT=development only on an isolated development deployment.
 */
function isDevelopmentAuth() {
  const environment = process.env.AUTH_ENVIRONMENT ?? "production";
  if (environment !== "production" && environment !== "development") {
    throw new Error("AUTH_ENVIRONMENT must be production or development");
  }
  return environment === "development";
}

export function getAuthOrigins() {
  const development = isDevelopmentAuth();
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
    // kyarafit:// is only the PKCE-bound fallback for native OAuth returns (nativeOAuth.ts);
    // the claimed https return lives on SITE_URL.
    trustedOrigins: [...corsOrigins, "kyarafit://", "https://appleid.apple.com"],
  };
}

// Also consumed by Convex's createApi during module analysis, before deployment env
// is available. Building schema/options must not initialize auth or require secrets.
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  // Auth is served from the web origin: Next.js proxies SITE_URL/api/auth/* to this deployment,
  // so OAuth redirect_uri, the OAuth state cookie and the HttpOnly session cookie are all
  // first-party to the app. Providers must register SITE_URL/api/auth/callback/<provider>.
  // CONVEX_SITE_URL is only a fallback for module analysis and non-web tooling.
  const authOrigin = siteUrl ?? convexSiteUrl;
  const baseURL = authOrigin ? `${authOrigin.replace(/\/$/, "")}${AUTH_BASE_PATH}` : undefined;
  return {
    appName: "Kyarafit",
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: process.env.BETTER_AUTH_SECRET,
    // Better Auth defaults: HttpOnly, SameSite=Lax, host-only. Secure (and the __Secure- prefix)
    // follow the https baseURL, which production enforces. Apple's form_post callback is
    // re-issued by Better Auth as a top-level GET, which carries Lax cookies.
    // Resolve the shared origin policy only at runtime, not during schema analysis.
    trustedOrigins: () => getAuthOrigins().trustedOrigins,
    database: authComponent.adapter(ctx),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({
        user,
        url,
      }: {
        user: { id: string; email: string };
        url: string;
      }) => {
        if (await recipientAvailable(ctx, user.id)) await sendPasswordResetEmail(user.email, url);
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { id: string; email: string };
        url: string;
      }) => {
        if (await recipientAvailable(ctx, user.id)) await sendVerificationEmail(user.email, url);
      },
    },

    account: {
      // Database state plus the signed state cookie: the OAuth flow is bound to its browser.
      storeStateStrategy: "database",
      skipStateCookieCheck: false,
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "apple"],
        allowDifferentEmails: false,
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
          if (isMutationCtx(ctx)) {
            await deleteUserOwnedData(ctx, user.id);
          } else if (isRunMutationCtx(ctx)) {
            await ctx.runMutation(
              makeFunctionReference<"mutation", { externalId: string }>("accountDeletion:begin"),
              { externalId: user.id }
            );
          } else {
            throw new Error("Account deletion requires a mutation-capable context");
          }
        },
      },
    },

    plugins: [
      convex({ authConfig, options: { basePath: AUTH_BASE_PATH } }),
      nativeOAuth({
        isReturnURL: (url) => isNativeReturnURL(url, { siteUrl, development: isDevelopmentAuth() }),
      }),
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
  if (!process.env.SITE_URL) {
    throw new Error("SITE_URL must name the web origin that proxies /api/auth");
  }
  getAuthOrigins();
  return betterAuth({ ...createAuthOptions(ctx), secret });
};
