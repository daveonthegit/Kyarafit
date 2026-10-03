# AI Context — read me first

Compact, high-signal context for AI coding agents. Load this before anything else.

## What the app is

**Kyarafit** — mobile-first (also web) cosplay wardrobe + convention-planning app. Catalog
**elements** → group into per-character **builds** → track progress (photos + updates) → plan
**conventions** + **packing** → finish via the **planner**. A comprehensive **social** layer
(online-only) for sharing/collaboration.

## Current goal

Continue the implemented local-first app and Glass Studio rollout through focused, validated
changes. Preserve working behavior; distinguish accepted requirements from shipped enforcement.
This is not a greenfield restart or permission to delete populated schema definitions.

## Source-of-truth docs (in `docs/`)

| Doc                                          | Owns                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `PRODUCT_SPEC.md`                            | product behavior, modules, REQ IDs, freemium, acceptance criteria |
| `DATA_AND_SYNC.md`                           | data model, local-first, sync, conflict, migration, quotas        |
| `ARCHITECTURE.md`                            | structure, shared logic, boundaries, conventions                  |
| `DESIGN_SYSTEM.md`                           | UI principles, IA/nav, components, states, a11y, parity           |
| `TESTING.md` + `specs/refactor-test-plan.md` | how/what to test (REQ→tests)                                      |
| `ROADMAP.md`                                 | phased implementation order                                       |
| `ai/IMPLEMENTATION_HANDOFF.md`               | the Composer handoff prompt                                       |
| `redesign/` (README → 01–05 + tokens.css)    | the approved "Glass Studio" v2 visual language + per-screen specs |
| `../CONTEXT.md` (repo root)                  | ubiquitous domain language (grown lazily; see `agents/domain.md`) |

## Key decisions (constraints)

- Tiers — **implemented today:** FREE + PRO + SUPPORTER (Pro==Supporter), paid 2 GB cloud cap,
  group-cosplay exception. **Accepted, unbuilt direction (GH #147/#148,
  ADR-0001/0003, `CONTEXT.md`):**
  collapse to **free + supporter**, free groups/posting/public-share, **hosted-media cap**
  free 100 MB / supporter 5 GB on R2 capability URLs, free-tier **BYO sync** via Google Drive
  snapshots. Until those items land, gate paid by `isPaid`, never a tier.
- **Local-first personal data:** use `useOfflineQuery`/`useOfflineMutation`; managed-sync workers
  are gated by `canUseCloudSync && signedIn`. This does not prohibit online-only social,
  account, group, or public-read calls available to free users.
- Free images = local/external URL only (no cloud upload) except group-cosplay exception (REQ-021) — the exception is removed by `entitlements-two-tier` when it lands.
- Conflict: **per-field last-write-wins** by `updatedAt`/`fieldUpdatedAt`. No CRDT.
- **Elements** = one canonical model (replaces `closetItems`+`cosplayNodes`), **build-scoped** (no Closet page), hierarchy + duplicate-to-build.
- Workflow UX uses `workflowItems`; legacy schema definitions such as `buildTasks` remain for
  deployment compatibility. Product elements still persist as `cosplayNodes`; do not assume an
  `elements` Convex table exists. See `ARCHITECTURE.md`.
- **Progress updates** are implemented; publishing is an explicit `publish` input. Current paid
  publishing gates differ from the accepted free-posting direction.
- Background-removal service code is dropped. External infrastructure retirement and live
  migration state are not established by repository deletions.
- Full web/mobile parity; shared logic in `design-system/`.

## Current phase

**Glass Studio redesign rollout.** Web phases 0–6 are implemented (branch
`feat/glass-studio-phase-0`); the mobile parity pass (phase 7) is underway — 7.0 primitives, 7.1
shell, 7.2 core studio screens + auth/landing, 7.3 events, and 7.4 social are done; 7.5 settings
and the build-detail feedback round remain (`redesign/HANDOFF.md` has the live status).
Specs: `redesign/README.md` → `redesign/AGENT_PROMPT_MOBILE.md`. Earlier foundation helpers
(sync gating, legacy entitlements/storage policy, field-LWW) exist; they do not implement the new
two-tier/R2/BYO program. See `ROADMAP.md` for status and history.

Agentflow is deprecated. `WORK.md` is a historical generated board, not current execution
authority. Use the current assigned brief and its file-ownership boundaries; do not invoke
Agentflow or edit `.agentflow/` / `WORK.md`. Accepted backlog includes two-tier entitlements,
R2 hosted media (GH #147/#148), and BYO sync (ADR-0003). Current authorization documentation is
`backend-authorization.md`; remediation is ongoing, and passing tests do not certify deployment.

## Commands

```bash
npm ci
npx convex dev                 # authorized development deployment only
npm run dev:web                # web @ :3000
npm run start -w mobile        # Expo
npm test -w web                # vitest (web + shared domain)
npx tsc --noEmit -p convex/tsconfig.json
npm run validate               # aggregate gate; also run web/mobile tests explicitly
npm test -w mobile
```

## Testing expectations

TDD: write/confirm `REQ-*` tests (red) → implement → green. Never weaken a test to pass. Pure logic
lives in `design-system/domain/*` and is tested via web vitest.

## Inspect first

`design-system/domain/`, `mobile/src/offline/`, `convex/schema.ts`, `convex/sync.ts`,
`convex/lib/idempotency.ts`, `web/src/lib/api/useTier.ts`, `web/src/lib/offline/*.test.ts`.

## Don't modify casually

`convex/_generated/*`, `convex/betterAuth/*`, generated tokens.

## Common mistakes to avoid

- Adding direct Convex `useQuery`/`useMutation` for local-first data (use the offline bridge).
- Running the sync worker for free users (must be gated).
- Whole-document writes that clobber other devices' field edits (use field-LWW).
- Enqueuing a non-idempotent mutation for offline replay.
- Reintroducing `closetItems`/`buildTasks` or a standalone Closet page.

## Open questions

OQ-3 broader moderation depth remains open beyond the accepted hosted-media takedown minimum.
The question list in `PRODUCT_SPEC.md` §9 is historical: OQ-4's group exception is superseded by
GH #147; OQ-5 uses explicit publishing today (do not invent auto-posting). OQ-1 visual direction
is settled by Glass Studio (`redesign/`); OQ-2 navigation is settled by
`design-system/navConfig.ts`. Requirement amendments belong to their implementation packages.
