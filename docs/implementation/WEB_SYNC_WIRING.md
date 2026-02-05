# Web: Wire Sync Into the App

Call `setupSyncTriggers(token, canSync)` from the app root so the web app runs push/pull on load, focus, and beforeunload. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts) implements `setupSyncTriggers(token, canSync)` and `runSync`, but no root component passes the session token and `useFeatureAccess().canUseCloudSync` into it, so sync never runs.
- **Target**: On app load (and when window gains focus / before unload), if the user is signed in and has cloud sync (PREMIUM_BASIC+), run sync. FREE users: do not call sync (local-only).

---

## Prerequisites

- `web/src/lib/services/sync.ts`: `setupSyncTriggers(token, canSync)` and `runSync(token, canSync)` exist.
- `web/src/lib/api/useTier.ts`: `useFeatureAccess()` returns `canUseCloudSync` (true when tier >= PREMIUM_BASIC).
- Session/auth: Some way to get the current access token (e.g. Supabase session, or auth context). If auth is stubbed, token may be null; wiring still ensures sync runs when token and canSync are truthy.

---

## Step 1: Identify where session/token is available

**What to do**

- Determine how the web app gets the current user's access token (e.g. `useSession()` from Supabase, or a custom auth context). Check [web/src/app/layout.tsx](web/src/app/layout.tsx) and any auth provider or client-side auth hooks (e.g. under `web/src/lib/auth/`). Note the hook or context that provides `access_token` or equivalent.

**Files to touch**

- None (investigation only). If no token is available yet, document that auth must be implemented first (see [AUTH_WEB.md](AUTH_WEB.md)).

**Cursor prompt**

```
In the Kyarafit web app, find where the current user's access token (JWT or session token) is available: check layout.tsx, AuthGate, and any auth client or provider under web/src/lib/auth. Identify the hook or context that exposes access_token (or equivalent) for API calls. If none exists, list what would be needed (e.g. useSession from Supabase) and note that WEB_SYNC_WIRING depends on auth providing a token.
```

---

## Step 2: Create a client component that calls setupSyncTriggers

**What to do**

- Create a small client component (e.g. `SyncTrigger` or `SyncBootstrap`) that:
  - Uses the auth hook to get `access_token` (or null when signed out).
  - Uses `useFeatureAccess()` to get `canUseCloudSync`.
  - In a `useEffect`, calls `setupSyncTriggers(token, canSync)` when token or canSync changes. Pass `token ?? null` and the boolean `canUseCloudSync`.
  - Renders nothing (or null). Place this component inside the part of the tree where auth and feature access are available (e.g. inside AuthGate or layout).
- Ensure the component runs only on the client (no server-side call to setupSyncTriggers); `setupSyncTriggers` in sync.ts already returns early when `typeof window === 'undefined'`.

**Files to touch**

- New file, e.g. `web/src/components/SyncTrigger.tsx` (or under `lib/services/` as a wrapper). Then import and render it in layout or AuthGate.

**Cursor prompt**

```
In the Kyarafit web app, create a client-only component that wires sync into the app: (1) Use the auth hook (e.g. useSession or whatever exposes access_token) to get the current token. (2) Use useFeatureAccess() from web/src/lib/api/useTier.ts to get canUseCloudSync. (3) In useEffect, call setupSyncTriggers(token ?? null, canUseCloudSync) from web/src/lib/services/sync.ts whenever token or canUseCloudSync changes. (4) The component renders nothing (return null). Export it as SyncTrigger (or SyncBootstrap) and add it to the app layout or inside AuthGate so it mounts for signed-in users. Ensure the component is a client component ("use client") and that setupSyncTriggers is only invoked on the client.
```

---

## Step 3: Mount the component in layout or AuthGate

**What to do**

- In [web/src/app/layout.tsx](web/src/app/layout.tsx) or in the component that wraps authenticated content (e.g. AuthGate), render the new SyncTrigger component so it mounts when the user can be authenticated. Prefer inside the auth boundary so token is available. Avoid mounting before auth is initialized if that would cause unnecessary re-runs.

**Files to touch**

- `web/src/app/layout.tsx` or the AuthGate component (e.g. `web/src/components/AuthGate.tsx`).

**Cursor prompt**

```
In the Kyarafit web app, mount the SyncTrigger (or SyncBootstrap) component so it runs for signed-in users: add it inside the layout or inside AuthGate, in a place where the auth hook and useFeatureAccess are available. Ensure it does not block rendering and that it only runs on the client. Run npm run build to verify.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Identify where access token is available (auth hook/context). |
| 2 | Create client component that calls setupSyncTriggers(token, canUseCloudSync) in useEffect. |
| 3 | Mount that component in layout or AuthGate. |

After Step 3, signed-in PREMIUM_BASIC+ users will trigger sync on load, focus, and beforeunload.
