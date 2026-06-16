# Session Handoff — `feat/local-first-and-tiers`

_Created 2026-06-15. Read [CURRENT_PLAN.md](CURRENT_PLAN.md) first (canonical snapshot), then this
for session-specific state and the immediate next step._

## TL;DR of what landed this session

1. **Monetization refactor (code complete).** Collapsed PRO/STUDIO → one paid level. Tiers are now
   **FREE + PRO + SUPPORTER** (Supporter = identical features to Pro, pay-what-you-want via preset
   price points). Build/convention limits removed. **All export is free; cloud sync is the only paid
   lever.** Gate paid features with `isPaidTier`/`isPaid`. Premium cloud cap = 2 GB.
   Sources: `design-system/domain/{subscriptionTierPolicy,entitlements,subscriptionPlans}.ts`.
2. **Local-first mobile slices (additive, non-regressing).**
   - `useOfflineQuery` — SWR over SQLite `query_cache` (`mobile/src/offline/useOfflineQuery.ts`).
   - `useOfflineMutation` + sync worker — online passthrough / offline enqueue / FIFO drain on
     reconnect, connectivity-guarded (`mobile/src/offline/{useOfflineMutation,syncWorker,mutationQueue,connectivity}.ts`).
   - Shared pure logic + tests in `design-system/domain/offline*.ts` and `web/src/lib/offline/*.test.ts`.
3. **CODEX review fixes applied** (offline drain never burns retries while offline; `generateUploadUrl`
   stays online-only; SQLite maintenance fail-closed; mobile subscription recognizes Supporter as paid;
   `getSubscriptionPlanByTier` normalizes input). Removed the legacy `tier:studio` schema literal
   (no subscribers/data exist).
4. **Docs refreshed:** `CURRENT_PLAN.md` (new), `README.md`, `docs/implementation/README.md`.

## Immediate next step (highest priority)

**Server idempotency** — make offline mutation replay dedupe-safe. The write path is at-least-once
today; a lost-response retry can duplicate a create. Plan:

- Add a shared `withIdempotency` helper in Convex using the existing `idempotencyLedger` table.
- Wire it into the core offline-capable mutations (builds/closet/cosplayNodes/buildTasks/conventions create+update).
- Have the sync worker pass the queued `idempotency_key` (already stored on each `mutation_queue` row).

After that, in order: `clientId`/`id_map` for offline-created ids → optimistic visibility
(`entity_rows` read-through) → free-local-only gating → web OPFS port → images → export/import →
upgrade/downgrade. Full detail: [docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md](docs/implementation/LOCAL_FIRST_FREEMIUM_PLAN.md).

## Verify (all green as of this session)

```bash
npm run typecheck -w design-system && npm run typecheck:web && npm run typecheck:mobile
npm test -w web            # 96 passing (incl. 16 offline)
npm run lint:mobile        # 0 errors (4 pre-existing warnings)
npm run i18n:check
```

## Caveats for whoever picks this up

- **The commit on this branch bundles more than this session's work.** The working tree also carried
  **pre-existing uncommitted** design/settings/editorial edits (web pages, ElementPortfolioCard,
  PageHeader, ThemeContext, planner UI, i18n, etc.) that were modified before the session. They
  compile and pass tests but were not authored or reviewed here.
- **Not authored this session:** `docs/implementation/AUTH_OPTIMIZATION_DEFERRED.md` appeared mid-session
  from another source — review before relying on it.
- **External config still needed:** Supporter preset products must be created in RevenueCat + App
  Store/Play before they're purchasable (buttons show "Not configured" until then).
- **`Needs verification`:** deploy automation target (Fly vs GCP vs Vercel); canonical task system
  (`buildTasks` vs `workflowItems`); group-create paid gate is decided but not yet enforced in code.
