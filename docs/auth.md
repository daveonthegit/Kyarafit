# Authentication

Kyarafit uses **Better Auth** backed by **Convex** for both web (Next.js) and mobile (Expo).
Supported methods: email + password and OAuth (Google required, GitHub optional).

---

## Architecture

```
Browser / React Native
        │
        │  POST /auth/sign-in/email   (direct cross-origin to Convex)
        │  GET  /auth/sign-in/social  (OAuth redirect)
        ▼
Better Auth HTTP actions  (convex.site/auth/*)
        │
        │  reads / writes
        ▼
Convex database  (user, session, account, verification, jwks tables)
        │
        │  JWT (convex_jwt cookie / Bearer header)
        ▼
Convex queries & mutations  (authenticated via ConvexBetterAuthProvider)
```

### Cross-origin session persistence

The auth API lives on `*.convex.site` while the app lives on `localhost:3000`
(web) or `localhost:8081` / `exp://` (mobile). Cookies are blocked cross-origin, so
sessions are persisted via **Bearer tokens** instead:

| Client      | Plugin                | Storage        | Header sent                         |
| ----------- | --------------------- | -------------- | ----------------------------------- |
| Web         | `bearerStoragePlugin` | `localStorage` | `Authorization: Bearer <token>`     |
| Web (OAuth) | `crossDomainClient`   | `localStorage` | `Better-Auth-Cookie: <cookie-json>` |
| Mobile      | `bearerStoragePlugin` | `AsyncStorage` | `Authorization: Bearer <token>`     |

The server's **`bearer`** plugin (bundled inside `@convex-dev/better-auth`'s `convex()` plugin)
converts an `Authorization: Bearer <session-token>` header into a cookie so Better Auth can
validate it. The **`crossDomain`** server plugin handles the OAuth redirect flow — it appends
`?ott=<one-time-token>` to the OAuth callback URL so the client can exchange it for a session
token without relying on cookies.

---

## Origin Configuration — CRITICAL

Better Auth has **two independent origin checks** that must both be satisfied. Getting only one
right produces a 403:

### 1. CORS — `convex/http.ts`

Controls `Access-Control-Allow-Origin` headers (handles browser preflight). Add origins here
so fetch requests aren't blocked before they reach the auth handler.

### 2. Trusted origins — `convex/betterAuth/auth.ts`

Better Auth's own CSRF protection. It reads the `Origin` header on **every** auth request and
returns **403 Forbidden** if the origin is not in this list — even if CORS passed.

### Rule: keep the two lists in sync

Every entry in `allowedOrigins` (`http.ts`) **must also** appear in `trustedOrigins` (`auth.ts`).

```
convex/http.ts                    convex/betterAuth/auth.ts
──────────────────────────────    ────────────────────────────────────────
allowedOrigins: [                 trustedOrigins: [
  "http://localhost:3000",    ←→    "http://localhost:3000",
  "http://127.0.0.1:3000",   ←→    "http://127.0.0.1:3000",
  "http://localhost:8081",   ←→    "http://localhost:8081",   // Expo Web
  "http://127.0.0.1:8081",   ←→    "http://127.0.0.1:8081",
  "exp://localhost:8081",    ←→    "exp://localhost:8081",    // Expo Go
  "exp://127.0.0.1:8081",    ←→    "exp://127.0.0.1:8081",
]                                   ...(siteUrl ? [siteUrl] : []),  // prod
                                    ...extraOrigins,  // ADDITIONAL_CORS_ORIGINS
                                  ]
```

For device testing (Expo Go on a phone), add your LAN IP to both lists:

```
# Convex dashboard → Environment Variables
ADDITIONAL_CORS_ORIGINS=exp://192.168.1.42:8081,http://192.168.1.42:8081
```

> **Symptom of missing trusted origin:** `POST /auth/sign-in/email` or `/auth/sign-up/email`
> returns **403 Forbidden** even though the CORS preflight succeeds.

---

## Auth Flows

### Email + password — web

1. User submits the sign-in form
2. `authClient.signIn.email({ email, password })` → POST `/auth/sign-in/email`
3. Server returns `{ token }` in the JSON response body (via the `bearer` plugin)
4. Client calls `setStoredBearerToken(token)` → saves to `localStorage`
5. `bearerStoragePlugin` sends `Authorization: Bearer <token>` on every subsequent request
6. `router.push("/home")`

Sign-up is similar but requires email verification (`requireEmailVerification: true`).
After `signUp.email()` succeeds the user receives a verification email; until they click
the link, sign-in returns an "email not verified" error and the UI shows a resend button.

### Email + password — mobile

Identical to web, except `setStoredBearerToken` uses `AsyncStorage` (async) and the session
atom is refreshed via `await authClient.getSession()` before navigating.

### OAuth — web

1. `authClient.signIn.social({ provider, callbackURL: "/home" })`
2. Browser redirects to the OAuth provider
3. Provider redirects to `https://<your-deployment>.convex.site/auth/callback/<provider>` (Better Auth `baseURL` uses `CONVEX_SITE_URL`, not `SITE_URL`, so OAuth Return URLs stay on `*.convex.site`)
4. `crossDomain` server plugin creates an OTT, appends `?ott=<token>` to the callbackURL
5. Browser navigates to `/home?ott=<token>`
6. `ConvexBetterAuthProvider` detects `ott`, calls `/auth/cross-domain/one-time-token/verify`
7. Gets `session.token`, calls `getSession()` with it; `crossDomainClient` stores the cookie
8. `updateSession()` notifies the session atom → `useSession()` updates

**Linking from Settings:** `linkSocial` compares the provider email to the Better Auth user email. Apple’s private relay address often differs, so `allowDifferentEmails: true` is set in `convex/betterAuth/auth.ts`. For **first-time** sign-in (not Settings), Better Auth still matches existing users by **same email**; use “Share My Email” with Apple if you need one account to merge with an email/password profile.

### OAuth — mobile (Expo)

1. `authClient.signIn.social({ provider, callbackURL: "kyarafit:///" })`
2. `better-auth/react` skips `window.location` (undefined in RN) and returns `{ data: { url } }`
3. App calls `Linking.openURL(url)` → system browser opens
4. Same server-side flow as web OAuth
5. Browser redirects to `kyarafit:///?ott=<token>` (deep link)
6. iOS/Android opens the app; `Linking.useURL()` in `_layout.tsx` receives the URL
7. App POSTs to `/auth/cross-domain/one-time-token/verify` with the OTT
8. Gets `session.token` → `setStoredBearerToken(token)` → `await authClient.getSession()`

### Password reset

1. `authClient.requestPasswordReset({ email, redirectTo: "<reset-page-url>" })`
2. Server sends an email with a link: `<redirectTo>?token=<reset-token>`
3. User clicks → lands on the reset-password page
4. `authClient.resetPassword({ newPassword, token })`

On **mobile**, `redirectTo` points to the Convex site URL's reset-password endpoint; the
user completes the reset in their browser. A native reset-password screen can be added later.

### Email verification (post sign-up)

1. `signUp.email(...)` succeeds → server sends a verification email
2. Email contains `<SITE_URL or CONVEX_SITE_URL>/auth/verify-email?token=...`
3. User clicks → `web/src/app/auth/verify-email/route.ts` proxies to Convex
4. Convex verifies the token and (with `autoSignInAfterVerification: true`) signs the user in
5. Redirects to `callbackURL` (`/home` on web, `kyarafit://(tabs)` on mobile)

---

## Environment Variables

### Convex dashboard (Settings → Environment Variables)

| Variable                  | Description                                                                              | Required   |
| ------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| `BETTER_AUTH_SECRET`      | Random secret for signing sessions (`openssl rand -base64 32`)                           | **Yes**    |
| `GOOGLE_CLIENT_ID`        | Google OAuth client ID                                                                   | **Yes**    |
| `GOOGLE_CLIENT_SECRET`    | Google OAuth client secret                                                               | **Yes**    |
| `SITE_URL`                | Production web app origin (e.g. `https://kyarafit.app`) for CORS + email links           | Yes (prod) |
| `ADDITIONAL_CORS_ORIGINS` | Comma-separated extra origins (e.g. device LAN IP for Expo Go)                           | No         |
| `RESEND_API_KEY`          | Resend API key — required for verification + reset emails                                | No         |
| `EMAIL_FROM`              | Sender address (`Kyarafit <noreply@yourdomain.com>`) — domain must be verified in Resend | No         |
| `GITHUB_CLIENT_ID`        | GitHub OAuth client ID                                                                   | No         |
| `GITHUB_CLIENT_SECRET`    | GitHub OAuth client secret                                                               | No         |

### Web (`web/.env.local`)

| Variable                      | Description                               |
| ----------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | Convex backend URL                        |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL (`*.convex.site`) |

### Mobile (`mobile/.env`)

| Variable                      | Description                               |
| ----------------------------- | ----------------------------------------- |
| `EXPO_PUBLIC_CONVEX_URL`      | Convex backend URL                        |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Convex HTTP actions URL (`*.convex.site`) |

---

## Key Files

### Convex (server)

| File                          | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `convex/betterAuth/auth.ts`   | Better Auth instance — providers, `trustedOrigins`, plugins |
| `convex/betterAuth/schema.ts` | Auth DB tables (user, session, account, verification, jwks) |
| `convex/http.ts`              | HTTP router, CORS `allowedOrigins`                          |
| `convex/auth.config.ts`       | Convex JWT provider config                                  |
| `convex/emailHelpers.ts`      | Email sending via Resend (verification + reset)             |

### Web

| File                                          | Purpose                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `web/src/lib/auth/auth-client.ts`             | `authClient` — `convexClient`, `crossDomainClient`, `bearerStoragePlugin` |
| `web/src/lib/auth/bearer-storage-plugin.ts`   | Stores and sends Bearer token from `localStorage`                         |
| `web/src/lib/auth/auth-server.ts`             | Next.js server helpers (`getToken`, `handler`)                            |
| `web/src/app/api/auth/[...all]/route.ts`      | Next.js auth route proxy                                                  |
| `web/src/app/auth/signin/page.tsx`            | Sign-in page (email + password + OAuth)                                   |
| `web/src/app/auth/signup/page.tsx`            | Sign-up page                                                              |
| `web/src/app/auth/verify-email/route.ts`      | Proxies verification link from email to Convex                            |
| `web/src/app/auth/reset-password/page.tsx`    | Password reset form                                                       |
| `web/src/components/AuthGate.tsx`             | Client-side route protection                                              |
| `web/src/components/ConvexClientProvider.tsx` | `ConvexBetterAuthProvider` wrapper                                        |

### Mobile

| File                                           | Purpose                                            |
| ---------------------------------------------- | -------------------------------------------------- |
| `mobile/src/lib/auth/client.ts`                | `authClient`, `useSession`, `setStoredBearerToken` |
| `mobile/src/lib/auth/bearer-storage-plugin.ts` | Stores and sends Bearer token from `AsyncStorage`  |
| `mobile/src/screens/AuthScreen.tsx`            | Auth screen (email + password + OAuth)             |
| `mobile/app/_layout.tsx`                       | `ConvexBetterAuthProvider`, deep-link OTT handler  |

---

## OAuth Setup

### Google

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID (**Web application** — not iOS/Android only; those clients cannot use the Convex callback below)
2. **Authorized redirect URIs** (must match character-for-character; no trailing slash):
   - `https://<deployment>.convex.site/auth/callback/google`  
   Use the same host as **Convex Dashboard → your deployment → Settings → URL & Deploy Key** → HTTP Actions / “.convex.site” site URL (not the `.convex.cloud` data URL). Add **both** dev and prod URLs if you use two deployments.
3. **Authorized JavaScript origins** (recommended): `https://<deployment>.convex.site` (and `http://localhost:3000` for local Next.js UI — the OAuth **redirect** still hits `*.convex.site`, so the Convex URI in step 2 is required even when developing on localhost)
4. Copy Client ID + Secret → Convex environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (same Web client for dev/prod unless you use separate clients)

### GitHub (optional)

1. [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New
2. Authorization callback URL: `https://<deployment>.convex.site/auth/callback/github`
3. Copy Client ID + Secret → Convex environment variables

### Apple (Sign in with Apple)

Apple does **not** allow `http://localhost` as a return URL. Use your real Convex HTTPS callback in the Apple Developer portal.

1. **Identifiers** → **Services IDs** → create or select the Service ID used for web OAuth. This identifier is **`APPLE_CLIENT_ID`** in Convex (not the iOS bundle ID).
2. Enable **Sign in with Apple** → **Configure** → set **Primary App ID** to your app ID that has the Sign in with Apple capability (`com.kyarafit.mobile` matches `mobile/app.json`).
3. **Domains and Subdomains**: add the hostname only for your HTTP deployment, e.g. `happy-animal-123.convex.site` (no `https://`, no path).
4. **Return URLs** (must match exactly, no trailing slash):
   - `https://<deployment>.convex.site/auth/callback/apple`  
   Same `<deployment>` as `NEXT_PUBLIC_CONVEX_SITE_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` (the `*.convex.site` host).
5. **Keys**: create a Sign in with Apple key, download the `.p8`, note **Key ID** and **Team ID**.
6. **Convex env** (Dashboard → Environment Variables):
   - `APPLE_CLIENT_ID` — Service ID string  
   - `APPLE_CLIENT_SECRET` — JWT client secret (max **6 months**; regenerate with `npm run apple:client-secret` from repo root when it expires)  
   - Optional: `APPLE_APP_BUNDLE_IDENTIFIER` — e.g. `com.kyarafit.mobile` (helps id-token audience checks; only set if it matches your App ID)

---

## Troubleshooting

### Google `redirect_uri_mismatch` (400)

The browser is sent to Google with `redirect_uri=https://<your-deployment>.convex.site/auth/callback/google`. In [Credentials](https://console.cloud.google.com/apis/credentials) open the **Web client** whose Client ID matches Convex `GOOGLE_CLIENT_ID`, then under **Authorized redirect URIs** add that exact URL (scheme `https`, path `/auth/callback/google`). If it still fails, confirm `NEXT_PUBLIC_CONVEX_SITE_URL` / mobile `EXPO_PUBLIC_CONVEX_SITE_URL` use the **same** host you registered (no typo, no `www`, no trailing slash).

### 403 Forbidden on sign-in or sign-up

Two possible causes — check both:

**1. Request origin not trusted.** The `Origin` header of the request is not in `trustedOrigins`
in `convex/betterAuth/auth.ts`. Add it alongside the matching entry in `allowedOrigins` in
`convex/http.ts`. See the [Origin Configuration](#origin-configuration--critical) section above.

**2. Invalid `callbackURL`.** Better Auth validates the `callbackURL` parameter against
`trustedOrigins` and rejects invalid URLs with 403 before any other processing. Check the Convex
function logs for `Invalid callbackURL: ...`. Common mistake: `kyarafit://(tabs)` — parentheses
are **not valid URL hostname characters**. Use `kyarafit:///` (empty host, root path) instead,
and ensure `"kyarafit://"` is in `trustedOrigins`.

### Session lost after page refresh (web)

`BETTER_AUTH_SECRET` may not be set, or the Bearer token was never stored.
After `signIn.email()` always call `setStoredBearerToken(data.token)`. OAuth sessions
are persisted by `crossDomainClient` via the `Set-Better-Auth-Cookie` response header.

### Apple / Convex logs: `ERROR [Better Auth]: No session found`

That message comes from the **cross-domain** plugin after the OAuth callback: Better Auth did **not** create a session before redirecting (so there is no one-time token to send back to your app).

Check **Convex function logs** for errors **immediately before** that line — common causes:

1. **`email_not_found`** — Apple did not supply an email in the profile/id token (rare misconfiguration). Confirm the Service ID + Primary App ID and that users can complete the Apple consent flow.
2. **`invalid_code` / `no_code`** — token exchange failed. Typical fixes: wrong **Return URL** in Apple (must be exactly `https://<deployment>.convex.site/auth/callback/apple`), wrong **`APPLE_CLIENT_ID`** (must be the **Services ID**, not the bundle ID), or an **expired `APPLE_CLIENT_SECRET`** JWT (regenerate every ≤6 months).
3. **Domain not registered** — under the Service ID, **Domains and Subdomains** must include your deployment host (e.g. `something.convex.site`).

`convex/betterAuth/auth.ts` sets cookie `SameSite=None` + `Secure` for OAuth compatibility with Apple’s **form_post** callback.

### Session not established after mobile OAuth

- `mobile` uses `Linking.createURL("/")` for OAuth `callbackURL` (trusted origin `kyarafit://`). Do **not** use `kyarafit://(tabs)` — parentheses are invalid in a URL host and trigger **Invalid callbackURL** / 403.
- Confirm `mobile/app/_layout.tsx` has the `Linking.useURL` OTT handler and `EXPO_PUBLIC_CONVEX_SITE_URL` matches the deployment you registered with Google/Apple.
- Verify the Convex deployment registers the `crossDomain` plugin (it creates the OTT).

### Verification email not received

`RESEND_API_KEY` is missing or the sending domain is not verified in Resend.
The sign-up still succeeds — check Convex function logs for email errors.

### "CONVEX_SITE_URL is not set"

Run `npx convex dev` from the project root; it auto-populates `NEXT_PUBLIC_CONVEX_SITE_URL`
in `web/.env.local`. Copy the value to `EXPO_PUBLIC_CONVEX_SITE_URL` in `mobile/.env`.

### `ADDITIONAL_CORS_ORIGINS` for Expo Go on a physical device

```
ADDITIONAL_CORS_ORIGINS=exp://192.168.1.42:8081,http://192.168.1.42:8081
```

This must be added to **both** `ADDITIONAL_CORS_ORIGINS` (which feeds into `trustedOrigins`)
**and** you must also add the same values to `allowedOrigins` in `convex/http.ts`.
