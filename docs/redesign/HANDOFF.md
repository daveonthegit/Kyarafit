# Glass Studio phase 7 — session handoff (updated 2026-07-22)

State snapshot so work can resume on any machine/agent. Branch: `feat/glass-studio-phase-0`
(local only, never pushed). Working tree at handoff: clean except the owner's own web WIP
(image moves + landing/component polish) — do not commit that for them.

## Where the program stands

| Sub-phase | State | Commit(s) |
| --- | --- | --- |
| 7.0 primitives + dev gallery | done | `b00f405` |
| 7.1 shell (tab bar, drawer, create pill, headers, sheets) | done + device-checked | `16d6a86`, fixes `369f11e`/`959645a` |
| 7.2 core studio screens + owner fix round | done + device-checked | `1dbb9ed`, `6f3e33c`, `9eefd30`, `17f001a`, `dea6131`, `2ca46c1` |
| Auth screens + signed-out welcome (pulled from 7.5) | done | `67ddea7` |
| 7.3 events (`Work-Item: proposal-2c3ea118f0064504`) | **built, awaiting owner device check** | `abcefc2` |
| 7.4 social (`Work-Item: proposal-111d88faffec7e55`) | **built, awaiting owner device check** | `8c7930b` |
| 7.5 settings (`proposal-d7053f3f9cc03ee8`) | **not started** — two agents were launched then stopped before any edits; nothing to salvage | — |
| Build-detail polish (`proposal-c85bca8167053900`) | blocked on the owner walkthrough ("we'll go over that later") | — |

Work Graph: approved at hash `b3a50d76` by David Xiao (see `WORK.md` + `.agentflow/approvals.jsonl`);
the graph store `.agentflow/work/graph.jsonl` is LOCAL by design (guard hook refuses committing it) —
on a fresh clone, re-ingest is not needed for the four accepted items IF the local store is synced
manually; otherwise treat `WORK.md` as the readable source and re-frame if the store is missing.
Landed items still need human disposition (completion claims via `.agentflow/proposals/` +
`agentflow work reconcile` / `reconcile-apply --confirmed-by`).

## How to resume 7.5 (settings)

Split into two agents on disjoint files, both instructed to read
`docs/redesign/GLASS_MOBILE_BRIEF.md` first (the committed agent brief — guardrails, primitives,
QA floors, device-verified pitfalls, report format):

1. **index + small screens**: `settings/index.tsx` (11a anatomy 1:1 — eyebrow/serif headline,
   Backup & storage line + gating, Appearance + Language segmented controls, menu rows, legal
   links, danger Sign out keeping the confirm dialog + REQ-031 free-tier export warning),
   `notifications.tsx`, `offline.tsx` (SyncStatusSection stays as placed — ADR-0002; do not edit
   it), `data.tsx` (keep every export/import flow; web `settings/data/page.tsx` is the grammar
   reference; Export is the one solid).
2. **account.tsx + subscription.tsx**: account keeps full anatomy (glass fields, avatar picker
   dashed-only-while-empty, visibility segmented, danger zone with restyled overlay-glass confirm
   dialogs); subscription renders plan cards with an OUTLINE "Current plan" badge (QA-3) and one
   solid upgrade pill; all RevenueCat/purchase/restore flows byte-identical.

Then: merge reported i18n keys into en+ja+es (`mobile/src/i18n/locales/*` — agents must not edit
them), run gates (`npm run typecheck:mobile`, `lint:mobile`, `npm -w mobile run test`,
`npm run i18n:check`), QA-grep the diff (no `fontSize: 0-8`, no hex literals, no
`style={({`), commit with trailer `Work-Item: proposal-d7053f3f9cc03ee8`.

## Owner queue (needs the human)

- Device-check 7.3 (events) and 7.4 (social) — JS reload is enough; the dev client from 7.0
  already has expo-blur.
- Build-detail walkthrough (opens `proposal-c85bca8167053900`).
- Disposition landed items on the graph (reconcile), and re-approve if the graph changes.
- Owner design precedents recorded so far: no omnipresent status chips (ADR-0002); the content
  primary stays a SOLID pill even alongside the create FAB (Builds device check — 7.3 followed it).

## Known small debts (flagged in commit messages)

- `ConventionEventPoster` is unconsumed after 7.3 — delete in a cleanup pass.
- No mono font is loaded on mobile (needed only if packing PK codes ship).
- Discover keeps its pre-existing degenerate loading state (`builds ?? []` → status always ready).
- Public build viewer intentionally omits creator row/Follow/share — the public payload carries no
  owner identity (privacy design); adding it is backend work, not restyle.
- Simulator screenshots for the phase-7 PRs were never taken (needs an owner-side dev-client run).

## Verification stack (memorize)

`npm run typecheck` (root: web+mobile) · `npm run lint:mobile` (0 errors; ~2 pre-existing warnings
in untouched files OK) · `npm -w mobile run test` (34 tests; vitest stubs for native packages live
in `mobile/src/test-support/`, aliased in `mobile/src/offline/vitest.config.ts`) ·
`npm run i18n:check` (en ↔ ja ↔ es parity).
