# Web Auth: Clarify or Implement

Clarify whether **web auth is stubbed** or broken, and ensure the web app can obtain an **access token** for sync and tier checks. Do steps in order; each has a **Cursor prompt**.

**Feature parity**: **Mobile** must also obtain and send an access token for API and sync (e.g. Supabase Auth with Expo SecureStore). Same backend and tier behavior; this guide focuses on web; ensure mobile auth provides the same token for API calls.

---

## Goal

- **Current gap**: [web/src/app/api/auth/[...all]/route.ts](web/src/app/api/auth/[...all]/route.ts) and [web/src/lib/auth/config.ts](web/src/lib/auth/config.ts) indicate "Auth not implemented" or stub. CONTEXT and SUPABASE_TODO imply Supabase/BetterAuth elsewhere. Sync and feature gating need a valid token.
- **Target**: (1) Document whether auth is intentionally stubbed (e.g. for local dev) or must be implemented. (2) If implementing: provide a way for the web app to get the current user's access token (e.g. Supabase Auth or BetterAuth) and pass it to API calls and setupSyncTriggers.

---

## Prerequisites

- Web app: AuthGate or layout that may depend on auth; useTier/useFeatureAccess may call an API that requires a token.
- Backend: expects JWT in Authorization header for protected routes.
- Supabase or other IdP may already be configured elsewhere (e.g. env vars).

---

## Step 1: Document current auth state

**What to do**

- In this guide or in a short AUTH_STATUS.md, document: (1) What the web auth route and config currently do (stub vs real). (2) Whether Supabase Auth (or another provider) is configured and where (env, middleware). (3) What is required for sync and tier to work (token in header, session persistence). No code change yet.

**Files to touch**

- docs/implementation/AUTH_WEB.md or docs/implementation/AUTH_STATUS.md

**Cursor prompt**

```
Document the current web auth state: in docs/implementation/AUTH_WEB.md (or AUTH_STATUS.md), add a short section that (1) describes what web/src/app/api/auth/[...all]/route.ts and web/src/lib/auth/config.ts do (stub vs real), (2) notes whether Supabase or another IdP is configured and where, (3) states what is needed for sync and tier (e.g. access token in API requests and in setupSyncTriggers). No code logic changes.
```

---

## Step 2: If stubbed — provide a dev token or real auth

**What to do**

- **Option A (stub for dev)**: If the team uses a dev-only token (e.g. from Supabase dashboard or a test script), document how to set it (e.g. in localStorage or a dev-only auth context) so the web app can send it in API calls and to setupSyncTriggers. Ensure the backend accepts that token for local dev.
- **Option B (real auth)**: Implement Supabase Auth (or BetterAuth) in the web app: sign-in/sign-up pages, session persistence, and a hook (e.g. useSession) that exposes access_token. Wire the token into the API client and into the SyncTrigger component. See Supabase Auth docs and existing CONTEXT/SUPABASE_TODO.

**Files to touch**

- web/src/lib/auth/ (config, client, session hook); web/src/app/auth/ (signin, signup); or dev-only token doc.

**Cursor prompt**

```
If web auth is stubbed: document how to use a dev token (e.g. Supabase anon or a test JWT) so the web app can call the API and setupSyncTriggers with a token. If implementing real auth: add Supabase Auth (or configured IdP) to the web app — sign-in/signup pages, session hook (e.g. useSession) that returns access_token, and wire the token into the API client and the component that calls setupSyncTriggers. See docs/setup/SUPABASE_SETUP.md and CONTEXT. Run npm run build.
```

---

## Step 3: Ensure protected routes and sync use the token

**What to do**

- Verify that (1) API requests (fetchBuilds, createBuild, etc.) include the Authorization header when the user is signed in. (2) The SyncTrigger (or equivalent) receives the token from the auth hook and passes it to setupSyncTriggers. (3) useTier / user/me use the token. Fix any missing wiring.

**Files to touch**

- Web API client (e.g. base fetch or axios interceptor); layout or SyncTrigger; useTier if it calls user/me.

**Cursor prompt**

```
In the Kyarafit web app, ensure the access token is used everywhere it is needed: (1) API client (fetch or axios) should add Authorization: Bearer <token> when token is available. (2) SyncTrigger (or the component that calls setupSyncTriggers) must get the token from the auth hook and pass it. (3) useTier or GET /users/me should send the token. Audit and fix any missing token wiring. Run npm run build.
```

---

## Summary

| Step | Action                                                           |
| ---- | ---------------------------------------------------------------- |
| 1    | Document current auth (stub vs real, IdP, what sync/tier need).  |
| 2    | Either document dev token or implement real auth (Supabase/IdP). |
| 3    | Ensure token is sent in API calls and to setupSyncTriggers.      |
