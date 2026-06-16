# Session Handoff — `feat/local-first-and-tiers`

_Updated 2026-06-15. Read [CURRENT_PLAN.md](CURRENT_PLAN.md) first (canonical snapshot), then this
for session-specific state and the immediate next step._

## What's landed on this branch

1. **Monetization refactor (code complete).** Tiers are now **FREE + PRO + SUPPORTER** (Supporter =
   identical features to Pro, pay-what-you-want via preset price points). Build/convention limits
   removed. **All export is free; cloud sync is the only paid lever.** Gate paid features with
   `isPaidTier`/`isPaid`. Premium cloud cap = 2 GB. Sources:
   `design-system/domain/{subscriptionTierPolicy,entitlements,subscriptionPlans}.ts`.
2. **Local-first mobile foundation — Phase 1 complete (additive, non-regressing).**
   - `useOfflineQuery` — SWR over SQLite `query_cache`, **+ `entity_rows` optimistic overlay and a
     synced-local-store read-through fallback** (builds + conventions).
   - `useOfflineMutation` + sync worker — online passthrough / offline enqueue / FIFO drain on
     reconnect, connectivity-guarded; offline creates mint a `clientId` and write optimistic
     overlays; the worker maps ids, rewrites dependent ops, clears overlays, and runs the
     `listChangedSince` warm-up (`mobile/src/offline/`).
   - Shared pure logic + tests in `design-system/domain/offline*.ts`, `web/src/lib/offline/*.test.ts`
     (115 web tests).
3. **Server idempotency for offline replay (complete).** `convex/lib/idempotency.ts` +
   `idempotencyLedger` (pruned daily by `convex/idempotencyLedger.ts` cron). The sync worker injects
   the queued key for mutations registered in `mobile/src/offline/idempotentMutations.ts`.
   **Covered:** builds (`create`, `update`, `updateStatusMany`, `duplicate`, `addNodesToBuild`),
   conventions (`create`, `update`, `archiveMany`, `replacePlan`, `addManualPackingItem`), workflow
   (`create`, `update`, `move`, `moveAndResequence`), `users.setFocusedBuild`.
4. **buildTasks investigated (not pruned).** `api.buildTasks.*` is already a **workflowItems shim**;
   the table is vestigial (empty on prod). Pruning **deferred** by choice — see CURRENT_PLAN gap entry
   for the staged-removal recipe.
5. **CODEX review fixes applied** earlier (offline drain never burns retries while offline;
   `generateUploadUrl` stays online-only; SQLite maintenance fail-closed; mobile subscription
   recognizes Supporter as paid; `getSubscriptionPlanByTier` normalizes input).
6. **Docs:** `CURRENT_PLAN.md`, `README.md`, `docs/implementation/README.md` refreshed.

Recent commits: `4ad4c23` (sync warm-up) · `301ebc8` (optimistic visibility) · `5e9c6f1`
(clientId/id_map) · `6830b28` (workflow + setFocusedBuild idem) · `e900cf0` (handoff) ·
`abab72a` (docs buildTasks) · `dc1c6a8` (conventions idem) · `9971a65` (builds idem) ·
`546874b` (ledger cron) · `053a280` (builds/conventions create idem) · `1854dff` (tier + offline foundation).

## Phase 1 (mobile local-first) — complete as of 2026-06-16

All four Phase 1 follow-up slices landed (read-path + write-path were already done):

1. **Idempotency coverage finished** — `workflow.{create,update,move,moveAndResequence}` +
   `users.setFocusedBuild` (keyed on `identity.subject`, not `args.userId`). Registered in
   `mobile/src/offline/idempotentMutations.ts`.
2. **`clientId`/`id_map`** — offline creates mint a `local:` client id + optimistic stub; the worker
   records `clientId → serverId` and rewrites later queued ops. `mutation_queue` v2 `client_id` col.
3. **Optimistic visibility** — `entity_rows` overlay in `useOfflineQuery` for **builds + conventions**
   (plain-doc lists + convention detail), reactive via `entityOverlayStore`.
4. **`sync.listChangedSince` + warm-up** — `warmEntityRows` seeds synced `entity_rows`;
   `useOfflineQuery` reads through to them when offline with no live/cached result.

### Immediate next step — close the Phase 1 task-visibility gap, then Phase 2

- **Deferred from Phase 1 (highest priority):** offline **task** writes are queue-correct but **not
  optimistically visible** because the planner/build-tree queries (`workflow:listPlanner`,
  `listBuildTree`) return derived/projected shapes, not plain docs. Overlaying raw docs there would
  be wrong — it needs on-device re-derivation of those projections. Same for enriched `builds:get`.
- **Edit deltas:** `listChangedSince` captures creates incrementally + full state at `since=0`;
  field-level edits need a maintained `updatedAt`/`version` (scaffolding exists, not bumped on write).
- **Then Phase 2:** entitlement-gate the sync worker (`drainMutationQueue` **and** `warmEntityRows`)
  on `canUseCloudSync`; verify free users make zero Convex data calls; gate group-create to paid.

**Idempotency — N/A / intentionally skipped:** `buildTasks` (web-only workflow shim, never
offline-enqueued); `closetItems`/`cosplayNodes` create (not enqueued via the offline bridge — only
`cosplayNodes.removeMany` is, and deletes are naturally idempotent); `conventions.updatePackingItem`
(naturally-idempotent `checked` toggle, multi-return — skipped to avoid risk for no benefit).

### How to wrap a mutation (the established idempotency pattern)

1. Add `idempotencyKey: v.optional(v.string())` to the mutation's `args`.
2. Wrap the handler using `convex/lib/idempotency.ts`:
   - **Simple, single trailing `return`** → `runIdempotent(ctx, args.idempotencyKey, userId, async () => { ...body... })`.
   - **`...fields` / large / void / multi-return** → top-guard: `const replay = await idempotentReplay(ctx, key); if (replay.hit) return replay.result as <T>;` … then at the **single** trailing return `return idempotentRecord(ctx, key, userId, <result>);` (record must run at most once per call).
   - For `...fields` handlers, **destructure `idempotencyKey` out** so it doesn't leak into the patch loop: `const { id, userId, idempotencyKey, ...fields } = args;`.
3. Register the Convex function name in `mobile/src/offline/idempotentMutations.ts` (e.g.
   `"workflow:create"`). The worker only injects the key for registered names, so an unregistered
   mutation never receives an arg its validator rejects.

Remaining roadmap: task-visibility gap (above) → Phase 2 free-local-only gating → Phase 3 images →
Phase 4 web OPFS port (largest) → export/import → upgrade/downgrade. Full detail:
[docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md](docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md).

## Verify (all green as of this session)

```bash
npx tsc --noEmit -p convex/tsconfig.json     # Convex backend — NOT covered by the npm scripts
npm run typecheck -w design-system && npm run typecheck:web && npm run typecheck:mobile
npm test -w web            # 115 passing (incl. offline query/mutation/idMap/overlay)
npm run lint:mobile        # 0 errors (4 pre-existing warnings)
npm run i18n:check
```

## Workflow notes

- **Commit + push per verified slice** (the chosen cadence). Each slice: edit → verify (above) →
  `prettier --write` touched files → commit → `git push`.
- **Convex codegen:** `npx convex codegen` regenerates `convex/_generated` **and pushes to the dev
  deployment** (normal dev flow). Needed when you add a **new internal-function reference** (e.g. a
  cron). Plain arg additions to existing mutations don't need it to compile, but run it to keep
  `_generated` in sync and commit the result.

## Caveats

- **The branch bundles pre-existing uncommitted work** (design/settings/editorial edits — web pages,
  ElementPortfolioCard, PageHeader, ThemeContext, planner UI, i18n) that predated this work; not
  authored/reviewed here. `docs/implementation/AUTH_OPTIMIZATION_DEFERRED.md` also appeared from
  another source — review before relying on it.
- **External config still needed:** Supporter preset products must be created in RevenueCat + App
  Store/Play before purchasable (buttons show "Not configured" until then).
- **`Needs verification`:** deploy automation target (Fly vs GCP vs Vercel); group-create paid gate is
  decided but not yet enforced in code.
