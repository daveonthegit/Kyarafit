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
| E2E (later)           | web (Playwright) + mobile (Detour/Maestro)                           | —                        | offline CRUD round-trip, export/import, upgrade/downgrade                                     |
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
