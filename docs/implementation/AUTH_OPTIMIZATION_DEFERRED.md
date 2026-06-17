# Auth Optimization — Deferred Until After Local-First Migration

**Status:** Deferred (planning). **Created:** 2026-06-15. **Blocked on:** completion of
`LOCAL_FIRST_FREEMIUM_PLAN.md` (do not start until the offline cache layer is stable).

Goal: tighten how authenticated Convex functions resolve the current user — fixing a security
hole and removing a redundant client round-trip — **without** disturbing the local-first offline
cache. Sequenced after the migration because step 2 changes query signatures the offline cache
keys on, and the prerequisite (step 1) is a fix the local-first work needs anyway.

---

## Current state (as of 2026-06-15)

- Auth is **Better Auth as a Convex component** (`convex/betterAuth/auth.ts`); email/password +
  Google/Apple OAuth. Sessions/accounts live in the `betterAuth` component tables.
- Identity reaches functions via **JWT** — `ctx.auth.getUserIdentity()` (`convex/auth.ts`) is pure
  token verification, **no DB lookup**. `identity.subject` = `externalId`.
- A mirror `users` table keyed by `externalId` holds tier, usage, profile. Authenticated functions
  resolve subject → app row via `users.withIndex("by_externalId").unique()` (one indexed read —
  idiomatic, cheap, not a problem).

### What is actually wrong

1. **IDOR + redundant round-trip (highest value).** Several queries take `externalId` as a
   **client-supplied argument** instead of deriving it server-side:
   - `convex/users.ts` → `getMe`, `getFocusedBuildId`, `getByExternalId`
   - Security: a client can pass _another user's_ `externalId` and read their tier, usage, email,
     profile. This is an IDOR bug, not just a perf nit.
   - Perf: the client must first subscribe to `api.auth.getCurrentUser`
     (`web/src/hooks/useCurrentUser.ts`) just to learn its own `subject`, _then_ call `getMe` with
     it — so `useTier` (`web/src/lib/api/useTier.ts`) is **2 reactive queries where 1 would do**.

2. **`recalculateUsage` on the sign-in hot path.** `convex/users.ts` `recalculateUsage` `.collect()`s
   across `cosplayNodes`, `builds`, `conventions`, `buildReferenceImages`, `buildProcessPictures`
   and stats every file. `AuthGate` (`web/src/components/AuthGate.tsx`) runs it on every fresh
   session. Uploads already track usage incrementally via `checkLimitAndAddUsage`, so this is a
   heavy belt-and-suspenders backfill in the critical path.

### What is fine (do NOT "optimize")

- `getUserIdentity()` — zero DB, JWT only.
- The per-call `by_externalId` indexed lookup — log(n), reactively cached. Leave it.

---

## Why this is deferred (interaction with local-first)

The offline cache keys on `functionName:stableStringify(args)`
(`design-system/domain/offlineQueryCache.ts`). Passing `externalId` as an arg today _incidentally_
namespaces the cache per user (`getMe:{externalId:"A"}` ≠ `getMe:{externalId:"B"}`).

If we drop `externalId` from args before the offline layer handles per-user namespacing, the key
collapses to `getMe:{}` and on a shared/multi-account device the cached tier/profile from a previous
account can flash before the live query corrects it (SWR). This is a **latent bug the offline cache
already has for any identity-derived per-user query** — so it must be fixed centrally, not by
threading `externalId` through args forever.

Note `getMe`/tier is **allowed traffic** for free users (the plan's Phase 2 DoD permits auth +
`users.upsert` + welcome email; only Offline-Core _data_ calls must be zero). Identity-deriving
`getMe` is consistent with — and makes it easier to assert — "only auth endpoints hit."

---

## Plan (strict order)

### Step 1 — Salt the offline cache key with the auth subject (prerequisite)

- Centrally include the current `identity.subject` in the offline cache key so every per-user query
  is namespaced regardless of its args. Touch the offline cache layer
  (`design-system/domain/offlineQueryCache.ts` + the mobile/web cache wiring), not individual APIs.
- This is needed by the local-first work independently — land it during/at the end of the migration.
- DoD: switching accounts on one device never serves another account's cached per-user snapshot.

### Step 2 — Identity-derive the user-scoped queries

- Add a shared helper `getCurrentAppUser(ctx)` (`getUserIdentity()` → `by_externalId` lookup; returns
  null/throws consistently) in e.g. `convex/lib/`.
- Refactor `getMe`, `getFocusedBuildId`, `getByExternalId` to **drop the `externalId` arg** and derive
  it server-side. Fixes the IDOR bug and removes the round-trip.
- Update callers: `web/src/lib/api/useTier.ts` (drop the `useCurrentUser` dependency → one query),
  `web/src/app/home/page.tsx` (focused build), `web/src/app/u/[username]/page.tsx` and
  `web/src/app/settings/account/AccountDetailsContent.tsx` / `SidebarUserProfile.tsx`
  (`getByExternalId`). Mirror on mobile if equivalent callers exist.
- DoD: passing a foreign id is impossible (no arg); `useTier` issues a single subscription.

### Step 3 — Move `recalculateUsage` off the hot path

- Gate behind `canUseCloudSync` (free local-first users keep images locally — cloud usage barely
  accrues, so the scan is pointless for them) and/or run via `ctx.scheduler.runAfter` / a staleness
  check instead of synchronously on sign-in in `AuthGate`.
- DoD: sign-in does not block on a full content scan; usage stays correct via incremental tracking.

---

## Files in scope (quick reference)

- `convex/users.ts` — `getMe`, `getFocusedBuildId`, `getByExternalId`, `recalculateUsage`
- `convex/auth.ts` — `getCurrentUser` (may become unnecessary for `useTier` after step 2)
- new `convex/lib/getCurrentAppUser.ts` (or similar)
- `web/src/hooks/useCurrentUser.ts`, `web/src/lib/api/useTier.ts`
- `web/src/app/home/page.tsx`, `web/src/app/u/[username]/page.tsx`,
  `web/src/app/settings/account/AccountDetailsContent.tsx`,
  `web/src/components/layout/SidebarUserProfile.tsx`, `web/src/components/AuthGate.tsx`
- offline cache (step 1): `design-system/domain/offlineQueryCache.ts` + cache wiring
