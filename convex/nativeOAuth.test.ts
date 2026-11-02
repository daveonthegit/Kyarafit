import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins";
import {
  NATIVE_CHALLENGE_HEADER,
  isNativeReturnURL,
  nativeOAuth,
  pkceChallenge,
} from "./betterAuth/nativeOAuth";

let config: typeof import("./betterAuth/auth");
const SITE = "https://app.example.invalid";
const BASE = `${SITE}/api/auth`;
const NATIVE_RETURN = `${SITE}/native/auth/return`;
// Synthetic, test-only configuration, never deployed.
const testSecret = "native-oauth-local-fixture-not-for-deployment";
const VERIFIER = "native-verifier-fixture-".padEnd(64, "x");

beforeAll(async () => {
  config = await import("./betterAuth/auth");
});
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", testSecret);
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("CONVEX_SITE_URL", "https://auth.example.invalid");
  vi.stubEnv("AUTH_ENVIRONMENT", "production");
  vi.stubEnv("ADDITIONAL_CORS_ORIGINS", "");
  // Google's token endpoint; the profile comes from the getUserInfo override below.
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    Response.json({ access_token: "access", id_token: "id", token_type: "Bearer" })
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeAuth() {
  const options = config.createAuthOptions({} as never);
  const store = { user: [], account: [], session: [], verification: [] };
  const auth = betterAuth({
    ...options,
    secret: testSecret,
    database: memoryAdapter(store),
    // The Convex plugin needs a Convex deployment; the bound flow is nativeOAuth's alone.
    plugins: [
      ...options.plugins.filter((plugin) => plugin.id === "kyarafit-native-oauth"),
      bearer(),
    ],
    socialProviders: {
      google: {
        clientId: "client-fixture",
        clientSecret: "client-secret-fixture",
        getUserInfo: async () => ({
          user: {
            id: "google-subject",
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
  const call = (path: string, init?: RequestInit) =>
    auth.handler(new Request(path.startsWith("http") ? path : `${BASE}${path}`, init));
  return { call, store, auth };
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

function cookiePairs(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function startNative(call: ReturnType<typeof makeAuth>["call"], returnURL = NATIVE_RETURN) {
  const started = await call(
    "/sign-in/social",
    json(
      { provider: "google", callbackURL: returnURL, disableRedirect: true },
      { [NATIVE_CHALLENGE_HEADER]: await pkceChallenge(VERIFIER) }
    )
  );
  expect(started.status).toBe(200);
  const { url } = (await started.json()) as { url: string };
  return url;
}

async function completeNative(call: ReturnType<typeof makeAuth>["call"]) {
  const authorize = await call(await startNative(call));
  expect(authorize.status).toBe(302);
  const provider = new URL(authorize.headers.get("location")!);
  expect(provider.origin).toBe("https://accounts.google.com");
  const callback = await call(
    `/callback/google?state=${provider.searchParams.get("state")}&code=provider-code`,
    { headers: { cookie: cookiePairs(authorize) } }
  );
  return callback;
}

describe("native OAuth", () => {
  it("binds the flow to the opening browser and returns only a PKCE-bound code", async () => {
    const { call, store } = makeAuth();
    const url = await startNative(call);
    // The app is handed the auth-host authorize step, never the provider URL itself.
    expect(url.startsWith(`${BASE}/native/authorize?state=`)).toBe(true);

    const callback = await completeNative(call);
    expect(callback.status).toBe(302);
    const target = new URL(callback.headers.get("location")!);
    expect(`${target.origin}${target.pathname}`).toBe(NATIVE_RETURN);
    const code = target.searchParams.get("code")!;
    expect(code).toBeTruthy();
    // The finishing browser gets no session or other auth cookies.
    expect(callback.headers.getSetCookie()).toEqual([]);

    const redeemed = await call("/native/token", json({ code, verifier: VERIFIER }));
    expect(redeemed.status).toBe(200);
    const { token } = (await redeemed.json()) as { token: string };
    expect(store.session.map((s: { token: string }) => s.token)).toContain(token);

    const replay = await call("/native/token", json({ code, verifier: VERIFIER }));
    expect(replay.status).toBe(400);
  });

  it("burns a code presented with the wrong verifier", async () => {
    const { call } = makeAuth();
    const code = new URL((await completeNative(call)).headers.get("location")!).searchParams.get(
      "code"
    );
    const wrong = await call("/native/token", json({ code, verifier: "w".repeat(43) }));
    expect(wrong.status).toBe(400);
    const right = await call("/native/token", json({ code, verifier: VERIFIER }));
    expect(right.status).toBe(400);
  });

  it("rejects a native return without a challenge, and a callback without the state cookie", async () => {
    const { call } = makeAuth();
    const unbound = await call(
      "/sign-in/social",
      json({ provider: "google", callbackURL: NATIVE_RETURN, disableRedirect: true })
    );
    expect(unbound.status).toBe(400);

    const authorize = await call(await startNative(call));
    const state = new URL(authorize.headers.get("location")!).searchParams.get("state");
    const elsewhere = await call(`/callback/google?state=${state}&code=provider-code`);
    expect(elsewhere.status).toBe(302);
    expect(elsewhere.headers.get("location")).toContain("error=");
    expect(elsewhere.headers.get("location")).not.toContain("code=");
  });

  it("refuses unknown or expired authorize steps instead of redirecting anywhere", async () => {
    const { call } = makeAuth();
    const response = await call("/native/authorize?state=unknown");
    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
  });

  it("accepts only the claimed https return, the scheme fallback and dev-only Expo Go", () => {
    const prod = { siteUrl: SITE, development: false };
    expect(isNativeReturnURL(`${NATIVE_RETURN}?code=x`, prod)).toBe(true);
    expect(isNativeReturnURL("kyarafit://native/auth/return", prod)).toBe(true);
    expect(isNativeReturnURL("kyarafit:///native/auth/return?code=x", prod)).toBe(true);
    expect(isNativeReturnURL("kyarafit://evil/native/auth/return", prod)).toBe(false);
    expect(isNativeReturnURL(`${SITE}/home`, prod)).toBe(false);
    expect(isNativeReturnURL("https://evil.example.invalid/native/auth/return", prod)).toBe(false);
    expect(isNativeReturnURL("exp://192.0.2.1:8081/--/native/auth/return", prod)).toBe(false);
    expect(
      isNativeReturnURL("exp://192.0.2.1:8081/--/native/auth/return", {
        siteUrl: SITE,
        development: true,
      })
    ).toBe(true);
  });
});

async function linkFixture(
  email = "native@example.invalid",
  existing = false,
  postCallback = false
) {
  const fixture = makeAuth();
  const context = await fixture.auth.$context;
  const user = await context.internalAdapter.createUser({
    email,
    emailVerified: true,
    name: "Initiator",
  });
  const session = await context.internalAdapter.createSession(user.id);
  const other = await context.internalAdapter.createUser({
    email: "other@example.invalid",
    emailVerified: true,
    name: "Other",
  });
  const otherSession = await context.internalAdapter.createSession(other.id);
  if (existing)
    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: "google",
      accountId: "google-subject",
      accessToken: "original",
    });
  const started = await fixture.call(
    "/link-social",
    json(
      { provider: "google", callbackURL: NATIVE_RETURN, disableRedirect: true },
      {
        Authorization: `Bearer ${session.token}`,
        [NATIVE_CHALLENGE_HEADER]: await pkceChallenge(VERIFIER),
      }
    )
  );
  expect(started.status).toBe(200);
  const { url } = (await started.json()) as { url: string };
  const browser = await fixture.call(url);
  expect(browser.status).toBe(302);
  const state = new URL(browser.headers.get("location")!).searchParams.get("state");
  let callback = postCallback
    ? await fixture.call("/callback/google", {
        method: "POST",
        headers: {
          cookie: cookiePairs(browser),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ state: state!, code: "victim-code" }),
      })
    : await fixture.call(`/callback/google?state=${state}&code=victim-code`, {
        headers: { cookie: cookiePairs(browser) },
      });
  if (postCallback)
    callback = await fixture.call(callback.headers.get("location")!, {
      headers: { cookie: cookiePairs(browser) },
    });
  return { ...fixture, context, session, otherSession, user, callback };
}

describe("native deferred linking", () => {
  it("handles form-post callbacks and consumes pending links once under concurrent redemption", async () => {
    const { call, callback, store, session } = await linkFixture(undefined, false, true);
    expect(callback.status).toBe(302);
    const code = new URL(callback.headers.get("location")!).searchParams.get("code");
    expect(code).toBeTruthy();
    expect(store.account).toHaveLength(0);
    const attempts = await Promise.all(
      Array.from({ length: 2 }, () =>
        call(
          "/native/token",
          json({ code, verifier: VERIFIER }, { Authorization: `Bearer ${session.token}` })
        )
      )
    );
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(store.account).toHaveLength(1);
  });

  it("rejects native-return inline-token linking before provider processing", async () => {
    const { call, store } = makeAuth();
    const response = await call(
      "/link-social",
      json(
        { provider: "google", callbackURL: NATIVE_RETURN, idToken: { token: "inline" } },
        { [NATIVE_CHALLENGE_HEADER]: await pkceChallenge(VERIFIER) }
      )
    );
    expect(response.status).toBe(400);
    expect(store.account).toHaveLength(0);
  });
  it("does not link a victim's differing-email identity after opening the attacker's authorize URL", async () => {
    const { callback, store, call, session } = await linkFixture("attacker@example.invalid");
    expect(callback.status).toBe(302);
    const target = new URL(callback.headers.get("location")!);
    expect(target.searchParams.get("error")).toBe("email_doesn't_match");
    expect(target.searchParams.has("code")).toBe(false);
    expect(store.account).toHaveLength(0);
    for (const headers of [{}, { Authorization: `Bearer ${session.token}` }]) {
      expect(
        (await call("/native/token", json({ code: "absent", verifier: VERIFIER }, headers))).status
      ).toBe(400);
    }
    expect(store.account).toHaveLength(0);
  });

  for (const attempt of [
    "anonymous",
    "other-session",
    "wrong-verifier",
    "expired",
    "valid",
  ] as const) {
    for (const existing of [false, true]) {
      it(`${attempt} redemption ${existing ? "updates" : "creates"} a link only with both initiating proofs`, async () => {
        const { call, store, callback, session, otherSession, user } = await linkFixture(
          undefined,
          existing
        );
        expect(callback.status).toBe(302);
        expect(callback.headers.getSetCookie()).toEqual([]);
        const code = new URL(callback.headers.get("location")!).searchParams.get("code");
        expect(code).toBeTruthy();
        expect(store.account).toHaveLength(existing ? 1 : 0);
        if (existing)
          expect((store.account[0] as { accessToken: string }).accessToken).toBe("original");
        const headers: Record<string, string> =
          attempt === "anonymous"
            ? {}
            : {
                Authorization: `Bearer ${attempt === "other-session" ? otherSession.token : session.token}`,
              };
        if (attempt === "expired") {
          for (const entry of store.verification as Array<{ expiresAt: Date }>)
            entry.expiresAt = new Date(Date.now() - 1);
        }
        const redeemed = await call(
          "/native/token",
          json(
            { code, verifier: attempt === "wrong-verifier" ? "w".repeat(64) : VERIFIER },
            headers
          )
        );
        expect(redeemed.status).toBe(attempt === "valid" ? 200 : 400);
        if (attempt === "valid") {
          expect(await redeemed.json()).toEqual({ linked: true });
          expect(store.account).toHaveLength(1);
          expect(store.account[0]).toMatchObject({
            userId: user.id,
            providerId: "google",
            accountId: "google-subject",
            accessToken: "access",
          });
        } else {
          expect(store.account).toHaveLength(existing ? 1 : 0);
          if (existing)
            expect((store.account[0] as { accessToken: string }).accessToken).toBe("original");
        }
        expect(
          (
            await call(
              "/native/token",
              json({ code, verifier: VERIFIER }, { Authorization: `Bearer ${session.token}` })
            )
          ).status
        ).toBe(400);
      });
    }
  }
});

describe("web OAuth", () => {
  it("checks the state cookie and sets an HttpOnly, Secure, Lax session cookie", async () => {
    const { call } = makeAuth();
    const started = await call(
      "/sign-in/social",
      json({ provider: "google", callbackURL: "/home" }, { origin: SITE })
    );
    const { url } = (await started.json()) as { url: string };
    const state = new URL(url).searchParams.get("state");

    const forged = await call(`/callback/google?state=${state}&code=provider-code`);
    expect(forged.headers.get("location")).toBe(`${BASE}/error?error=state_mismatch`);

    const again = await call(
      "/sign-in/social",
      json({ provider: "google", callbackURL: "/home" }, { origin: SITE })
    );
    const againState = new URL(((await again.json()) as { url: string }).url).searchParams.get(
      "state"
    );
    const callback = await call(`/callback/google?state=${againState}&code=provider-code`, {
      headers: { cookie: cookiePairs(again) },
    });
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/home");
    const session = callback.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("__Secure-better-auth.session_token="));
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/Secure/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).not.toMatch(/Domain=/i);
  });
});
