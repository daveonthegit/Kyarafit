import type { Account, BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import * as z from "zod";

/**
 * Native (Expo) OAuth with browser-bound state and a PKCE-bound return code.
 *
 * Replaces `@convex-dev/better-auth`'s `crossDomain` plugin, which forces
 * `skipStateCookieCheck: true` because the app starts OAuth with `fetch` and the browser
 * finishing the flow never holds the state cookie. Here the browser that completes the flow
 * first opens `/native/authorize` on the auth host, which sets the signed state cookie
 * Better Auth's callback verifies. The callback then returns a short-lived single-use code,
 * never a session, and only the app holding the PKCE verifier can redeem it — so an app that
 * intercepts the return link (custom-scheme fallback, or an unclaimed https link) gets nothing.
 */

/** Path the app claims as a Universal Link / App Link; `kyarafit://` reuses it as a fallback. */
export const NATIVE_RETURN_PATH = "/native/auth/return";
export const NATIVE_CHALLENGE_HEADER = "x-kyarafit-code-challenge";

const FLOW_PREFIX = "native-oauth-flow:";
const CODE_PREFIX = "native-oauth-code:";
const FLOW_TTL_MS = 10 * 60 * 1000;
const CODE_TTL_MS = 2 * 60 * 1000;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9_-]{43,128}$/;

/** Whether `value` (any query or fragment ignored) is an accepted native OAuth return URL. */
export function isNativeReturnURL(
  value: unknown,
  { siteUrl, development }: { siteUrl?: string; development: boolean }
): boolean {
  if (typeof value !== "string") return false;
  const bare = value.split(/[?#]/)[0];
  // Standalone builds create kyarafit:///native/auth/return; the web fallback links kyarafit://….
  if (/^kyarafit:\/\/\/?native\/auth\/return$/.test(bare)) return true;
  if (siteUrl && bare === `${new URL(siteUrl).origin}${NATIVE_RETURN_PATH}`) return true;
  // Expo Go builds return through exp://<host>/--/<path>; only isolated dev deployments allow it.
  return development && /^exp:\/\/[^/?#]+\/--\/native\/auth\/return$/.test(bare);
}

/** RFC 7636 S256: base64url(SHA-256(verifier)), unpadded. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Flow = {
  challenge: string;
  authorizationURL: string;
  returnURL: string;
  initiatorId?: string;
};
type LinkAccount = Pick<Account, "userId" | "providerId" | "accountId"> & Partial<Account>;
type Code = { challenge: string } & (
  | { kind: "sign-in"; token: string }
  | { kind: "link"; initiatorId: string; account: LinkAccount; existingId?: string }
);

function callbackState(ctx: { query?: { state?: unknown }; body?: { state?: unknown } }): string {
  const state = ctx.query?.state ?? ctx.body?.state;
  return typeof state === "string" ? state : "";
}

export const nativeOAuth = (options: { isReturnURL: (url: unknown) => boolean }) => {
  const startsNativeFlow = (ctx: { path?: string; body?: { callbackURL?: unknown } }) =>
    (ctx.path === "/sign-in/social" || ctx.path === "/link-social") &&
    options.isReturnURL(ctx.body?.callbackURL);

  return {
    id: "kyarafit-native-oauth",
    init() {
      // The bound flow relies on database state plus the signed `state` cookie check.
      return {
        context: {
          oauthConfig: { storeStateStrategy: "database" as const, skipStateCookieCheck: false },
        },
      };
    },
    hooks: {
      before: [
        {
          matcher: (ctx) => Boolean(ctx.path?.startsWith("/callback/")),
          handler: createAuthMiddleware(async (ctx) => {
            const adapter = ctx.context.internalAdapter;
            const state = await adapter.findVerificationValue(callbackState(ctx));
            const stateData = state
              ? (JSON.parse(state.value) as { callbackURL?: string; link?: { userId: string } })
              : null;
            if (!stateData?.link || !options.isReturnURL(stateData.callbackURL)) return;
            const stored = await adapter.findVerificationValue(
              `${FLOW_PREFIX}${callbackState(ctx)}`
            );
            if (!stored || stored.expiresAt.getTime() < Date.now())
              throw new APIError("BAD_REQUEST");
            const flow = JSON.parse(stored.value) as Flow;
            if (
              flow.initiatorId !== stateData.link.userId ||
              flow.returnURL !== stateData.callbackURL
            )
              throw new APIError("BAD_REQUEST");
            const defer = async (account: LinkAccount, existingId?: string): Promise<never> => {
              if (account.userId !== flow.initiatorId) throw new APIError("BAD_REQUEST");
              const code = generateRandomString(32);
              const value: Code = {
                kind: "link",
                initiatorId: flow.initiatorId!,
                challenge: flow.challenge,
                account,
                existingId,
              };
              await adapter.createVerificationValue({
                identifier: `${CODE_PREFIX}${code}`,
                value: JSON.stringify(value),
                expiresAt: new Date(Date.now() + CODE_TTL_MS),
              });
              const target = new URL(flow.returnURL);
              target.searchParams.set("code", code);
              throw ctx.redirect(target.toString());
            };
            ctx.context.internalAdapter = {
              ...adapter,
              createAccount: (account: LinkAccount) => defer(account),
              updateAccount: async (id: string, data: Partial<Account>) => {
                const account = (await adapter.findAccounts(flow.initiatorId!)).find(
                  (account) => account.id === id
                );
                if (!account) throw new APIError("BAD_REQUEST");
                return defer({ ...account, ...data }, id);
              },
            };
          }),
        },
        {
          matcher: startsNativeFlow,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.path === "/link-social" && ctx.body?.idToken) throw new APIError("BAD_REQUEST");
            if (!CHALLENGE.test(ctx.headers?.get(NATIVE_CHALLENGE_HEADER) ?? "")) {
              throw new APIError("BAD_REQUEST", {
                message: "Native sign-in requires a PKCE code challenge",
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: startsNativeFlow,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { url?: unknown } | undefined;
            if (!returned || typeof returned.url !== "string") return;
            const state = new URL(returned.url).searchParams.get("state");
            if (!state) return;
            const flow: Flow = {
              challenge: ctx.headers!.get(NATIVE_CHALLENGE_HEADER)!,
              authorizationURL: returned.url,
              returnURL: String(ctx.body!.callbackURL),
            };
            if (ctx.path === "/link-social") {
              const session = await getSessionFromCtx(ctx);
              if (!session) throw new APIError("UNAUTHORIZED");
              flow.initiatorId = session.user.id;
            }
            await ctx.context.internalAdapter.createVerificationValue({
              identifier: `${FLOW_PREFIX}${state}`,
              value: JSON.stringify(flow),
              expiresAt: new Date(Date.now() + FLOW_TTL_MS),
            });
            // The app opens this in the browser that will complete the flow, never the provider URL.
            const authorize = `${ctx.context.baseURL}/native/authorize?state=${encodeURIComponent(state)}`;
            return ctx.json({ ...returned, url: authorize });
          }),
        },
        {
          matcher: (ctx) => Boolean(ctx.path?.startsWith("/callback/")),
          handler: createAuthMiddleware(async (ctx) => {
            const location = ctx.context.responseHeaders?.get("location");
            if (!location || !options.isReturnURL(location)) return;
            // The browser that finished the flow must not keep the app's session or JWT cookies.
            ctx.context.responseHeaders?.delete("set-cookie");
            const target = new URL(location);
            const state = callbackState(ctx);
            const stored = state
              ? await ctx.context.internalAdapter.findVerificationValue(`${FLOW_PREFIX}${state}`)
              : null;
            if (state) {
              await ctx.context.internalAdapter.deleteVerificationByIdentifier(
                `${FLOW_PREFIX}${state}`
              );
            }
            if (!stored) {
              target.search = "";
              target.searchParams.set("error", "native_flow_not_bound");
              throw ctx.redirect(target.toString());
            }
            const session = ctx.context.newSession;
            if (!session) throw ctx.redirect(target.toString());
            const code = generateRandomString(32);
            const value: Code = {
              kind: "sign-in",
              token: session.session.token,
              challenge: (JSON.parse(stored.value) as Flow).challenge,
            };
            await ctx.context.internalAdapter.createVerificationValue({
              identifier: `${CODE_PREFIX}${code}`,
              value: JSON.stringify(value),
              expiresAt: new Date(Date.now() + CODE_TTL_MS),
            });
            target.searchParams.set("code", code);
            throw ctx.redirect(target.toString());
          }),
        },
      ],
    },
    endpoints: {
      nativeAuthorize: createAuthEndpoint(
        "/native/authorize",
        { method: "GET", query: z.object({ state: z.string().min(1).max(256) }) },
        async (ctx) => {
          const { state } = ctx.query;
          const stored = await ctx.context.internalAdapter.findVerificationValue(
            `${FLOW_PREFIX}${state}`
          );
          if (!stored || stored.expiresAt.getTime() < Date.now()) {
            throw new APIError("BAD_REQUEST", { message: "Sign-in link expired" });
          }
          const flow = JSON.parse(stored.value) as Flow;
          // Same cookie Better Auth sets when the browser itself starts the flow (state.ts).
          const cookie = ctx.context.createAuthCookie("state", { maxAge: 300 });
          await ctx.setSignedCookie(cookie.name, state, ctx.context.secret, cookie.attributes);
          throw ctx.redirect(flow.authorizationURL);
        }
      ),
      nativeToken: createAuthEndpoint(
        "/native/token",
        {
          method: "POST",
          body: z.object({ code: z.string().min(1).max(128), verifier: z.string() }),
        },
        async (ctx) => {
          const { code, verifier } = ctx.body;
          const identifier = `${CODE_PREFIX}${code}`;
          const stored = await ctx.context.internalAdapter.consumeVerificationValue(identifier);
          const invalid = new APIError("BAD_REQUEST", { message: "Invalid sign-in code" });
          if (!stored || stored.expiresAt.getTime() < Date.now() || !VERIFIER.test(verifier)) {
            throw invalid;
          }
          const value = JSON.parse(stored.value) as Code;
          if (!sameSecret(await pkceChallenge(verifier), value.challenge)) throw invalid;
          if (value.kind === "link") {
            const session = await getAuthoritativeSessionFromCtx(ctx);
            if (
              !session ||
              session.user.id !== value.initiatorId ||
              value.account.userId !== session.user.id
            )
              throw invalid;
            const existing = await ctx.context.internalAdapter.findAccountByProviderId(
              value.account.accountId,
              value.account.providerId
            );
            if (existing && existing.userId !== session.user.id) throw invalid;
            const account = { ...value.account };
            for (const key of [
              "accessTokenExpiresAt",
              "refreshTokenExpiresAt",
              "createdAt",
              "updatedAt",
            ] as const) {
              if (account[key]) account[key] = new Date(account[key]);
            }
            if (value.existingId) {
              if (existing?.id !== value.existingId) throw invalid;
              await ctx.context.internalAdapter.updateAccount(existing.id, account);
            } else {
              if (existing) throw invalid;
              await ctx.context.internalAdapter.createAccount(account);
            }
            return ctx.json({ linked: true });
          }
          const session = await ctx.context.internalAdapter.findSession(value.token);
          if (!session) throw invalid;
          return ctx.json({ token: value.token, user: session.user });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
};
