# PR-Sized Commit Plan

Breakdown of roadmap into testable, shippable PRs. Prefer vertical slices. Order respects dependencies. Each PR has a short verification checklist. Last updated: 2026-03-04.

---

## Phase 0 — Repo hygiene

| PR  | Scope                                                                                                                                                                                                                                                                                  | Verification                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | Replace or add Makefile: either add Makefile with `validate`, `format` targets that call `npm run validate` / `npm run format`, or remove all references to `make` from README, CI_LOCAL.md, .cursor/rules/local-ci-validation.mdc, docs/CONTEXT.md, docs/implementation/NEXT_STEPS.md | Run `npm run validate`; grep for "make " in docs and rules — only acceptable in "or use make if you have it" after Makefile exists |
| 0.2 | Update README and CI_LOCAL.md: canonical command is `npm run validate`; list required tools (Node, Convex account, OAuth); remove Go/Docker as required for basic validation if desired                                                                                                | New contributor can clone, npm install, npm run validate and see clear instructions                                                |
| 0.3 | Env docs: ensure .env.example or docs list CONVEX*\*, NEXT_PUBLIC*_, BETTER*AUTH*_; remove Supabase/Go env from examples                                                                                                                                                               | Env section matches current stack                                                                                                  |

---

## Phase 1 — MVP

| PR  | Scope                                                                                                                                                           | Verification                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1.1 | Convex: require image on build create (convex/builds.ts — validate imageUrl or imageStorageId); optional design-system createBuildSchema imageUrl required      | Create build without image fails with clear error; with image succeeds |
| 1.2 | Web builds/new: require image before submit (disable button, label "IMAGE (REQUIRED)"); send imageUrl/imageStorageId                                            | Cannot submit without image; npm run validate passes                   |
| 1.3 | ~~Web convention new: add ImageUpload; pass imageUrl/imageStorageId to conventions.create~~ — **Done (2026-03-04):** convention new + edit page + detail image. | Create convention with image; npm run validate                         |
| 1.4 | Web itinerary: load convention and day plan; show day-by-day build cards and countdown (see CONVENTION_ITINERARY)                                               | Itinerary page shows real data; manual check                           |
| 1.5 | Packing page: add search filter; by-build expandable sections with per-group progress; ensure add item and regenerate work                                      | Packing list search and sections; manual check                         |
| 1.6 | Mobile: Convex image upload in build and closet create (generateUploadUrl → upload → getUrl → create)                                                           | Create build and closet item with image on mobile                      |
| 1.7 | Mobile: build detail with task list (create/update/delete tasks, progress X/Y)                                                                                  | Task CRUD and progress on mobile; manual check                         |
| 1.8 | Testing checklist: run through auth, build create, convention, packing, itinerary; document in TESTING_AND_DEPLOYMENT or TEST_RESULTS                           | Checklist completed; doc updated                                       |

---

## Phase 2 — Core expansion

| PR   | Scope                                                                                                                                                                                                                                                                                          | Verification                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2.1  | Web builds list: card layout (image, title, progress), status tabs (Current/Archived/Planning/Completed)                                                                                                                                                                                       | Builds list shows cards and tabs; npm run validate                                                             |
| 2.2  | Web planner: load tasks from Convex (all builds or convention-scoped); deadline-approaching and other sections; progress summary; add-task flow                                                                                                                                                | Planner shows real tasks; manual check                                                                         |
| 2.3  | ~~Settings: add routes... Account page~~ — **Done (2026-03-05):** /settings/account, /settings/subscription, /settings/notifications; menu links; Account (email, name, change password link).                                                                                                 | Navigate to each settings page; account shows auth data                                                        |
| 2.4  | ~~Settings: Subscription page... Notifications placeholder~~ — **Done (2026-03-05):** Subscription page (tier, usage from useTier; upgrade/manage placeholder); Notifications placeholder. Unit tests for settings index and all three subpages.                                               | Subscription page shows tier/usage                                                                             |
| 2.5  | Mobile: settings sub-screens (Account, Subscription, Notifications); same content as web where applicable                                                                                                                                                                                      | Mobile settings parity                                                                                         |
| 2.6  | ~~Convex seed mutation: createStarter...~~ — **Done (2026-03-04):** convex/seed.ts createStarter; web builds page "Load sample data" on empty state.                                                                                                                                           | First-time user gets seed data once; idempotent                                                                |
| 2.7  | Build detail: task → closet item assignment (drag-drop or menu); call buildTasks.update with closetItemId                                                                                                                                                                                      | Assign task to item; UI reflects it                                                                            |
| 2.8  | **Build list search, filter, sort (Feature 18):** Convex builds.list optional status, search, sortBy, order; web builds page search input + sort controls; unit tests (buildsListArgs).                                                                                                        | Filter by tab, search by name, sort by name/date/progress/budget; npm run validate; npm run test -w web passes |
| 2.9  | **Build project notes dedicated (Feature 15):** Notes button on build detail; BuildNotesModal (edit/save/clear notes); persists via builds.update(notes); unit tests BuildNotesModal.test.tsx.                                                                                                 | Open build → Notes → edit, save, clear; npm run validate; npm run test -w web passes                           |
| 2.10 | **Build summary dashboard (Feature 14):** Convex builds.getSummary(buildId, userId); BuildSummarySection on build detail (status, progress, dates, linked items, budget/spend/difference); unit tests BuildSummarySection.test.tsx.                                                            | Build detail shows Summary section; npm run validate; npm run test -w web passes                               |
| 2.11 | **Build reference images and progress photos (Features 16 + 17):** Convex buildReferenceImages and buildProcessPictures (schema, listByBuild, add, remove, reorder); ImageGallery onRemove/onReorder; BuildReferenceImagesSection and BuildProcessPicturesSection on build detail; unit tests. | Add/view/remove/reorder reference images and progress photos; npm run validate passes                          |

---

## Phase 3 — Advanced

| PR  | Scope                                                                                                                                                                                    | Verification                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 3.1 | ~~Convex users: ensure getMe... wire useTier in web~~ — **Done (2026-03-04):** getMe returns tier/currentUsageMb/storageLimitMb; useTier calls useQuery(api.users.getMe) when signed in. | useTier() returns real tier when set in Convex              |
| 3.2 | Stripe webhook: HTTP route or Convex action; verify signature; on subscription.\* update Convex users (tier, subscriptionStatus, etc.)                                                   | Webhook updates user in Convex; manual test with Stripe CLI |
| 3.3 | Stripe Checkout/Portal: Convex action returns Checkout and Portal URLs; frontend (settings) opens URL                                                                                    | User can open upgrade and manage links                      |
| 3.4 | UpgradePrompt component and use in settings (e.g. sync section when canUseCloudSync false)                                                                                               | FREE user sees upgrade message; link works                  |
| 3.5 | Feature gates: document which features are gated; add UpgradePrompt to other gated entry points if any                                                                                   | WEB_FEATURE_GATES and UI aligned                            |

---

## Phase 4 — Polish

| PR  | Scope                                                                                                        | Verification                                                           |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 4.1 | Add unit tests for shared utils or critical components (e.g. design-system schema, one key component)        | npm run test passes with new tests                                     |
| 4.2 | Security pass: CORS and trusted origins for prod; npm audit; no secrets in logs                              | Audit and CORS doc updated                                             |
| 4.3 | Doc pass: remove any remaining Supabase/Go references; README and CONTEXT point to Convex + Better Auth only | Grep for Supabase/Go in docs — only in MIGRATION or "archived" context |
| 4.4 | Optional: Convex integration tests or E2E for one critical path                                              | Tests run in CI or documented manual                                   |
| 4.5 | **i18n (Feature 19):** next-intl, LocaleProvider, Settings translated (en/es), language selector, locale in localStorage; locale.test.ts, settings test with LocaleProvider.                                                       | Settings shows English/Español; switch persists; npm run validate       |

---

## Verification checklist (every PR)

- [ ] `npm run validate` passes (or `npm run ci` / `npm run ci:win`).
- [ ] No new lint or type errors.
- [ ] Manual test of changed flows (auth, create build, etc.) if applicable.
- [ ] PR template checklist completed; screenshots for UI changes.
- [ ] Docs updated if behavior or setup changed.

---

## Links

- [ROADMAP.md](ROADMAP.md) — Phases
- [GAP_ANALYSIS.md](GAP_ANALYSIS.md) — Gap details and file paths
- [Competitor Analysis & Implementation Plan](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) — Competitor-parity tasks and engineering task list (Section 7); use to add or refine PRs for elements ≈ closet items, summary dashboard, status filter, completion validation, etc.
- [.github/pull_request_template.md](../../.github/pull_request_template.md) — PR checklist
