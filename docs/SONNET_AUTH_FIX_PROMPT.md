# Prompt for Sonnet: Fix auth (web + mobile Expo)

Copy the text below and paste it into Sonnet. Add your current symptom at the end (e.g. “After sign-in on web I’m redirected back to signin” or “On Expo Go, OAuth redirect doesn’t restore session”). Sonnet should fix auth so it works on **both web (Next.js) and mobile (Expo)**.

---

We use **Convex** for the backend and **Better Auth** (with `@convex-dev/better-auth`) for auth. The app runs on its own origin (e.g. `localhost:3000` or a production domain for web; Expo Go / dev client for mobile); the auth API lives on the Convex site URL (`CONVEX_SITE_URL`). Fix or debug auth using the following context. Auth must work on **web (Next.js) and mobile (Expo)**.

## Stack

- **Auth server:** Better Auth on Convex HTTP (e.g. `https://<deployment>.convex.site/auth/*`).
- **Client:** `better-auth/react` + `@convex-dev/better-auth` `convexClient()` in both web and mobile; `ConvexBetterAuthProvider` wraps each app.
- **Features:** email/password, email verification, OAuth (Google/GitHub), password reset, JWT for Convex (custom JWT provider).

## Cross-origin (critical)

- The browser / React Native **do not** send Convex’s session cookie to the app origin. We **cannot** rely on cookies for session.
- We persist the **session token** (Bearer) and send it on every auth request via a custom client plugin:
  - **Web:** `localStorage` + `web/src/lib/auth/bearer-storage-plugin.ts`; key `better_auth_bearer_token`.
  - **Mobile (Expo):** `AsyncStorage` + `mobile/src/lib/auth/bearer-storage-plugin.ts`; same key. Plugin is async (AsyncStorage is async).
- After any sign-in that returns `data.token`, call `setStoredBearerToken(data.token)` then sync session (e.g. `getSession` with Bearer header) then navigate. Otherwise refetches (e.g. `useSession()`) will be unauthenticated and the user will be sent back to sign-in.

## Relevant files

**Convex**

- `convex/betterAuth/auth.ts` — baseURL, basePath `/auth`, trustedOrigins, plugins: `convex({ authConfig })`.
- `convex/http.ts` — CORS: `allowedOrigins` must include web origins (e.g. `http://localhost:3000`, production app URL) **and** Expo origins: `http://localhost:8081`, `http://127.0.0.1:8081`, `exp://localhost:8081`, `exp://127.0.0.1:8081` (add `exp://<your-ip>:8081` in Convex env if testing on device). Expose header `Set-Better-Auth-Cookie` if using cross-domain cookie flow.
- `convex/emailHelpers.ts` — verification and reset emails.
- `convex/betterAuth/schema.ts` — must include **jwks** table (`publicKey`, `privateKey`, `createdAt`) or `adapter.findMany({ model: "jwks" })` will throw ArgumentValidationError.

**Web**

- `web/src/lib/auth/auth-client.ts` — baseURL = `NEXT_PUBLIC_CONVEX_SITE_URL/auth`, plugins: `convexClient()`, `bearerStoragePlugin()`.
- `web/src/lib/auth/bearer-storage-plugin.ts` — adds `Authorization: Bearer <token>` from `localStorage`; clears token on `/sign-out`; exports `setStoredBearerToken(token | null)`.
- `web/src/app/auth/signin/page.tsx` — on email sign-in success: `setStoredBearerToken(data.token)` → `getSession({ fetchOptions: { headers: { Authorization: "Bearer " + data.token } } })` → `router.push("/home")`. No `callbackURL` for email sign-in.
- `web/src/components/AuthGate.tsx` — `authClient.useSession()`; redirect to `/auth/signin` if not public path and no session.
- `web/src/app/auth/verify-email/route.ts` — GET with `?token=` redirects to Convex verify-email; no token redirects to `/auth/verify-email/inbox`. Do **not** use `NextResponse.rewrite()` in App Route handlers (use redirect).

**Mobile (Expo)**

- `mobile/src/lib/auth/client.ts` — baseURL = `EXPO_PUBLIC_CONVEX_SITE_URL/auth`, plugins: `convexClient()`, `bearerStoragePlugin()`. Exports `setStoredBearerToken` (async).
- `mobile/src/lib/auth/bearer-storage-plugin.ts` — same behavior as web but uses `AsyncStorage`; init is async.
- `mobile/src/screens/AuthScreen.tsx` — OAuth only (Google/GitHub) via `signIn.social({ provider, callbackURL: "/(tabs)" })`. If the OAuth or any future email sign-in returns a token, the app must call `setStoredBearerToken(data.token)` and then sync session before navigating so `useSession()` sees the session.
- `mobile/app/_layout.tsx` — uses `useSession()`; redirects to `(tabs)` when session exists and user is in auth group. No redirect to auth when unauthenticated (user can “Continue without account”); adjust if you want an auth gate.
- **Expo deep link / OAuth callback:** If the server uses the cross-domain plugin and redirects back with an `ott` (one-time token) query param, the app must handle the deep link, exchange OTT for session (e.g. POST to `/auth/cross-domain/one-time-token/verify`), then store the returned session token via `setStoredBearerToken` if the response includes it. Alternatively ensure OAuth callback returns a token the app can store and use with the bearer plugin.
- **Expo origin:** Convex cross-domain plugin treats requests with `expo-origin` header as native Expo and may skip cookie-based flow; bearer token flow is the reliable way to persist session on mobile.

## Environment

- **Convex:** `BETTER_AUTH_SECRET`, `CONVEX_SITE_URL`, optional `SITE_URL` (for email links), `RESEND_API_KEY` (and optionally `EMAIL_FROM`), OAuth client IDs/secrets. For device testing: add Expo origin (e.g. `exp://192.168.x.x:8081`) to CORS or `ADDITIONAL_CORS_ORIGINS` if needed.
- **Web:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`.
- **Mobile:** `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`.

## Checklist when fixing

1. **Web: redirect to sign-in after login** — Sign-in must call `setStoredBearerToken(data.token)` before navigating; auth client must include `bearerStoragePlugin()` so every request (including get-session) sends the token.
2. **Mobile: session not persisting after OAuth** — Same idea: persist token (AsyncStorage) and send on every request via bearer plugin. If OAuth returns to the app via deep link, handle the URL (e.g. `ott` param), exchange for session, call `setStoredBearerToken` with the token from the response, then navigate so `useSession()` sees the session.
3. **Verify-email 500** — Do not use `NextResponse.rewrite()` in the verify-email route handler; use `NextResponse.redirect()`.
4. **ArgumentValidationError for `model: "jwks"`** — Add the `jwks` table to `convex/betterAuth/schema.ts` and run `npx convex codegen` / `npx convex dev`.
5. **CORS / 404** — `convex/http.ts` must allow both web and Expo origins; auth `basePath` must be `/auth` and match client `baseURL` path.
6. **Email verification link domain** — Set Convex `SITE_URL` to the app URL if you want links to use the app domain; app’s `/auth/verify-email` route proxies token to Convex.

Please fix the current auth issue and ensure sign-in, session persistence, and protected routes work on **both web and mobile Expo** with this cross-origin, bearer-token-based setup.

**[Describe your current symptom here.]**
