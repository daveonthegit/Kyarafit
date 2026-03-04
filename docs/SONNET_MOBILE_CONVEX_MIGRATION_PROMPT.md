# Prompt for Sonnet: Review mobile app — full migration from Go backend to Convex

Copy the text below and paste it into Sonnet. Add any specific concerns at the end (e.g. “Focus on convention-detail and packing” or “Ensure no EXPO_PUBLIC_API_URL remains”). Sonnet should review the **Expo mobile app** and confirm or fix the migration so **all backend usage is Convex only**; no remaining Go API or legacy sync.

---

We migrated the backend from a **Go API** (removed) to **Convex**. The mobile app must use **only Convex** for cloud data and **local SQLite** for offline/anonymous; it must **not** call the old Go API or depend on `EXPO_PUBLIC_API_URL`.

## Goal

Review the mobile app and ensure:

1. **No Go API usage** — No HTTP calls to `EXPO_PUBLIC_API_URL` or `localhost:8080`. No reliance on sync or “pieces” API that targeted the Go backend.
2. **Convex-only cloud** — Signed-in users get builds, closet items, conventions, packing, tasks, and auth from Convex only (`useQuery` / `useMutation` with `api.*`).
3. **Clean env** — Mobile only needs `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL`. Remove or stop using `EXPO_PUBLIC_API_URL` (and any Supabase auth vars if still present).
4. **Dead code removed or isolated** — Legacy sync, pieces API, and screens that called the Go backend are either removed or clearly isolated so they are not used by the current Expo Router app.

## Convex backend (current)

- **Auth:** `api.auth.getCurrentUser` (via `@convex-dev/better-auth`).
- **Builds:** `convex/builds.ts` — list, create, update, delete, link closet items.
- **Build tasks:** `convex/buildTasks.ts` — list, create, update, toggle checked.
- **Closet:** `convex/closetItems.ts` — list, create, update, delete (no “pieces” API).
- **Conventions:** `convex/conventions.ts` — list, get, create, update, delete; packing and day plans live here (e.g. `api.conventions.getPacking`, `api.conventions.updatePackingItem`).
- **Schema:** `convex/schema.ts` — users, closetItems, builds, buildItemLinks, buildTasks, conventions, conventionDayPlans, packingListItems, etc.

## Mobile app structure (Expo Router)

- **Entry / layout:** `mobile/app/_layout.tsx` — `ConvexBetterAuthProvider` wraps the app; no conditional “no Convex” branch that skips the provider.
- **Routes:** `mobile/app/*.tsx` — auth, (tabs)/index, (tabs)/builds, (tabs)/plan, (tabs)/packing, closet, build-detail, build-new, convention-detail, convention-new, add-item, settings, itinerary, etc.
- **Data:** Screens use `useQuery(api.builds.list)`, `useQuery(api.closetItems.list)`, `useQuery(api.conventions.list)`, `api.conventions.getPacking`, `useMutation(api.conventions.updatePackingItem)`, and `useCurrentUser()` (which uses `api.auth.getCurrentUser`). Local/anonymous data uses SQLite via `mobile/src/storage/*` (buildsRepo, closetRepo, conventionsRepo, packingRepo, plansRepo, buildTasksRepo, outboxRepo).

## What to find and fix

1. **EXPO_PUBLIC_API_URL**
   - **Where it’s used:** `mobile/src/services/sync.ts` (sync to Go backend), `mobile/src/lib/api/pieces.ts` (old “pieces” API).
   - **Action:** Remove or stop using this env var. Either remove sync.ts and pieces API usage from the active app, or ensure no route in `app/*` triggers them. Update `mobile/.env` and `mobile/env.example` to drop `EXPO_PUBLIC_API_URL`.

2. **Sync service**
   - **File:** `mobile/src/services/sync.ts` — push/pull with Go backend, uses `EXPO_PUBLIC_API_URL`.
   - **Used by:** `mobile/app/convention-detail.tsx` (`getSyncPendingCount()`).
   - **Action:** Either remove sync and `getSyncPendingCount` (replace with Convex-only logic or a simple “pending” from Convex if you add it), or clearly document that sync is disabled and the UI must not rely on it.

3. **Pieces API**
   - **File:** `mobile/src/lib/api/pieces.ts` — HTTP client for old Go “pieces” endpoint.
   - **Used by:** `mobile/src/screens/ClosetScreen.tsx`, `mobile/src/screens/AddPieceScreen.tsx`.
   - **Note:** The **active** closet screen is `mobile/app/closet.tsx` (Convex + SQLite). `src/screens/ClosetScreen.tsx` and `AddPieceScreen.tsx` appear to be legacy (used by old `App.tsx`, not by Expo Router).
   - **Action:** Confirm no Expo Router route imports ClosetScreen or AddPieceScreen or pieces API. If unused, remove or move to a `/legacy` or document as dead code; then remove `EXPO_PUBLIC_API_URL` from pieces.ts or delete pieces.ts.

4. **Legacy screens**
   - **Files:** `mobile/src/screens/ClosetScreen.tsx`, `mobile/src/screens/AddPieceScreen.tsx`, and any `mobile/App.tsx` that references them.
   - **Action:** Ensure the app’s real entry is Expo Router (`mobile/index.js` → `app/`). If `App.tsx` is never used, remove or document; ensure no remaining references to Go-backed screens.

5. **Environment and examples**
   - **Files:** `mobile/.env`, `mobile/env.example`.
   - **Action:** Env should only require `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL`. Remove `EXPO_PUBLIC_API_URL`, and Supabase auth vars if migration is complete.

6. **Outbox / sync pending**
   - **File:** `mobile/src/storage/outboxRepo.ts` — may have been used for offline queue to Go backend.
   - **Action:** If Convex handles all mutations and you no longer push outbox to Go, either remove outbox usage from the active flow or repurpose it for a Convex-oriented queue; ensure no code path still POSTs outbox to `EXPO_PUBLIC_API_URL`.

## Checklist (migration complete when)

- [ ] No file in `mobile/app/*` or any active code path uses `EXPO_PUBLIC_API_URL`, `sync.ts` (for Go), or `lib/api/pieces.ts`.
- [ ] `convention-detail.tsx` does not depend on `getSyncPendingCount()` from sync.ts, or sync is replaced with Convex-only “pending” (or removed).
- [ ] Mobile env docs and examples list only Convex vars; `EXPO_PUBLIC_API_URL` removed from `.env` and `env.example`.
- [ ] Legacy screens (e.g. ClosetScreen, AddPieceScreen) and `App.tsx` are either removed or clearly marked unused; no route in `app/*` uses them.
- [ ] All cloud reads/writes for builds, closet, conventions, packing, tasks, and auth go through Convex (`api.*`) or local SQLite only.

## Relevant paths

- **Convex:** `convex/schema.ts`, `convex/builds.ts`, `convex/closetItems.ts`, `convex/conventions.ts`, `convex/buildTasks.ts`, `convex/auth.ts`, `convex/http.ts`.
- **Mobile app routes:** `mobile/app/_layout.tsx`, `mobile/app/(tabs)/*.tsx`, `mobile/app/closet.tsx`, `mobile/app/convention-detail.tsx`, `mobile/app/build-detail.tsx`, etc.
- **Mobile data / legacy:** `mobile/src/storage/*`, `mobile/src/services/sync.ts`, `mobile/src/lib/api/pieces.ts`, `mobile/src/hooks/useCurrentUser.ts`, `mobile/src/screens/*`.

Please review the mobile app for full Go → Convex migration: remove or isolate any remaining Go API usage, sync, and pieces API; ensure env and docs only require Convex vars; and confirm all active screens use only Convex + local SQLite.

**[Add any specific focus or symptom here.]**
