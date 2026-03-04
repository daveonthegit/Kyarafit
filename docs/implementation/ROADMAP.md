# Phased Roadmap

High-level phases for closing gaps and hardening. Aligned with [GAP_ANALYSIS.md](GAP_ANALYSIS.md) and [FEATURE_STATUS.md](FEATURE_STATUS.md). Last updated: 2026-03-04.

---

## Phase 0 — Repo hygiene

**Goal:** Env, scripts, lint, formatting, and base CI are consistent and documented. No broken references to Makefile or obsolete stack.

**Work:**

- Align CI/docs with **npm run validate** (and npm run ci / ci:win). Either add a minimal Makefile that delegates to npm or replace all references to `make validate` / `make format` in README, CI_LOCAL.md, .cursor/rules, docs/CONTEXT.md, docs/implementation/NEXT_STEPS.md.
- Ensure .env.example or env docs list required Convex and web vars (no Supabase/Go).
- Verify Prettier and ESLint configs cover web and mobile; fix any failures from `npm run validate`.
- Optional: Add or update CONTRIBUTING.md with link to rules/ and docs/implementation/.

**Outcome:** New contributors can run one command to validate; no "make: command not found" or outdated backend references.

---

## Phase 1 — MVP (must-have flows)

**Goal:** Core flows are complete and verifiable: auth, closet, builds, build tasks, conventions, itinerary, packing. Gaps that block "complete a full build flow" are closed.

**Work:**

- **Auth:** Already done (Better Auth). Verify email + OAuth + reset password work; CORS and trusted origins for production URLs.
- **Builds:** Optional: enforce required image in Convex build create and on web/mobile create form (see BUILDS_REQUIRE_IMAGE_AND_OVERVIEW). Builds list: improve UX (cards + tabs) if time allows.
- **Build tasks:** Confirm TaskChecklist and build detail are fully wired (create/update/delete) on web and mobile.
- **Conventions + packing:** Convention create/edit with image (convention new page). Packing list: search, by-build sections, add item working.
- **Itinerary:** Itinerary page shows convention and day-by-day build cards with countdown (see CONVENTION_ITINERARY).
- **Mobile:** Build detail with tasks; Convex image upload for build/closet/convention create; offline/signed-out UX clear.
- **Testing:** Manual run-through of auth, create build with image, create convention, add packing item, view itinerary. Document in TESTING_AND_DEPLOYMENT.

**Outcome:** A user can sign in, create a build with image, add tasks, create a convention, assign builds to days, use packing list, and view itinerary. Web and mobile parity for these flows.

---

## Phase 2 — Core expansion

**Goal:** Builds list as cards and tabs; planner with real tasks; settings subpages; mobile image upload everywhere; optional seed data.

**Work:**

- **Builds list:** Card layout with image, progress, status tabs (Current/Archived/Planning/Completed). See BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.
- **Planner:** Load tasks from Convex; group by deadline-approaching vs other; progress summary; add-task flow. See PLANNING_VIEW.
- **Settings:** Subpages /settings/account, /settings/subscription, /settings/notifications with real content (account from Better Auth; subscription shows tier/usage; notifications placeholder or prefs). See SETTINGS_AND_MENUS.
- **Mobile:** Image upload (Convex) on all create flows; settings menu and sub-screens; itinerary and planner parity.
- **Seed data:** Optional Convex mutation or dashboard script for first-time user seed (one build, one convention, one closet item). See SEED_DATA_IMPLEMENTATION.
- **Task → closet assignment:** On build detail, assign task to closet item (drag-drop or menu). See DRAG_DROP_IMPLEMENTATION.

**Outcome:** Richer builds list and planner; settings usable; mobile parity; optional onboarding seed.

---

## Phase 3 — Advanced features

**Goal:** Tiers and subscription (Stripe); feature gates and upgrade prompts; polish on drag-drop and gated flows.

**Work:**

- **Tier from Convex:** users.getMe (or equivalent) returns tier, currentUsageMb, storageLimitMb. Wire useTier in web (and mobile) to this query.
- **Stripe:** Webhook handler (verify signature; update Convex users on subscription events). Checkout and Customer Portal URLs from Convex action or HTTP; frontend opens from settings. See SUBSCRIPTION_SERVICE.
- **Feature gates UI:** UpgradePrompt/FeatureGate component; show where sync/export (or other gated features) are blocked; link to subscription. See WEB_FEATURE_GATES.
- **Enforcement:** Enforce tier limits in Convex where product defines them (e.g. storage cap, build limit).

**Outcome:** Real tiers; users can upgrade and manage subscription; FREE users see clear upgrade prompts.

---

## Phase 4 — Polish and hardening

**Goal:** Performance, security review, observability, testing coverage, doc final pass.

**Work:**

- **Performance:** Profile slow Convex queries or heavy client work; add indexes or pagination if needed. Image sizing/optimization if needed.
- **Security:** Review auth and CORS for production; dependency audit (npm audit); ensure no secrets in logs or client bundle.
- **Observability:** Convex logs for errors and key events; optional error reporting (e.g. frontend). See rules/observability-patterns.mdc.
- **Testing:** Add unit tests for critical utils and components; optional Convex integration tests; optional E2E for sign-in and one full flow. See rules/testing-patterns.mdc.
- **Docs:** Final pass on docs/implementation/ and rules/; remove any remaining Supabase/Go references; ensure README and CONTEXT point to Convex and Better Auth.

**Outcome:** Stable, auditable, and maintainable; new contributors have clear entry points.

---

## Links

- [GAP_ANALYSIS.md](GAP_ANALYSIS.md) — Detailed gaps and file locations
- [FEATURE_STATUS.md](FEATURE_STATUS.md) — Implemented vs partial
- [COMMIT_PLAN.md](COMMIT_PLAN.md) — PR-sized breakdown
- [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) — Acceptance criteria
