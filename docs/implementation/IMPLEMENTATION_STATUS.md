# Implementation Status: Convex + Better Auth

**Status**: Core backend and auth complete; web and mobile use Convex. Some UX and parity items remain.  
**Last Updated**: 2026-03-04

## Current Stack

- **Backend**: Convex (database, queries, mutations, file storage)
- **Auth**: Better Auth (Google/GitHub OAuth, email+password) as Convex HTTP component
- **Web**: Next.js 15, Convex hooks only (no Go API, no IndexedDB sync)
- **Mobile**: Expo, Convex when signed in + local SQLite; Convex→SQLite sync via `useConvexSync` / `convexSync.ts`

See [MIGRATION.md](../MIGRATION.md) for the Supabase/Go → Convex migration summary.

---

## ✅ Completed

### Backend (Convex)

- **Schema** — `convex/schema.ts`: users, closetItems, builds, buildItemLinks, buildTasks, conventions, conventionDayPlans, packingListItems; all with `userId` for auth.
- **CRUD** — closetItems, builds, buildTasks, conventions (incl. day plans and packing), users; all with ownership checks.
- **File storage** — `api.files.generateUploadUrl` / `api.files.getUrl` for images.
- **Auth** — Better Auth in `convex/betterAuth/`; `api.auth.getCurrentUser`; Convex JWT provider; HTTP routes in `convex/http.ts` (CORS + trusted origins).

### Web

- **Auth** — Sign-in/sign-up (email+password + OAuth), AuthGate, ConvexBetterAuthProvider, bearer token storage.
- **Data** — All main flows use Convex: closet, builds, build detail + tasks, conventions, itinerary, packing; TaskChecklist with create/update/delete; ImageUpload using Convex file storage.
- **No legacy** — No Supabase client, no Go API calls, no IndexedDB repos, no web sync service to Go.

### Mobile

- **Auth** — Better Auth client; OAuth (incl. deep link OTT); ConvexBetterAuthProvider in `_layout.tsx`.
- **Data** — Signed-in screens use Convex (`useQuery` / `useMutation`) for closet, builds, conventions, packing, itinerary, build detail + tasks.
- **Offline / sync** — Local SQLite; `useConvexSync` syncs Convex data into SQLite; `convexSync.ts` pushes local changes to Convex.

---

## 🔲 Remaining / To Implement

### High level

1. **Mobile offline-first UX** — When signed out or offline, mobile still uses SQLite; ensure flows (closet, builds, conventions, packing) and any “pending sync” UI are clear and consistent.
2. **Feature parity** — Any gaps between web and mobile (e.g. image upload everywhere, task assignment to closet items, planner view) per [IMPLEMENTATION_GUIDES_INDEX.md](IMPLEMENTATION_GUIDES_INDEX.md).
3. **Tiers / subscription** — No tier enforcement in Convex yet; no Stripe integration. See [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md) when implementing.
4. **Settings & account** — Account details, subscription plan, notification preferences; see [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md).
5. **Docs and setup** — Keep README, DEVELOPMENT, and API docs aligned with Convex + Better Auth; mark or archive Supabase/Go-era docs. See [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md).

### Implementation guides (still relevant)

- [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md) — Builds list as cards, progress, tabs.
- [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) — Task checklist on build detail (partially done; refine as needed).
- [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md) — Link closet items to builds; assign tasks to closet items.
- [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md), [PACKING_LIST.md](PACKING_LIST.md), [PLANNING_VIEW.md](PLANNING_VIEW.md) — Itinerary, packing, planner.
- [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md).
- [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md) — Mobile-specific parity and polish.
- [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md) — Docs and setup.
- [TESTING_AND_DEPLOYMENT.md](TESTING_AND_DEPLOYMENT.md) — Testing and deployment.

### Obsolete (post-migration)

- **WEB_SYNC_WIRING**, **WEB_REPOS_AND_FULL_SYNC**, **WEB_SYNC_STATUS_INDICATOR** — Described IndexedDB + sync to Go backend; web now uses Convex only. Do not implement those guides as written; any “sync status” would be Convex subscription state, not outbox/sync to Go.
- **WEB_FEATURE_GATES** — Was for tier gating against Go backend; when tiers exist, they will be enforced via Convex or auth, not the old API.
- **WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS** — Target (ImageUpload in closet/convention forms) still valid; implementation uses Convex file storage, not Go upload endpoint.
- **SEED_DATA_IMPLEMENTATION** — Described Go seed endpoint; if seed data is needed, implement via Convex (e.g. mutation or dashboard script).

---

## Key Files Reference

### Convex

- `convex/schema.ts` — Schema
- `convex/closetItems.ts`, `builds.ts`, `buildTasks.ts`, `conventions.ts`, `users.ts`, `files.ts` — CRUD and files
- `convex/auth.ts`, `convex/auth.config.ts` — Identity and JWT
- `convex/http.ts` — HTTP router and CORS
- `convex/betterAuth/` — Better Auth component

### Web

- `web/src/lib/auth/` — Auth client, server helpers, bearer storage
- `web/src/components/ConvexClientProvider.tsx`, `AuthGate.tsx`
- `web/src/hooks/useCurrentUser.ts`
- Pages under `web/src/app/` use `useQuery` / `useMutation` from `convex/react` with `api` from `convex/_generated/api`

### Mobile

- `mobile/src/lib/auth/` — Auth client, bearer storage
- `mobile/app/_layout.tsx` — Convex + Better Auth providers, OTT handler
- `mobile/src/hooks/useConvexSync.ts` — Convex → SQLite sync
- `mobile/src/services/convexSync.ts` — Push local changes to Convex
- `mobile/src/storage/` — SQLite repos (offline)

### Types

- `design-system/types/` — Shared types (convention, builds, etc.)
