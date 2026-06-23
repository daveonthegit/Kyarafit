# Refactor Roadmap

_Execution order for the spec-driven refactor. Behavior → [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md);
data/sync → [`DATA_AND_SYNC.md`](DATA_AND_SYNC.md). Each phase is independently shippable and
test-gated. Spec wins over existing code (rewrite/delete what conflicts)._

---

## Principles

- **Tests first.** Write/confirm the phase's `REQ-*` tests (red), then implement to green.
- **Small, reviewable PRs.** One concern each; commit per verified slice; run `make validate`.
- **No drift.** Land web + mobile parity within the same phase (shared logic first).
- **Never weaken a test or the spec to pass.**

## Delete / preserve / build

| Action        | Items                                                                                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Delete**    | `closetItems`, `buildTasks` (table+shim+fields+indexes), `cosplayNodeLinks`, `buildCosplayLinks`, `buildNodeStates`, `buildItemLinks`, background-removal `image-service`, archived Go backend, superseded docs (see [`specs/doc-consolidation-plan.md`](specs/doc-consolidation-plan.md)) |
| **Preserve**  | Auth, builds, conventions/day-plans/packing, `workflowItems` planner, RevenueCat billing, image upload (paid)                                                                                                                                                                              |
| **Build new** | `elements` model, `buildProgressUpdates`, `syncPolicy`, `cloudStoragePolicy`, `offlineConflict` (field LWW), web local store, export/import, tier-transition flows, social posting gates                                                                                                   |

---

## Phase 0 — Foundations & invariants (highest leverage, smallest)

**Goal:** make the core freemium/local-first invariants true and tested.

- `design-system/domain/syncPolicy.ts` → `shouldRunSyncWorker(tier, signedIn)`; gate `SyncWorkerProvider` (REQ-D60).
- `entitlements.ts`: advanced planner **free**; confirm sync/publish/social/group paid (REQ-013/15/17/18/19).
- `cloudStoragePolicy.ts`: free cap 0 / paid 2048; over-cap blocks uploads only (REQ-D90).
- `offlineConflict.ts`: `mergeFieldLWW` (REQ-D65/66).
- Free-user zero-Convex-data-call assertion (REQ-D10).
- **DoD:** AC-01, AC-02, AC-04, AC-05, AC-10 green; sync gating + conflict + storage unit tests pass.

## Phase 1 — Data model migration (greenfield)

- Introduce `elements` (build-scoped tree, REQ-040/41/42); migrate/discard `cosplayNodes`/`closetItems` (REQ-D80/81).
- Remove `buildTasks` + cross-refs; `workflowItems` only.
- Add `buildProgressUpdates`; rename process pictures table if desired.
- Add/maintain sync metadata (`updatedAt`, `fieldUpdatedAt`, `version`, `clientId`, `deletedAt`) on writes (REQ-D40).
- **DoD:** schema compiles; element CRUD build-scoped; progress timeline persists; per-field timestamps bumped on write.

## Phase 2 — Elements & build-detail UX

- Build-scoped element management (no Closet page); duplicate-to-build; sub-elements.
- Build detail: reference images, process photos, **progress updates** timeline (REQ-047/48/49).
- Progressive-disclosure **planner** redesign (REQ-063).
- **DoD:** AC-07, AC-09 green; planner advanced fields hidden by default.

## Phase 3 — Sync correctness & warm-up completion

- Extend idempotency to all offline-enqueued mutations (REQ-D62).
- `sync.listChangedSince` covers all local-first tables + field-edit deltas (REQ-D63).
- Sync-status UX suite: banner, pending badge, last-synced, manual sync, surfaced errors (REQ-D64).
- **DoD:** AC-03 green; backend sync tests pass.

## Phase 4 — Local images

- `ImageRef` union + resolver; local image store (mobile first); paid upload as sync step (REQ-D70/71/72).
- **DoD:** free user adds photos offline forever; paid uploads on sync.

## Phase 5 — Web local-first

- Web `LocalStore` (OPFS+wa-sqlite / Dexie fallback); web `useOfflineQuery`/`useOfflineMutation`; ESLint guard; migrate web pages off direct Convex for local-first data.
- **DoD:** free web user does full CRUD + images with Convex data layer blocked; persists across reload; web/mobile parity.

## Phase 6 — Export / import

- CSV + JSON-ZIP (fflate) + PDF; idempotent import; round-trip fidelity (REQ-D100/101/102).
- **DoD:** AC export/import; device A → B round-trip; re-import no dupes.

## Phase 7 — Social, groups & group-cloud exception

- Online-only social (feed/discover/follow/like/comment/profiles) with offline banners; paid posting gates (REQ-018).
- Groups: paid create / free join; group-cosplay build cloud exception with guards (REQ-021).
- **DoD:** AC-06 green; free interactions work online; posting gated.

## Phase 8 — Tier transitions & hardening

- Upgrade backfill (dedupe across devices, progress UI) (REQ-D95).
- Downgrade: stop sync, 14-day grace, freeze, ~3-month retention cron, never delete local (REQ-D96/97).
- E2E: offline CRUD round-trip, export/import, upgrade/downgrade. Perf budgets (P1–P5). a11y/i18n parity.
- **DoD:** AC-08 green; downgrade never loses data; perf + a11y gates pass.

## Phase 9 — Visual design (parallelizable after sign-off)

- Resolve OQ-1/OQ-2: produce 2–3 visual directions + palette + final IA → sign-off → apply via the component spec.

---

## Dependencies

Phase 0 → everything. Phase 1 → 2,3,4. Phase 5 depends on 0/3 (shared bridge). 6/7 depend on 1.
8 depends on 3/5. 9 can start after Phase 0 in parallel.

## Risk areas

- **Per-field LWW** adds write-time bookkeeping (`fieldUpdatedAt`) across all mutations — touch every write path. Mitigate with a shared write helper.
- **Web local store (OPFS+wa-sqlite)** is the largest/riskiest slice — Dexie fallback behind the interface.
- **Group-cloud exception** abuse surface — keep guards server-enforced, not client-trusted.
- **Sync worker concurrency** — keep single-flight + connectivity guards; cover with tests before refactor.
