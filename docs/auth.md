# Authentication

Kyarafit uses **Better Auth** backed by **Convex** for both web (Next.js) and mobile (Expo).
Supported methods: email + password and OAuth (Google required, Apple optional).

---

## Architecture

```
Browser (app.kyarafit.com)                Mobile app
        │  same-origin /api/auth/*               │  https://<deployment>.convex.site/api/auth/*
        │  HttpOnly session cookie               │  Authorization: Bearer <session> (keychain)
        ▼                                        │
Next.js proxy  web/src/app/api/auth/[...all]     │
        │  (strips session tokens from bodies)   │
        ▼                                        ▼
Better Auth HTTP actions  (convex.site/api/auth/*, baseURL = SITE_URL/api/auth)
        │
        ▼
Convex database  (user, session, account, verification, jwks tables)
        │  short-lived Convex JWT (/api/auth/convex/token)
        ▼
Convex queries & mutations  (authenticated via ConvexBetterAuthProvider)
```

Better Auth's `baseURL` is the **web origin** (`SITE_URL/api/auth`), which Next.js proxies to
Convex. OAuth `redirect_uri`, the OAuth state cookie and the session cookie are therefore all
first-party to the app:

| Client | Credential                         | Where it lives                       | Sent as                   |
| ------ | ---------------------------------- | ------------------------------------ | ------------------------- |
| Web    | Session cookie                     | HttpOnly, Secure, SameSite=Lax, host | Cookie (same-origin)      |
| Web    | Convex JWT (short-lived)           | Memory (Convex client)               | Convex socket auth        |
| Mobile | Session token (`bearer` in convex) | `expo-secure-store`, this device     | `Authorization: Bearer …` |

Web script never stores a session token: the auth client has no bearer or cross-domain
plugin, and the proxy (`web/src/lib/auth/proxy.ts`) removes `token` / `session.token` from
JSON bodies and the `set-auth-token` header. Only `/api/auth/convex/token` passes its JWT
through, because the Convex client needs it.

**CSRF:** the session cookie is `SameSite=Lax`, and Better Auth rejects cookie-bearing
mutations whose `Origin` is not in `trustedOrigins`. Web documents carry a per-request
nonce-based Content-Security-Policy (`web/src/lib/security/csp.ts`, set in
`web/src/middleware.ts`): no `'unsafe-inline'` or `'unsafe-eval'` for scripts in any environment.
The document style policy permits inline styles for React style attributes and runtime-injected
cropper/motion styles. API responses instead use `default-src 'none'; frame-ancestors 'none'`.

---

## Origin Configuration — CRITICAL

Better Auth has **two independent origin checks** that must both be satisfied. Getting only one
right produces a 403:

### Shared CORS and trusted-origin policy

`getAuthOrigins()` in `convex/betterAuth/auth.ts` is the single policy source. Both the
HTTP route registration in `convex/http.ts` (browser CORS) and Better Auth's trusted-origin
check (CSRF/callback validation) consume it at request time. Do not maintain separate lists.

Production is the default, independent of `NODE_ENV`. Configured `SITE_URL` and
`ADDITIONAL_CORS_ORIGINS` values must be non-loopback HTTPS origins, without paths,
credentials, query strings, or fragments. Invalid configuration fails closed. `SITE_URL` is
required: auth initialization fails without it, because it hosts the auth endpoints.

Only an isolated development deployment may set `AUTH_ENVIRONMENT=development`; this
permits HTTP/Expo origins and includes the built-in localhost origins. For physical-device
testing, configure that deployment, not production:

```dotenv
AUTH_ENVIRONMENT=development
SITE_URL=http://localhost:3000
ADDITIONAL_CORS_ORIGINS=exp://192.168.1.42:8081,http://192.168.1.42:8081
```

`kyarafit://` stays trusted only as the PKCE-bound fallback for native OAuth returns, plus the
Apple callback origin. The executable origin policy and regressions live in
`convex/betterAuth/auth.ts` and `convex/authConfig.test.ts`.

> **Symptom of missing trusted origin:** `POST /api/auth/sign-in/email` or `/api/auth/sign-up/email`
> returns **403 Forbidden** even though the CORS preflight succeeds.

---

## Auth Flows

### Email + password — web

1. `authClient.signIn.email({ email, password })` → same-origin POST `/api/auth/sign-in/email`
2. The proxy forwards it to Convex; Better Auth sets the HttpOnly session cookie
3. `router.push("/home")`; `ConvexBetterAuthProvider` fetches a Convex JWT with that cookie

Sign-up is similar but requires email verification (`requireEmailVerification: true`).
After `signUp.email()` succeeds the user receives a verification email; until they click
the link, sign-in returns an "email not verified" error and the UI shows a resend button.

### Web local access

`useCurrentUser` remembers the last confirmed account id in browser storage. On an offline cold
launch or while remote auth is loading, that id can open the account's local store; it is not a
credential and does not authorize server access. Explicit sign-out clears it; a confirmed absent
session while online also clears it. The offline query bridge waits for Convex authentication
before issuing live queries, while preserving cached reads during refresh. Store isolation and
write guarantees are owned by [Data & Sync §5.1](DATA_AND_SYNC.md#51-current-web-isolation-and-write-guarantees).
Full web local-first operation remains deferred.

### Email + password — mobile

The app calls Convex directly. The sign-in response's session token is stored with
`setStoredBearerToken` (`expo-secure-store`, this device only) and the session atom is refreshed
via `await authClient.getSession()` before navigating. Afterward, mobile route access uses
`useAppSession`, not the live session alone; local access and sign-out semantics follow
[ADR-0004](adr/0004-per-account-local-vault-is-authoritative.md).

### OAuth — web

1. `authClient.signIn.social({ provider, callbackURL: "/home" })` → POST `/api/auth/sign-in/social`
2. Better Auth stores the state in the database **and** sets a signed `state` cookie
3. Browser goes to the provider, which returns to `SITE_URL/api/auth/callback/<provider>`
4. The callback requires the state cookie to match (`skipStateCookieCheck: false`), so a flow
   started in one browser cannot be finished in another (login CSRF)
5. Better Auth sets the session cookie and redirects to `/home`

Apple's `form_post` callback is re-issued by Better Auth as a top-level GET, which carries the
Lax state cookie.

**Linking from Settings:** `linkSocial` compares the provider email to the Better Auth user email. Apple’s private relay address often differs, so `allowDifferentEmails: true` is set in `convex/betterAuth/auth.ts`. For **first-time** sign-in (not Settings), Better Auth still matches existing users by **same email**; use “Share My Email” with Apple if you need one account to merge with an email/password profile.

### OAuth — mobile (Expo)

Server: `convex/betterAuth/nativeOAuth.ts`. Client: `mobile/src/lib/auth/nativeOAuth.ts`.
iOS Apple sign-in uses the native `ASAuthorization` id-token flow instead.

1. The app creates a PKCE verifier and calls `signIn.social` (or `linkSocial`) with
   `callbackURL` = the native return URL and header `x-kyarafit-code-challenge`
2. The server stores the challenge with the OAuth state and returns
   `SITE_URL/api/auth/native/authorize?state=…` instead of the provider URL
3. The app opens that URL in the system auth session; `/native/authorize` sets the signed
   state cookie in **that** browser and redirects to the provider (no arbitrary redirect target)
4. The provider returns to `SITE_URL/api/auth/callback/<provider>`; the state cookie check passes
5. The server strips all cookies from the response and redirects to the native return URL with a
   single-use code (2 minutes)
6. The app POSTs `{ code, verifier }` to `/api/auth/native/token` and stores the session token

Native return URL:

| Platform        | Return URL                                      | How it reaches the app                                              |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| iOS 17.4+       | `https://<web host>/native/auth/return`         | `ASWebAuthenticationSession` https callback (Universal Link domain) |
| Android         | `https://<web host>/native/auth/return`         | App Link (`autoVerify`); web fallback page offers `kyarafit://`     |
| iOS < 17.4, dev | `kyarafit:///native/auth/return` (or `exp://…`) | Auth session scheme callback                                        |

The code is useless without the verifier, which never leaves the app process, so a link that
another app intercepts (custom scheme) or that opens in a browser signs nobody in. A return link
that arrives with no flow in progress on the device is ignored.

### Password reset

1. `authClient.requestPasswordReset({ email, redirectTo })`
2. The email links to `SITE_URL/api/auth/reset-password/<token>?callbackURL=<redirectTo>`
3. Better Auth validates the token and redirects to `<redirectTo>?token=<reset-token>`
4. `authClient.resetPassword({ newPassword, token })`

Web and mobile both use the web reset page `https://<web host>/auth/reset-password`; the reset
token never travels in a `kyarafit://` link. Only builds without `EXPO_PUBLIC_WEB_APP_URL`
(local development) fall back to the in-app screen.

### Email verification (post sign-up)

1. `signUp.email(...)` succeeds → server sends a verification email
2. Email contains `SITE_URL/api/auth/verify-email?token=...` (served through the proxy)
3. Better Auth verifies the token and (with `autoSignInAfterVerification: true`) signs that
   browser in
4. Redirects to `callbackURL` (`/home` on web; the app root `kyarafit:///` on mobile, which
   carries no credential — the user then signs in in the app)

---

## Claimed links (Universal Links / App Links)

The app claims `https://<web host>/native/*` only. The web app serves the association files from
`web/src/lib/appLinks.ts`:

- `/.well-known/apple-app-site-association` — needs `APPLE_TEAM_ID` (and optional
  `IOS_BUNDLE_ID`, default `com.kyarafit.mobile`)
- `/.well-known/assetlinks.json` — needs `ANDROID_CERT_SHA256_FINGERPRINTS` (and optional
  `ANDROID_PACKAGE`, default `com.kyarafit.mobile`)

An unconfigured platform serves 404, so a deployment never claims links for an app identity it
cannot prove. The app side (`mobile/app.config.js`) adds `applinks:` / `webcredentials:`
associated domains and an `autoVerify` intent filter for the host of `EXPO_PUBLIC_WEB_APP_URL`
(default `app.kyarafit.com`). These are public identifiers, not secrets.

---

## Environment Variables

### Convex dashboard (Settings → Environment Variables)

| Variable                  | Description                                                                                                                                                                                   | Required |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `BETTER_AUTH_SECRET`      | Explicit signing secret, at least 32 characters; no fallback. Provision outside source control. Auth initialization fails closed when absent/short; schema analysis does not initialize auth. | **Yes**  |
| `SITE_URL`                | Web app origin that proxies `/api/auth`; Better Auth's `baseURL`. Must satisfy the [origin policy](#shared-cors-and-trusted-origin-policy)                                                    | **Yes**  |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID                                                                                                                                                                        | **Yes**  |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth client secret                                                                                                                                                                    | **Yes**  |
| `AUTH_ENVIRONMENT`        | `production` (default) or `development`; see the origin policy above                                                                                                                          | No       |
| `ADDITIONAL_CORS_ORIGINS` | Comma-separated extra origins subject to the same policy                                                                                                                                      | No       |
| `RESEND_API_KEY`          | Resend API key — required for verification + reset emails                                                                                                                                     | No       |
| `EMAIL_FROM`              | Sender address (`Kyarafit <noreply@yourdomain.com>`) — domain must be verified in Resend                                                                                                      | No       |

### Web (`web/.env.local`, Vercel)

| Variable                           | Description                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`           | Convex backend URL                                          |
| `NEXT_PUBLIC_CONVEX_SITE_URL`      | Convex HTTP actions URL (`*.convex.site`), the proxy target |
| `APPLE_TEAM_ID`                    | Apple Developer Team ID for the association file (public)   |
| `ANDROID_CERT_SHA256_FINGERPRINTS` | Comma-separated app signing certificate SHA-256s (public)   |

### Mobile (`mobile/.env`)

| Variable                      | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `EXPO_PUBLIC_CONVEX_URL`      | Convex backend URL                                                 |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL (`*.convex.site`)                          |
| `EXPO_PUBLIC_WEB_APP_URL`     | Web origin (`https://app.kyarafit.com`): claimed OAuth return host |

---

## Key Files

### Convex (server)

| File                               | Purpose                                                     |
| ---------------------------------- | ----------------------------------------------------------- |
| `convex/betterAuth/auth.ts`        | Better Auth instance — providers, `trustedOrigins`, plugins |
| `convex/betterAuth/nativeOAuth.ts` | Browser-bound, PKCE-bound OAuth for the app                 |
| `convex/betterAuth/schema.ts`      | Auth DB tables (user, session, account, verification, jwks) |
| `convex/http.ts`                   | HTTP router consuming the shared runtime origin policy      |
| `convex/auth.config.ts`            | Convex JWT provider config                                  |
| `convex/emailHelpers.ts`           | Email sending via Resend (verification + reset)             |

### Web

| File                                          | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| `web/src/lib/auth/auth-client.ts`             | Same-origin `authClient` — `convexClient`, `usernameClient` |
| `web/src/lib/auth/proxy.ts`                   | Proxy policy: token stripping, credential rate limits       |
| `web/src/app/api/auth/[...all]/route.ts`      | Next.js auth route proxy                                    |
| `web/src/lib/auth/auth-server.ts`             | Next.js server helpers (`getToken`, `handler`)              |
| `web/src/lib/security/csp.ts`                 | Nonce-based Content-Security-Policy                         |
| `web/src/lib/appLinks.ts`                     | Universal Link / App Link association files                 |
| `web/src/app/native/auth/return/page.tsx`     | Fallback when the OS does not hand the return to the app    |
| `web/src/app/auth/signin/page.tsx`            | Sign-in page (email + password + OAuth)                     |
| `web/src/app/auth/reset-password/page.tsx`    | Password reset form                                         |
| `web/src/components/AuthGate.tsx`             | Client-side route protection                                |
| `web/src/components/ConvexClientProvider.tsx` | `ConvexBetterAuthProvider` wrapper                          |

### Mobile

| File                                           | Purpose                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `mobile/src/lib/auth/client.ts`                | `authClient`, `useSession`, `setStoredBearerToken`                        |
| `mobile/src/lib/auth/bearer-storage-plugin.ts` | Stores Bearer token in `expo-secure-store`, hydrates memory, and sends it |
| `mobile/src/lib/auth/nativeOAuth.ts`           | PKCE verifier, auth session, return-link redemption                       |
| `mobile/app/(auth)/sign-in.tsx`                | Sign-in screen (email + password + OAuth)                                 |
| `mobile/src/lib/auth/appSession.ts`            | Local-vault-aware route access                                            |
| `mobile/app/_layout.tsx`                       | `ConvexBetterAuthProvider`, app-wide OAuth return handler                 |

---

## OAuth Setup

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (**Web application**)
2. **Authorized redirect URIs** (must match character-for-character; no trailing slash):
   - `https://app.kyarafit.com/api/auth/callback/google` (production `SITE_URL`)
   - `http://localhost:3000/api/auth/callback/google` for an isolated development deployment
3. Copy Client ID + Secret → Convex environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### Apple (Sign in with Apple)

Apple does **not** allow `http://localhost` as a return URL.

1. **Identifiers** → **Services IDs** → create or select the Service ID used for web OAuth. This identifier is **`APPLE_CLIENT_ID`** in Convex (not the iOS bundle ID).
2. Enable **Sign in with Apple** → **Configure** → set **Primary App ID** to your app ID that has the Sign in with Apple capability (`com.kyarafit.mobile` matches `mobile/app.json`).
3. **Domains and Subdomains**: `app.kyarafit.com` (no `https://`, no path).
4. **Return URLs** (must match exactly, no trailing slash): `https://app.kyarafit.com/api/auth/callback/apple`
5. **Keys**: create a Sign in with Apple key, download the `.p8`, note **Key ID** and **Team ID**.
6. **Convex env** (Dashboard → Environment Variables):
   - `APPLE_CLIENT_ID` — Service ID string
   - `APPLE_CLIENT_SECRET` — JWT client secret (max **6 months**; regenerate with `npm run apple:client-secret` from repo root when it expires)
   - Optional: `APPLE_APP_BUNDLE_IDENTIFIER` — e.g. `com.kyarafit.mobile` (helps id-token audience checks; only set if it matches your App ID)

---

## Troubleshooting

### Google `redirect_uri_mismatch` (400)

The browser is sent to Google with `redirect_uri=<SITE_URL>/api/auth/callback/google`. In [Credentials](https://console.cloud.google.com/apis/credentials) open the **Web client** whose Client ID matches Convex `GOOGLE_CLIENT_ID` and add that exact URL. `SITE_URL` on the Convex deployment must be the web origin that serves the proxy.

### `state_mismatch` / `state_security_mismatch` after OAuth

The callback did not carry the state cookie of the browser that started the flow. Check that the
browser stays on `SITE_URL` for the whole flow (not a different host such as `www.` or a preview
URL), and on mobile that the app opened the `/native/authorize` URL it was given rather than the
provider URL.

### 403 Forbidden on sign-in or sign-up

Two possible causes — check both:

**1. Request origin not trusted.** The `Origin` header of the request is not in `trustedOrigins`
returned by `getAuthOrigins()` in `convex/betterAuth/auth.ts`. Configure the deployment
according to [Origin Configuration](#origin-configuration--critical); do not add a second list.

**2. Invalid `callbackURL`.** Better Auth validates the `callbackURL` parameter against
`trustedOrigins` and rejects invalid URLs with 403 before any other processing. Check the Convex
function logs for `Invalid callbackURL: ...`.

### 400 "Native sign-in requires a PKCE code challenge"

A sign-in with the native return URL as `callbackURL` must send `x-kyarafit-code-challenge`.
Use `runNativeOAuth` in `mobile/src/lib/auth/nativeOAuth.ts` rather than calling
`signIn.social` directly.

### Session not established after mobile OAuth

- On iOS 17.4+/Android, confirm `/.well-known/apple-app-site-association` and
  `/.well-known/assetlinks.json` return JSON on the web host (they 404 until `APPLE_TEAM_ID` /
  `ANDROID_CERT_SHA256_FINGERPRINTS` are set) and that the build's `EXPO_PUBLIC_WEB_APP_URL` host
  matches.
- If the browser stays on the "Return to the app" page, Android did not verify the App Link; the
  page's button completes sign-in through the `kyarafit://` fallback.

### Verification email not received

`RESEND_API_KEY` is missing or the sending domain is not verified in Resend.
The sign-up still succeeds — check Convex function logs for email errors.

### "CONVEX_SITE_URL is not set"

Run `npx convex dev` from the project root; it auto-populates `NEXT_PUBLIC_CONVEX_SITE_URL`
in `web/.env.local`. Copy the value to `EXPO_PUBLIC_CONVEX_SITE_URL` in `mobile/.env`.

### `ADDITIONAL_CORS_ORIGINS` for Expo Go on a physical device

See the isolated-development example in [Origin Configuration](#origin-configuration--critical).
Both checks consume the shared policy; production must not accept development origins.
