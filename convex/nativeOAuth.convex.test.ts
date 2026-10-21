import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { createAuthOptions } from "./betterAuth/auth";
import schema from "./schema";
import authSchema from "./betterAuth/schema";
import { pkceChallenge } from "./betterAuth/nativeOAuth";

const modules = import.meta.glob("./**/*.ts");
const authModules = import.meta.glob("./betterAuth/**/*.ts");

const site = "https://app.example.invalid";
const verifier = "local-verifier-".padEnd(64, "x");

beforeEach(() => {
  vi.stubEnv("SITE_URL", site);
  vi.stubEnv("CONVEX_SITE_URL", "https://auth.example.invalid");
  vi.stubEnv("BETTER_AUTH_SECRET", "disposable-convex-native-oauth-regression-secret");
  vi.stubEnv("AUTH_ENVIRONMENT", "production");
  vi.stubEnv("ADDITIONAL_CORS_ORIGINS", "");
  vi.stubEnv("GOOGLE_CLIENT_ID", "disposable-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "disposable-client-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("opens the native authorize step using verification state persisted by the real Convex adapter", async () => {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", authSchema, authModules);
  const start = await t.fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: site,
      "x-kyarafit-code-challenge": await pkceChallenge(verifier),
    },
    body: JSON.stringify({
      provider: "google",
      callbackURL: `${site}/native/auth/return`,
      disableRedirect: true,
    }),
  });
  expect(start.status).toBe(200);
  const { url } = await start.json();
  const authorize = await t.fetch(new URL(url).pathname + new URL(url).search);
  expect(authorize.status).toBe(302);
  expect(new URL(authorize.headers.get("location")!).origin).toBe("https://accounts.google.com");
  expect(authorize.headers.getSetCookie().length).toBeGreaterThan(0);
});

it.each([false, true])(
  "redeems a native flow with real persisted timestamps (link=%s)",
  async (link) => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ access_token: "access", token_type: "Bearer" })
    );
    const t = convexTest(schema, modules);
    t.registerComponent("betterAuth", authSchema, authModules);
    await t.run(async (ctx) => {
      const options = createAuthOptions(ctx);
      const auth = betterAuth({
        ...options,
        // Keep real Convex persistence; only replace provider transport and JWT issuance.
        plugins: [
          ...options.plugins.filter((plugin) => plugin.id === "kyarafit-native-oauth"),
          bearer(),
        ],
        socialProviders: {
          google: {
            clientId: "disposable-client",
            clientSecret: "disposable-client-secret",
            getUserInfo: async () => ({
              user: {
                id: "provider-subject",
                email: "native@example.invalid",
                emailVerified: true,
                name: "Native",
              },
              data: {},
            }),
          },
        },
        rateLimit: { enabled: false },
      });
      const context = await auth.$context;
      const call = (path: string, init?: RequestInit) =>
        auth.handler(new Request(`${site}/api/auth${path}`, init));
      const post = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: site, ...headers },
        body: JSON.stringify(body),
      });
      let token: string | undefined;
      let initiatorId: string | undefined;
      if (link) {
        const user = await context.internalAdapter.createUser({
          email: "native@example.invalid",
          emailVerified: true,
          name: "Initiator",
        });
        initiatorId = user.id;
        token = (await context.internalAdapter.createSession(user.id)).token;
      }
      const started = await call(
        link ? "/link-social" : "/sign-in/social",
        post(
          {
            provider: "google",
            callbackURL: `${site}/native/auth/return`,
            disableRedirect: true,
          },
          {
            "x-kyarafit-code-challenge": await pkceChallenge(verifier),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          }
        )
      );
      expect(started.status).toBe(200);
      const { url } = await started.json();
      const authorize = await auth.handler(new Request(url));
      expect(authorize.status).toBe(302);
      const state = new URL(authorize.headers.get("location")!).searchParams.get("state");
      // A different browser has only the flow's state cookie, not the app session.
      const callback = await call(`/callback/google?state=${state}&code=provider-code`, {
        headers: {
          cookie: authorize.headers
            .getSetCookie()
            .map((cookie) => cookie.split(";")[0])
            .join("; "),
        },
      });
      expect(callback.status).toBe(302);
      const code = new URL(callback.headers.get("location")!).searchParams.get("code");
      expect(code).toBeTruthy();
      if (initiatorId) expect(await context.internalAdapter.findAccounts(initiatorId)).toEqual([]);
      const redeemed = await call(
        "/native/token",
        post({ code, verifier }, token ? { Authorization: `Bearer ${token}` } : {})
      );
      expect(redeemed.status).toBe(200);
      if (initiatorId) {
        expect(await redeemed.json()).toEqual({ linked: true });
        expect(await context.internalAdapter.findAccounts(initiatorId)).toEqual([
          expect.objectContaining({ providerId: "google", accountId: "provider-subject" }),
        ]);
      } else {
        const result = await redeemed.json();
        expect(result.token).toBeTruthy();
        expect(await context.internalAdapter.findSession(result.token)).toBeTruthy();
      }
      const replay = await call(
        "/native/token",
        post({ code, verifier }, token ? { Authorization: `Bearer ${token}` } : {})
      );
      expect(replay.status).toBe(400);
    });
  }
);
