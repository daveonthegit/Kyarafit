# Implementation Documentation

Planning and status docs for the Kyarafit app. **Convex + Better Auth** is the active stack; Supabase and Go backend are archived.

---

## Stack Summary

| Layer                 | Technology                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Backend**           | Convex (database, queries, mutations, file storage). Go backend is **archived** (`backend-archived/`); not used by web or mobile.                                                                            |
| **Frontend (web)**    | Next.js 16 (App Router), React 19, TailwindCSS, Convex React hooks (`useQuery`/`useMutation`) only—no Go API, no IndexedDB.                                                                                  |
| **Frontend (mobile)** | Expo (React Native), Convex when signed in; local SQLite + `useConvexSync` / `convexSync.ts` for offline/sync.                                                                                               |
| **DB**                | Convex (document DB). No Supabase/Prisma/migrations in active use.                                                                                                                                           |
| **Auth**              | Better Auth (Google/GitHub OAuth, email+password) as Convex HTTP component (`convex/betterAuth/`). Session via bearer token (localStorage/AsyncStorage).                                                     |
| **Validation/types**  | Convex validators (`v.*` in `convex/*.ts`); design-system types in `design-system/types/`. No OpenAPI; legacy Go API doc in `docs/api/`.                                                                     |
| **Monorepo**          | npm workspaces: `web`, `mobile`, `design-system`. No pnpm/turborepo/Nx.                                                                                                                                      |
| **Testing**           | Web: `npm run test` (placeholder); mobile: same; image-service: pytest; Go tests skipped in CI (backend archived).                                                                                           |
| **Lint/format**       | Prettier (root + workspaces), ESLint (web, mobile). Local CI: `scripts/ci-local.ps1` and `scripts/ci-local.sh`. Use **`npm run validate`** or **`npm run ci`** / **`npm run ci:win`** (no Makefile in repo). |
| **Deployment**        | Web: Vercel; Convex: `npx convex deploy`; image-service: Fly (fly.toml).                                                                                                                                     |

Evidence: [package.json](../../package.json), [web/package.json](../../web/package.json), [convex/schema.ts](../../convex/schema.ts), [docs/MIGRATION.md](../MIGRATION.md), [.github/workflows/ci.yml](../../.github/workflows/ci.yml), [scripts/ci-local.ps1](../../scripts/ci-local.ps1).

---

## What changed (audit 2026-03-04)

- **Added:** DOC_INVENTORY.md, FEATURES_CANONICAL.md, FEATURE_STATUS.md, GAP_ANALYSIS.md, ROADMAP.md, COMMIT_PLAN.md; Stack Summary and this README structure; **rules/** at repo root with backend-patterns, frontend-patterns, testing-patterns, ci-cd-patterns, security-patterns, observability-patterns, commit-and-pr-guidelines.
- **Rewritten:** All implementation guides that referenced Go/Supabase/IndexedDB now reframe for Convex and current paths: BUILDS_REQUIRE_IMAGE_AND_OVERVIEW, SEED_DATA_IMPLEMENTATION, WEB_TASK_CHECKLIST_AND_BUILD_DETAIL, DRAG_DROP_IMPLEMENTATION, CONVENTION_ITINERARY, PACKING_LIST, PLANNING_VIEW, SETTINGS_AND_MENUS, SUBSCRIPTION_SERVICE, WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS, WEB_FEATURE_GATES, TESTING_AND_DEPLOYMENT, MOBILE_NEXT_STEPS. Each has Purpose, Scope, Current state (evidence), Next steps, Links.
- **Updated (KEEP):** IMPLEMENTATION_GUIDES_INDEX (removed obsolete guide rows, added Last verified), NEXT_STEPS (npm run validate), DOCS_AND_SETUP_UPDATES (Last verified; removed SUPABASE_TODO references), IMPLEMENTATION_STATUS (unchanged; already Convex-aware).

## What was removed

- **Deleted:** WEB_SYNC_WIRING.md, WEB_REPOS_AND_FULL_SYNC.md, WEB_SYNC_STATUS_INDICATOR.md, USER_SYNC_QUICK_REF.md, SUPABASE_TODO.md, AUTH_WEB.md, USER_SYNC_SYSTEM.md. These described web IndexedDB sync to Go, Supabase setup, or legacy user sync; web uses Convex only and auth is Better Auth (see docs/auth.md).

---

## Where to Start

1. [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) — Canonical feature list and acceptance criteria.
2. [FEATURE_STATUS.md](FEATURE_STATUS.md) — Implemented vs partial vs not implemented, with evidence.
3. [GAP_ANALYSIS.md](GAP_ANALYSIS.md) — Remaining work by area.
4. [ROADMAP.md](ROADMAP.md) — Phased roadmap (Phase 0–4).
5. [COMMIT_PLAN.md](COMMIT_PLAN.md) — PR-sized commit plan.
6. [IMPLEMENTATION_GUIDES_INDEX.md](IMPLEMENTATION_GUIDES_INDEX.md) — Index of step-by-step implementation guides.
7. [Competitor Analysis & Implementation Plan](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) — Cosplanner screenshot analysis, feature comparison vs Kyarafit, gap prioritization, and implementation design (elements ≈ closet items, summary dashboard, status filter, etc.). Use for competitor-parity priorities and task breakdown.

Patterns and conventions: see **[rules/](../../rules/)** at repo root ([backend-patterns](../../rules/backend-patterns.mdc), [frontend-patterns](../../rules/frontend-patterns.mdc)).

---

## Key Docs

| Doc                                                  | Purpose                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| [DOC_INVENTORY.md](DOC_INVENTORY.md)                 | Inventory and classification (KEEP/REWRITE/MERGE/DELETE) of implementation docs. |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Current completed vs remaining work (Convex + Better Auth).                      |
| [NEXT_STEPS.md](NEXT_STEPS.md)                       | Post-migration priorities and what not to do.                                    |
| [Competitor Analysis & Implementation Plan](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) | Cosplanner feature analysis, comparison table, gap prioritization, implementation design, phased roadmap, and engineering task list. |
