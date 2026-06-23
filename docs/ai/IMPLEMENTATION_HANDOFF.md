# Implementation Handoff — Kyarafit refactor

_Prompt + brief for the implementation model (e.g. Composer). Read [`../AI_CONTEXT.md`](../AI_CONTEXT.md)
first, then the source-of-truth docs it links._

---

## Summary

Kyarafit is a local-first cosplay wardrobe + convention-planning app (web + mobile, Convex backend,
Better Auth, RevenueCat). We are doing a **spec-driven refactor**. The **spec is the source of
truth**; existing code is reference only — rewrite or delete what conflicts.

## Read these (in order)

1. [`../AI_CONTEXT.md`](../AI_CONTEXT.md) — decisions, constraints, commands.
2. [`../PRODUCT_SPEC.md`](../PRODUCT_SPEC.md) — behavior + `REQ-*`.
3. [`../DATA_AND_SYNC.md`](../DATA_AND_SYNC.md) — data model, sync, conflict, quotas (`REQ-D*`).
4. [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — boundaries + conventions.
5. [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) — UI/parity (visual direction is OQ-1, pending).
6. [`../specs/refactor-test-plan.md`](../specs/refactor-test-plan.md) — REQ→tests.
7. [`../ROADMAP.md`](../ROADMAP.md) — phase order.

## Tests that must pass (first slice — Phase 0)

Make these green without weakening them (see test plan §4):

- `should_not_start_sync_worker_for_free_user`, `should_start_sync_worker_for_paid_signed_in_user`, `should_not_start_sync_worker_when_signed_out` (REQ-D60)
- `should_keep_advanced_planner_free` (REQ-013)
- `should_gate_cloud_sync_to_paid`, `should_block_public_share_for_free_user` (REQ-015/017)
- `should_set_free_cloud_cap_to_zero`, `should_set_paid_cloud_cap_2048`, `should_block_new_cloud_upload_over_cap_without_deleting` (REQ-D90)
- `should_merge_per_field_when_two_devices_edit_different_fields`, `should_let_tombstone_win_over_older_edit`, `should_break_equal_timestamp_ties_deterministically` (REQ-D65/66)
- `should_allow_group_cosplay_build_to_cloud_for_free_member`, `should_block_non_group_build_cloud_for_free_user` (REQ-021)
- `should_make_zero_convex_data_calls_for_free_user` (REQ-D10)

## Implementation order

Follow [`../ROADMAP.md`](../ROADMAP.md): **Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**, design (9)
parallel after Phase 0. Land web + mobile parity within each phase (shared logic first).

## Files likely to modify (Phase 0)

- `design-system/domain/entitlements.ts` (advanced planner → free)
- `design-system/domain/syncPolicy.ts` **(new)** — `shouldRunSyncWorker(tier, signedIn)`
- `design-system/domain/cloudStoragePolicy.ts` **(new)** — caps + `canUploadBuildToCloud(...)`
- `design-system/domain/offlineConflict.ts` **(new)** — `mergeFieldLWW(local, remote)`
- `mobile/src/offline/SyncWorkerProvider.tsx` — gate on `canUseCloudSync && signedIn`
- `web/src/lib/api/useTier.ts` — keep `useFeatureAccess` aligned with spec
- New tests under `web/src/lib/**` importing the above

## Do NOT modify unless necessary

`convex/_generated/*`, `convex/betterAuth/*`, `backend-archived/*` (dead), `design_tokens.json`
(unless implementing the approved palette), generated/lockfiles.

## Architecture constraints

- Local-first data: UI → `useOfflineQuery`/`useOfflineMutation` only (ESLint-enforced). No direct Convex hooks for local-first data.
- Sync worker is the only code that talks to Convex for personal data, and only when paid + signed in.
- All business/sync/entitlement logic is **pure** and lives in `design-system/domain/*` (shared by web, mobile, Convex). Platform packages hold UI + adapters only.
- Per-field LWW; idempotent offline-replayable mutations only; `userId = identity.subject`.

## Coding conventions

- TypeScript strict; no `any`. Validate Convex args + returns. Use indexes, not `filter()`. Paginate large lists.
- One concept = one name everywhere (**Elements**, not item/closet/node).
- Components follow [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) §3 (no one-off buttons/cards; tokens only).
- Run `prettier` on touched files; `make validate` before declaring done.

## Hard rules

- **Do not change tests just to make them pass.** Fix the code. If a test seems to contradict the approved spec, stop and flag it — do not silently rewrite it.
- **Do not weaken the spec** or invent features not in `PRODUCT_SPEC.md`.
- **Do not skip failing tests.** Implement only what the spec requires; keep changes small and reviewable.
- Preserve existing valid behavior; remove/refactor invalid behavior only when the spec requires it.
- Run the phase's tests after each step; commit per verified slice.
- Update docs only when an implementation change affects them (and keep edits in the owning doc).

## After each step

1. Run the phase's tests (`npm test -w web`, `npx tsc --noEmit -p convex/tsconfig.json`, typechecks).
2. `make validate`.
3. Commit the slice with a clear, human-style message (no AI attribution; no `cursor/` branches).
