# Kyarafit — Current Plan & Project Snapshot

_Last updated: 2026-06-15. This is the canonical "where we are / where we're going" doc for
developers and AI coding agents. For full setup see [README.md](README.md); for the deep
local-first design see [docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md](docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md)._

## Purpose & direction

Kyarafit is a **mobile-first cosplay wardrobe and convention-planning app**. Users catalog costume
pieces (closet/elements), group them into per-character **builds**, plan **conventions** day-by-day,
and auto-generate **packing lists**.

Strategic direction (in progress): make the app **free to use on web and mobile with a required
account**, where core work is **local-first** (free users cost ~nothing — no cloud reads/writes),
and the **only paid lever is automatic cloud sync** ("work from any device, never lose data"). Free
users get durability via export/import. See the monetization model below.

## Tech stack

| Layer         | Tech                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Backend       | **Convex** (document DB, queries/mutations, file storage)                                                       |
| Auth          | **Better Auth** as a Convex component (`convex/betterAuth/`) — Google OAuth (+ GitHub optional, email/password) |
| Web           | **Next.js 16** (App Router), React 19, TailwindCSS, Convex React hooks                                          |
| Mobile        | **Expo / React Native**, Convex + local **SQLite** offline layer (`mobile/src/offline/`)                        |
| Shared        | `design-system/` — OKLCH design tokens + platform-agnostic domain logic                                         |
| Billing       | **RevenueCat** (entitlements `pro`, `supporter`); webhook → `convex/revenuecat.ts` → `users.tier`               |
| Image service | Python `rembg` background removal (optional), `image-service/`                                                  |
| Monorepo      | npm workspaces: `web`, `mobile`, `design-system`                                                                |

The archived Go backend lives in `backend-archived/` and is **not used**.

## What is implemented

Core product is largely shipped on **web**; **mobile** trails on some build-detail features. Source
of truth for the detailed matrix: [docs/implementation/FEATURE_STATUS.md](docs/implementation/FEATURE_STATUS.md).

- Auth, Closet/Elements, Builds, Build tasks, Conventions, Packing lists, Planner, Settings — implemented.
- Build detail: summary dashboard, notes, reference images, process pictures, search/filter/sort — implemented (web; mobile partial).
- Image upload (Convex storage), seed data (dev), public build sharing — implemented.
- i18n: mobile fully localized (en/ja/es); web partial (en/es, next-intl on some pages).
- Tiers/subscription: UI + entitlement gating implemented; RevenueCat wired; store products need configuring.

## What we are actively working on now

1. **Local-first migration (mobile first).** Replacing the offline bridge stubs with a real
   stale-while-revalidate read path and an offline mutation queue + sync worker.
   - ✅ `useOfflineQuery` — SWR over the SQLite `query_cache` (`mobile/src/offline/useOfflineQuery.ts`).
   - ✅ `useOfflineMutation` + sync worker — online passthrough, offline enqueue, FIFO drain on
     reconnect, connectivity-guarded (`mobile/src/offline/{useOfflineMutation,syncWorker,mutationQueue}.ts`).
   - Both additive/non-regressing; online behavior unchanged.
2. **Monetization refactor (done in code).** Collapsed PRO/STUDIO into one paid level; tiers are now
   **FREE + PRO + SUPPORTER** (Supporter = same features as Pro, pay-what-you-want via preset price
   points). Build limits removed; all export free; gate paid features with `isPaidTier`/`isPaid`.
3. **Editorial UI consistency** across web/mobile (ongoing design polish).

## What is planned next (priority order)

From [LOCAL_FIRST_FREEMIUM_PLAN.md](docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md):

1. **Server idempotency** — wire `idempotencyLedger` into offline-capable mutations (makes replay dedupe-safe).
2. **`clientId`/`id_map`** — stable ids for offline-created entities.
3. **Optimistic visibility** — entity-level read-through so offline writes show before sync.
4. **Free local-only gating** — free users never hit Convex for data; sync worker gated on `isPaid`.
5. **Web local-first** — OPFS + wa-sqlite port of the offline layer.
6. **Local images**, then **export/import** (CSV + JSON/ZIP), then **upgrade backfill / downgrade freeze**.

## Important architecture decisions

- **Convex + Better Auth** (auth runs as a Convex component); `identity.subject` is the user's
  `externalId`, used as `userId` on every row.
- **Offline-first** design (blueprint `docs/mobile-rewrite/BLUEPRINT.md` §3.13): SQLite cache +
  mutation queue + sync worker; LWW by `updated_at`/`version`; no CRDT.
- **Local store as source of truth** (target): Convex becomes an opt-in paid sync layer.
- **Shared `design-system/`** for tokens and pure domain logic (imported by web + mobile + Convex),
  so tier policy / offline key logic has a single source.
- **Editorial/lookbook design language**: serif-italic display titles (Bodoni Moda), uppercase
  tracked meta-labels, OKLCH `--kyar-*` tokens from `design-system/design_tokens.json`.

## Key folders / files

- `convex/` — backend. `schema.ts` (all tables), `auth.ts`, `users.ts`, `builds.ts`, `conventions.ts`,
  `buildTasks.ts`, `workflow.ts`, `cosplayNodes.ts`, `groups.ts`, `revenuecat.ts`, `betterAuth/`.
- `web/src/app/` — Next.js routes; `web/src/components/`, `web/src/lib/`.
- `mobile/app/` — Expo Router screens; `mobile/src/offline/` — local-first layer; `mobile/src/ui/` — primitives.
- `design-system/domain/` — shared domain logic (`subscriptionTierPolicy.ts`, `entitlements.ts`,
  `subscriptionPlans.ts`, `offlineQueryCache.ts`, `offlineMutationQueue.ts`).
- `rules/` — coding conventions (backend/frontend/testing/ci/security/mobile-parity).
- `docs/implementation/` — detailed planning/status; `docs/mobile-rewrite/BLUEPRINT.md` — offline design.

## Setup & run (short)

Full instructions in [README.md](README.md). TL;DR:

```bash
npm install
npx convex dev          # links/sets CONVEX_* env
npm run dev:web         # web on http://localhost:3000
npm run start -w mobile # Expo (optional)
npm run validate        # format:check + i18n:check + lint + typecheck + build:web
```

> The root `Makefile` still references the **archived** Go backend and docker postgres/redis — prefer
> the `npm run *` scripts. `make dev`/`make validate` are partly stale (tech debt, see below).

## Conventions

- **UI** — Editorial design language; OKLCH tokens → `tailwind` (web CSS vars) + `rn_tokens.ts`
  (mobile). Web primitives: `PageHeader`, `SectionCard`, `EmptyState`, `AdaptiveModal`. Mobile
  primitives: `SurfaceCard`, `MetaLabel`, `SectionHeading`, `DataBoundary` (`mobile/src/ui`). Icons:
  web is mostly Material Symbols (some lucide-react — debt); i18n via next-intl (web) / i18next (mobile).
- **API** — Convex queries/mutations in `convex/*.ts`, args validated with `v.*`. Auth via
  `ctx.auth.getUserIdentity()`; `identity.subject` = `externalId`. Web calls Convex hooks directly;
  **mobile Offline Core screens must use `useOfflineQuery`/`useOfflineMutation` from `@/offline`**
  (ESLint-enforced: `mobile/eslint-rules/no-direct-convex-in-offline-core.cjs`).
- **Database** — Convex document DB (`convex/schema.ts`). Rows scoped by `userId` (= Better Auth
  `externalId`). Offline-sync scaffolding on user-created tables: `clientId`, `version`,
  `by_userId_clientId` index; `idempotencyLedger` table for replay dedupe.
- **Auth** — Better Auth (`convex/betterAuth/`); bearer token in `localStorage` (web) / SecureStore
  (mobile); `getCurrentUser` in `convex/auth.ts`.
- **Tasks** — `workflowItems` (planner tree: parent/ancestor, scheduling, attachments, dependencies)
  is the **canonical and only real task store**. `api.buildTasks.*` is a thin **compatibility shim
  over `workflowItems`**: every query and mutation reads/writes `workflowItems` (+ `workflowAttachments`)
  and maps to the legacy task shape — its `create`/`update`/`remove` even take `id: v.id("workflowItems")`,
  so the ids it returns are `workflowItems` ids. The web build-detail task checklist
  (`web/src/components/builds/TaskChecklist.tsx`, `BuildAddTaskModal.tsx`,
  `web/src/app/build-detail/[id]/page.tsx`) uses this shim, so it already runs on `workflowItems` — no
  migration needed. The physical `buildTasks` **table is vestigial** (empty on prod; nothing reads/writes
  it as real data). See known gaps for cleanup status.
- **Groups** — `groups` + `groupMembers` (with `role`) + `groupConventionDays` + `buildCollaborators`.
  Shared group data is inherently online. Decision: **creating a group is a paid feature**; joining /
  participating is free but online-only (planned gate, not yet enforced — Needs verification).
- **Roles** — `users.role` is `"user" | "admin"`; admin APIs gated by `requireAdmin` (`convex/admin.ts`).
  Group membership role on `groupMembers.role`; build-level role on `buildCollaborators.role`.

## Known gaps, unfinished features, tech debt

- **Local-first incomplete:** mobile offline writes are durable but **not visible until reconnect**;
  offline replay is now **dedupe-safe for registered create/update mutations** via the idempotency
  ledger (builds + conventions done; `workflow`/`users` pending), but unregistered mutations remain
  at-least-once; free users still hit Convex online (free local-only source-of-truth not built);
  **web is not local-first** yet.
- **Images** are online-only; no local image store or export/import yet.
- **Vestigial `buildTasks` table** — `api.buildTasks` is already a `workflowItems` shim and the table
  holds no real data (empty on prod), but it's still in the schema (the table + `closetItems.completionTaskId`
  - `workflowItems.legacyBuildTaskId` `v.id("buildTasks")` fields + 2 indexes) and a few legacy code
    paths (seed insert, account-deletion cleanup, `migrations.ts` legacy→workflow migration, and
    always-empty fallback reads in `builds.ts`/`cosplayNodes.ts`/`closetItems.ts`). _Investigated
    2026-06-15; pruning **deferred** by choice._ When done it's a staged schema migration: unset any
    lingering cross-ref field values → drop the fields/table/indexes → retire the migration. (Other
    envs: treat as disposable — no migration data to preserve.)
- **Web i18n partial** (en/es only, not all pages); web icon set mixes lucide + Material Symbols.
- **Itinerary web view** is basic/stub.
- **Makefile** references the archived Go backend + docker postgres/redis — stale.
- **Supporter** preset products must be created in RevenueCat + App Store/Play before purchasable.
- **Deployment automation:** `Needs verification` — `web/fly.toml` + `image-service/fly.toml` exist
  (Fly.io), Convex via `npx convex deploy`, GitHub Actions run CI; older docs claim GCP/Vercel.
- Older `docs/implementation/*` planning docs predate this snapshot — treat **this file** as current.
