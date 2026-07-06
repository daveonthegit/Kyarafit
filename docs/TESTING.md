# Testing Strategy

_Source of truth for **how we test**. The detailed requirement→test mapping is in
[`specs/refactor-test-plan.md`](specs/refactor-test-plan.md). Tests verify the **spec**
([`PRODUCT_SPEC.md`](PRODUCT_SPEC.md) / [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md)), not the current
implementation._

---

## 1. Philosophy

1. **Spec-first / TDD.** Tests encode `REQ-*` acceptance criteria. They should **fail first** when the implementation doesn't meet the spec, then drive implementation green.
2. **Behavior, not internals.** Test public behavior, APIs, component output, and service boundaries — not private functions or implementation details.
3. **Executable documentation.** Behavior-based test names (`should_…`). A reader learns the spec from the test names.
4. **Never weaken a test to match broken behavior.** Fix the code, not the expectation.
5. **Cross-platform via pure logic.** Maximize logic in `design-system/domain/*` (pure, no React/platform) so one vitest suite covers web + mobile + Convex behavior. Add a thin platform harness only for true integration.

---

## 2. Test pyramid

| Layer                 | Where                                                                | Runner                   | Covers                                                                                        |
| --------------------- | -------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| Unit (pure domain)    | `design-system/domain` tested from `web/src/lib/**/*.test.ts`        | vitest                   | entitlements, sync gating, conflict merge, queue/backoff, overlays, validators, progress math |
| Component             | `web/src/**/*.test.tsx`                                              | vitest + Testing Library | screens/components: states (empty/loading/error/offline), gating UI                           |
| API / backend         | `convex/**` (convex-test or harness)                                 | vitest                   | auth scoping, idempotency, `listChangedSince`, ownership/authorization                        |
| Integration (offline) | mobile harness (jest-expo) **or** pure simulation of the queue/store | jest/vitest              | offline create→drain→idempotent replay, id remap                                              |
| A11y (web)            | `web/src/test/a11y.test.tsx`                                         | vitest + jest-axe        | zero WCAG 2.0/2.1 A/AA violations on key components (banners, empty state, forms, gates)      |
| E2E (web)             | `web/e2e/*.spec.ts` (Playwright)                                     | Playwright               | offline CRUD round-trip, export/import, upgrade backfill, downgrade banner (see §8)           |
| E2E (mobile, later)   | mobile (Detox / Maestro)                                             | —                        | native offline CRUD + sync; deferred (needs simulators/native builds) — see §10               |
| Parity                | shared-logic assertions + mirrored component tests                   | vitest                   | web and mobile consume the same shared logic                                                  |

> **Decision (test home):** prioritize pure-domain vitest now (no new tooling); add a mobile
> integration harness when runtime behavior (real SQLite, connectivity) must be exercised.

---

## 3. Naming

`should_<expected_behavior>_when_<condition>`. Examples:

- `should_not_start_sync_worker_for_free_user`
- `should_keep_advanced_planner_free`
- `should_block_public_share_for_free_user`
- `should_allow_group_cosplay_build_to_cloud_for_free_member`
- `should_merge_per_field_when_two_devices_edit_different_fields`
- `should_dedupe_replayed_offline_create`
- `should_show_empty_state_when_build_has_no_progress_updates`

Avoid names describing implementation (`should_call_setServerId`).

---

## 4. What to test

- All `REQ-*` with a testable rule (see test plan).
- Entitlement boundaries (free vs paid) — every paid lever and every free-but-online action.
- Sync correctness: gating, FIFO, idempotency, id remap, field-level LWW, tombstones.
- Offline visibility of writes across list/detail/derived views.
- State rendering: empty/loading/error/offline per [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) §4.
- Authorization/ownership on Convex functions.
- Import/export idempotency and round-trip fidelity.

## 5. What NOT to test

- Private helpers / exact call sequences.
- Third-party libs (Convex, RevenueCat, Better Auth internals).
- Visual pixel details (cover via design review/mockups, not snapshots of styling).
- Generated code (`convex/_generated`).

## 6. Conventions

- Reuse existing patterns: vitest + Testing Library; import shared logic from `@kyarafit/design-system/domain/*`.
- Add factories/fixtures for entities (build, element, task, user-with-tier) under a shared test-fixtures module rather than ad-hoc objects.
- Keep test data realistic but minimal.
- Mock only platform adapters (`LocalStore`, connectivity, Convex client) — never the logic under test.

## 7. CI gate

`make validate` (format + i18n + lint + typecheck + build + tests) must pass. New behavior tests are
part of the gate. See [repo `CI_LOCAL.md`].

The web unit gate (`npm run test -w web`) includes the **accessibility tests** (§8) — they run in the
normal vitest/jsdom suite, no extra step. The **Playwright E2E suite** (§9) is a separate, live-env
gate and is NOT part of `make validate`.

## 8. Accessibility gate (web, runnable)

`web/src/test/a11y.test.tsx` renders a focused set of key components in jsdom and asserts
[`jest-axe`](https://github.com/nickcolley/jest-axe) finds **zero** WCAG 2.0/2.1 A/AA violations:
`UpgradePrompt`, `FeatureGate` (gated), `EmptyState`, `OnlineOnlyBanner` (offline),
`CloudRetentionBanner` (grace), and a labeled form (`UnderlineInput` + `Button`).

```bash
npm run test -w web        # includes the a11y tests
npm run test:a11y -w web   # a11y tests only
```

Notes:

- The landmark `region` best-practice rule is disabled — it audits whole-page landmark structure, a
  layout concern, not a property of an isolated component in a bare jsdom body.
- `color-contrast` is not evaluable in jsdom (no layout/paint) and axe-core skips it automatically.
  Real contrast checking happens in the browser via the Playwright E2E run (future: add
  `@axe-core/playwright` scans to the E2E specs).
- Extend the gate by adding renders to this file as components mature.

## 9. E2E (web, Playwright)

Harness lives in `web/`: `playwright.config.ts` + `web/e2e/*.spec.ts`. Playwright drives a **real
running app** — it does not stub Convex or better-auth — so it needs a live target.

### Specs

| Spec                                 | Flow                                                      | Runs without auth?                              |
| ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------- |
| `smoke.spec.ts`                      | landing loads, sign-in form, protected-route redirect     | **Yes** (only needs the app running)            |
| `offline-crud.spec.ts`               | create a build offline → persists across reload           | No — skips without auth env                     |
| `export-import.spec.ts`              | export bundle → re-import idempotently (`/settings/data`) | No — skips without auth env                     |
| `upgrade-backfill.spec.ts`           | "Backing up your library… N/M" indicator (paid)           | No — skips without auth + `E2E_PAID_BACKFILL`   |
| `downgrade-retention-banner.spec.ts` | cloud-retention banner for a downgraded user              | No — skips without auth + `E2E_DOWNGRADED_USER` |

Auth-gated specs `test.skip(...)` with a clear reason when their env is absent — a skipped run
explains what it needs (they are **not** fake passes). Gating logic is in `web/e2e/fixtures.ts`.

### Run locally

```bash
# One-time: download browsers (NOT run in CI-restricted / offline envs)
npx playwright install --with-deps chromium

# 1. Point web at a Convex dev deployment (web/.env.local): NEXT_PUBLIC_CONVEX_URL=...
npx convex dev          # in the repo root, keep running
npm run dev -w web      # next dev on http://localhost:3000, keep running

# 2. Run E2E against it
npm run test:e2e -w web         # headless
npm run test:e2e:ui -w web      # Playwright UI mode

# Or let Playwright start next dev itself:
E2E_WEBSERVER=1 npm run test:e2e -w web
```

Env vars:

- `E2E_BASE_URL` — target app URL (default `http://localhost:3000`; set to a preview URL to test deploys).
- `E2E_WEBSERVER=1` — auto-start `next dev` (opt-in; needs `NEXT_PUBLIC_CONVEX_URL`).
- `E2E_USER_EMAIL` + `E2E_USER_PASSWORD` — a seeded, email-verified account for authed specs.
- `E2E_STORAGE_STATE` — alternatively, a pre-authenticated Playwright storage-state file.
- `E2E_PAID_BACKFILL=1` / `E2E_DOWNGRADED_USER=1` — enable the paid/downgrade-state specs.

`npx playwright test --list` lists all specs **without running** them — useful to confirm the harness
and config load.

### CI

E2E is intentionally **not** wired into the default `web.yml` gate (no secrets / live Convex there).
Add a manual/gated job (`workflow_dispatch`, or `if:` a secret is present) that provisions a Convex
dev deployment + a seeded account, runs `npx playwright install --with-deps chromium`, then
`npm run test:e2e -w web`. Keep it separate so it never blocks the unit gate.

## 10. Performance budgets (plan)

No runnable perf gate yet — documented here to avoid a flaky/unrunnable check:

- **Bundle size.** Track `next build` route/first-load JS. Budget: keep app-shell first-load JS under
  a fixed ceiling; fail CI on a regression beyond a threshold. Candidate tooling: Next's build output
  parsing or `@next/bundle-analyzer` in a manual job.
- **Render timing.** For the heaviest client screens (planner, builds list), add a lightweight
  Playwright timing assertion (navigation → key element visible under a budget) once the E2E env is
  live. Prefer a generous budget to avoid flakiness; treat as a smoke signal, not a microbenchmark.
- **Offline hydration.** Assert local-first read (list visible after reload while offline) completes
  within a budget as part of `offline-crud.spec.ts` when it runs live.

## 11. Follow-ups

- **Mobile E2E** (Detox or Maestro): native offline CRUD + sync round-trips on a simulator. Deferred
  — requires simulator/native-build infra not available in the current test environment.
- **`@axe-core/playwright`**: real-browser a11y scans (incl. color-contrast) layered onto the E2E specs.
- Wire the perf budgets in §10 into CI once the live E2E environment exists.
