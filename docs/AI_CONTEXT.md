# AI Context — read me first

Compact, high-signal context for AI coding agents. Load this before anything else.

## What the app is

**Kyarafit** — mobile-first (also web) cosplay wardrobe + convention-planning app. Catalog
**elements** → group into per-character **builds** → track progress (photos + updates) → plan
**conventions** + **packing** → finish via the **planner**. A comprehensive **social** layer
(online-only) for sharing/collaboration.

## Current goal

Spec-driven **full-app refactor restart**. The spec is the source of truth; existing code is
**reference only** — rewrite/delete what conflicts.

## Source-of-truth docs (in `docs/`)

| Doc                                          | Owns                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `PRODUCT_SPEC.md`                            | product behavior, modules, REQ IDs, freemium, acceptance criteria |
| `DATA_AND_SYNC.md`                           | data model, local-first, sync, conflict, migration, quotas        |
| `architecture.md`                            | structure, shared logic, boundaries, conventions                  |
| `DESIGN_SYSTEM.md`                           | UI principles, IA/nav, components, states, a11y, parity           |
| `TESTING.md` + `specs/refactor-test-plan.md` | how/what to test (REQ→tests)                                      |
| `roadmap.md`                                 | phased implementation order                                       |
| `ai/IMPLEMENTATION_HANDOFF.md`               | the Composer handoff prompt                                       |
| `redesign/` (README → 01–05 + tokens.css)    | the approved "Glass Studio" v2 visual language + per-screen specs |
| `../CONTEXT.md` (repo root)                  | ubiquitous domain language (grown lazily; see `agents/domain.md`) |

## Key decisions (constraints)

- Tiers — **implemented today:** FREE + PRO + SUPPORTER (Pro==Supporter), paid 2 GB cloud cap,
  group-cosplay exception. **Decided direction (framed in the Work Graph — `WORK.md`
  `entitlements-two-tier` → `r2-media-pipeline`, GH #147/#148, ADR-0001/0003, `CONTEXT.md`):**
  collapse to **free + supporter**, free groups/posting/public-share, **hosted-media cap**
  free 100 MB / supporter 5 GB on R2 capability URLs, free-tier **BYO sync** via Google Drive
  snapshots. Until those items land, gate paid by `isPaid`, never a tier.
- **Local-first:** local store authoritative; UI uses `useOfflineQuery`/`useOfflineMutation` only; sync worker runs **iff `canUseCloudSync && signedIn`** (free → never). Free users make **zero Convex data calls**.
- Free images = local/external URL only (no cloud upload) except group-cosplay exception (REQ-021) — the exception is removed by `entitlements-two-tier` when it lands.
- Conflict: **per-field last-write-wins** by `updatedAt`/`fieldUpdatedAt`. No CRDT.
- **Elements** = one canonical model (replaces `closetItems`+`cosplayNodes`), **build-scoped** (no Closet page), hierarchy + duplicate-to-build.
- Tasks = `workflowItems` only (delete `buildTasks`); rich model kept, **UX simplified**.
- New: **progress updates** (dated build timeline, paid can publish to feed); richer reference/process photos.
- Greenfield migration (no heavy prod data migration). Background-removal service dropped.
- Full web/mobile parity; shared logic in `design-system/`.

## Current phase

**Glass Studio redesign rollout.** Web phases 0–6 are implemented (branch
`feat/glass-studio-phase-0`); the mobile parity pass (phase 7) is underway — 7.0 primitives, 7.1
shell, 7.2 core studio screens + auth/landing, 7.3 events, and 7.4 social are done; 7.5 settings
and the build-detail feedback round remain (`redesign/HANDOFF.md` has the live status).
Specs: `redesign/README.md` → `redesign/AGENT_PROMPT_MOBILE.md`. Earlier foundation phases
(sync gating, entitlements, storage policy, field-LWW) are complete; see `roadmap.md` for history.

**Open work is tracked on the Work Graph** — consult `WORK.md` (generated board) before starting
anything, and follow the Agentflow conventions in `AGENTS.md` (Work-Item commit trailers, proposals
inbox). The framed backlog beyond Glass Studio: the two-tier entitlements collapse + R2 hosted-media
pipeline (GH #147/#148) and the BYO-sync program (ADR-0003).

## Commands

```bash
npm install
npx convex dev                 # backend
npm run dev:web                # web @ :3000
npm run start -w mobile        # Expo
npm test -w web                # vitest (web + shared domain)
npx tsc --noEmit -p convex/tsconfig.json
make validate                  # full local CI (run before done)
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

OQ-3 moderation depth, OQ-4 group-exception limits, OQ-5 progress-update publish trigger. See
`PRODUCT_SPEC.md` §9. **Resolved:** OQ-1 visual direction → the "Glass Studio" language
(`redesign/`); OQ-2 nav/IA → `design-system/navConfig.ts` is the single source of truth (mobile
bottom tabs: Home · Builds · Elements · Planner · Menu; web glass top bar).
