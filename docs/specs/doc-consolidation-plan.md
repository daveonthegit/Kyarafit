# Documentation Consolidation Plan

_Created for the app refactor (spec-driven restart). This plan governs the move from ~90 scattered
docs to a small, AI-friendly source-of-truth set. **Decision: delete superseded docs** (greenfield
project, git history preserves them) and replace with the consolidated set below._

## 1. Target structure (source of truth)

```txt
docs/
  README.md            # index: what each doc is, which is source of truth
  AI_CONTEXT.md         # first file an AI agent loads; short, high-signal
  PRODUCT_SPEC.md       # product behavior, modules, REQ IDs, freemium, acceptance criteria
  ARCHITECTURE.md       # structure, shared logic, boundaries, conventions
  DATA_AND_SYNC.md      # data model, local-first, sync, conflict, migration, quotas
  DESIGN_SYSTEM.md      # design principles, IA/nav, components, states, a11y, parity matrix
  TESTING.md            # testing philosophy + what/how to test
  ROADMAP.md            # phased implementation order
  specs/
    doc-consolidation-plan.md   # this file
    refactor-test-plan.md       # REQ -> test mapping (detailed)
  ai/
    IMPLEMENTATION_HANDOFF.md   # Composer handoff prompt
```

Ownership rule (no duplication): product → `PRODUCT_SPEC`; architecture → `ARCHITECTURE`; data/offline/sync/quota → `DATA_AND_SYNC`; UI/parity → `DESIGN_SYSTEM`; tests → `TESTING` + `specs/refactor-test-plan`; order → `ROADMAP`; AI handoff → `AI_CONTEXT` + `ai/IMPLEMENTATION_HANDOFF`. If a rule belongs elsewhere, **link** to its owning section, never restate it.

## 2. Inventory & disposition

Legend: **KEEP** (still source of truth) · **MERGE** (fold content into a consolidated doc, then delete original) · **REWRITE** (content stale; new doc replaces it) · **DELETE** (obsolete/duplicate/historical).

### Root-level

| File                                               | Action         | Folds into                        |
| -------------------------------------------------- | -------------- | --------------------------------- |
| `CURRENT_PLAN.md`                                  | MERGE → DELETE | `AI_CONTEXT.md` + `ROADMAP.md`    |
| `HANDOFF.md`                                       | MERGE → DELETE | `ai/IMPLEMENTATION_HANDOFF.md`    |
| `README.md` (repo)                                 | KEEP (trim)    | stays; points to `docs/README.md` |
| `SECURITY_AUDIT.md`                                | KEEP           | security record (point-in-time)   |
| `CI_LOCAL.md`                                      | KEEP           | CI instructions (still valid)     |
| `pr-body.md`, `pr-planner.md`, `fix-migration.sql` | DELETE         | stale scratch files               |

### `docs/` product / planning (the bulk)

| Group                             | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Action                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Product                           | `PRD.md`, `CONTEXT.md`, `USER_FLOWS.md`, `roadmap.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                 | REWRITE → `PRODUCT_SPEC.md` / `ROADMAP.md`, then DELETE                                                                    |
| Architecture                      | `architecture.md`, `project_structure.md`, `MIGRATION.md`, `DEVELOPMENT.md`                                                                                                                                                                                                                                                                                                                                                                                                                           | REWRITE → `ARCHITECTURE.md` + `DATA_AND_SYNC.md`, then DELETE                                                              |
| Local-first                       | `implementation/LOCAL_FIRST_FREEMIUM_PLAN.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                         | MERGE → `DATA_AND_SYNC.md` + `ROADMAP.md`, then DELETE                                                                     |
| Implementation status (40+ files) | `implementation/*` (FEATURE*STATUS, GAP_ANALYSIS, IMPLEMENTATION_STATUS, NEXT_STEPS, MOBILE_NEXT_STEPS, COMMIT_PLAN, ROADMAP, PLANNING_VIEW, BUILD_TASKS_SYSTEM, COSPLAY*\_, WEB\__, DRAG*DROP\*, SEED*_, PACKING*LIST, CONVENTION_ITINERARY, PR_FEATURE*\_, DOC*INVENTORY, DOCS_AND_SETUP_UPDATES, IMPLEMENTATION_GUIDES_INDEX, FEATURES_CANONICAL, SETTINGS_AND_MENUS, I18N_DESIGN, TESTING_AND_DEPLOYMENT, BUILDS_REQUIRE*\*, WEB_FEATURE_GATES, AUTH_OPTIMIZATION_DEFERRED, SUBSCRIPTION_SERVICE) | DELETE (historical; superseded by the spec). Salvage any still-true constraint into the consolidated docs first.           |
| Billing                           | `billing/*` (REVENUECAT\_\*, ADSENSE_SETUP, AD_SYSTEM, SUBSCRIPTION_PLANS)                                                                                                                                                                                                                                                                                                                                                                                                                            | MERGE useful setup → keep `billing/REVENUECAT_SETUP.md` only; freemium _rules_ live in `PRODUCT_SPEC.md`. DELETE the rest. |
| Design                            | `design/*`, `design_system/*`, `ui/*`, `style_doc.md`, `.impeccable.md`, `stitch-refs/*`                                                                                                                                                                                                                                                                                                                                                                                                              | REWRITE → `DESIGN_SYSTEM.md`; KEEP `design_system/design_tokens.json` (consumed by code). DELETE prose duplicates.         |
| Mobile rewrite                    | `mobile-rewrite/BLUEPRINT.md`, `FOLLOWUP-*`, `monorepo-npm-hoisting.md`                                                                                                                                                                                                                                                                                                                                                                                                                               | MERGE offline design → `DATA_AND_SYNC.md`; KEEP `monorepo-npm-hoisting.md` (operational). DELETE rest.                     |
| API                               | `api/api_overview.md`, `api/API_DOCUMENTATION.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                     | REWRITE → `ARCHITECTURE.md` (API boundaries). DELETE.                                                                      |
| Parity                            | `WEB_MOBILE_PARITY_REVIEW.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | REWRITE → `DESIGN_SYSTEM.md` parity matrix. DELETE.                                                                        |
| Competitor                        | `competitor/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | ARCHIVE intent → DELETE (not implementation-relevant).                                                                     |
| Setup/infra                       | `setup/*`, `GCP_*`, `integrations/*`, `runbooks/*`, `DOCKER_SETUP`                                                                                                                                                                                                                                                                                                                                                                                                                                    | KEEP under `docs/setup/` + `docs/runbooks/` (operational, not product).                                                    |
| Legal                             | `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, `LICENSE.md`, `APP_STORE_PRIVACY_REQUIREMENTS.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`                                                                                                                                                                                                                                                                                                                                                 | KEEP (legal/governance).                                                                                                   |
| Changelogs                        | `changelog/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | KEEP (historical record).                                                                                                  |

## 3. Contradictions found (resolved by the new spec)

1. **Tiers:** older docs reference STUDIO/PREMIUM tiers + build/convention count limits. **Resolved:** FREE + PRO + SUPPORTER (paid identical); no count limits.
2. **Export gating:** some docs gate export as paid. **Resolved:** all export is free.
3. **Advanced planner:** `entitlements.ts` gates it as paid; the refactor makes it **free** (only the levers in `PRODUCT_SPEC` §Freemium are paid).
4. **Storage:** docs say free=50MB cloud. **Resolved:** free = unlimited **local** / **0 cloud**; paid = 2GB cloud.
5. **Closet:** `closetItems` vs `cosplayNodes` both documented. **Resolved:** one canonical **Elements** model; `closetItems` + `buildTasks` removed.
6. **Tasks:** `buildTasks` vs `workflowItems`. **Resolved:** `workflowItems` only.
7. **Conflict policy:** blueprint says whole-doc LWW; refactor adopts **per-field LWW**.

## 4. Missing docs this plan adds

- A single product source of truth (`PRODUCT_SPEC.md`) with requirement IDs.
- A single data/sync source of truth (`DATA_AND_SYNC.md`).
- A parity matrix (`DESIGN_SYSTEM.md`).
- A compact AI handoff (`AI_CONTEXT.md`).

## 5. Procedure

1. Write the consolidated set (done in this change).
2. Verify no consolidated doc references a to-be-deleted file.
3. Delete superseded files listed above.
4. Update repo `README.md` to point at `docs/README.md`.
