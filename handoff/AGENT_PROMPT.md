# AGENT_PROMPT — implement Kyarafit v2 "Glass Studio" in the real codebase

This file is a ready-to-run operating prompt for a coding agent (Claude Code etc.) working inside the Kyarafit monorepo. Two steps for the human:

1. **Copy the design package into the repo** so the agent can read everything locally:
   - this whole `handoff/` folder → `docs/redesign/`
   - `explorations/Kyarafit Prototype.dc.html` and `explorations/Kyarafit Redesign.dc.html` → `docs/redesign/reference/` (they are single-file HTML; the agent reads the inline styles for exact values — it does not need to render them)
   - `assets/photos/` is NOT needed — those are placeholder cosplay shots; the app uses real user imagery via `ResolvedImage`.
2. **Paste the prompt below** into the agent, working from the repo root. Run one phase per session/PR.

---

## PROMPT (copy from here)

You are implementing the approved "Glass Studio" v2 redesign of Kyarafit. The complete, binding spec lives in `docs/redesign/` — read it in this order before writing any code:

1. `README.md` — concept + ground rules
2. `01-foundations.md` — tokens kept / added / retired
3. `02-surface-rules.md` — the 16 laws of the language
4. `05-qa-addendum.md` — QA lint rules; **wins over anything that contradicts it**
5. `03-component-changes.md` — file-by-file change list (your work queue)
6. `04-screens.md` — per-screen specs
7. `docs/redesign/reference/Kyarafit Prototype.dc.html` — the pixel source of truth. Every screen is a `<div data-screen="…" data-plat="desktop|mobile">` block with fully inline styles. When a spec says "glass panel" or "eyebrow", grep this file for the screen and lift the EXACT values (colors, sizes, tracking, paddings). Do not invent values.

Also honor the repo's own conventions: `CLAUDE.md`, `AGENTS.md`, `rules/frontend-patterns.mdc`, `rules/mobile-parity.mdc`, `rules/testing-patterns.mdc`, `docs/DESIGN_SYSTEM.md`.

### Non-negotiable guardrails

- **Restyle, never reimplement.** Every component named in `03-component-changes.md` keeps its logic, props, queries, mutations, gating, a11y wiring, and tests. Presentation only — the explorer drag stack (`useExplorerDrag`, `useLongPressDrag`, `BuildExplorerRow` drop zones) is explicitly correct as-is.
- **Tokens first.** Phase 0 lands `docs/redesign/tokens.css` into `web/src/app/globals.css` (`:root`, non-theme-flipping) and mirrors it as a `glass` block in `design-system/design_tokens.json` + `rn_tokens.ts`. All later work consumes tokens — no hardcoded glass values in components.
- **QA lint rules** (from `05-qa-addendum.md`) apply to every line you write: no text under 9px; uppercase tracking ≥0.14em; exactly one solid-`#fffdf8` primary per view; `-strong` scrim on high-key photos / panelled screens; list content sentence-case, never uppercase; dashed border = add-only; ≥44px tap targets; three glass weights only (0.08/18 · 0.10/24 · 0.14/30); no emoji.
- **Keep working**: offline/local-first UX (SyncStatus, PendingBadge, OnlineOnlyBanner), i18n (all new strings through next-intl keys, en/ja/es), focus rings, reduced-motion, `@supports not (backdrop-filter…)` fallbacks, WCAG AA.
- Run the repo's checks (`make`/`scripts/ci-local.sh`, vitest, playwright where touched) before declaring a phase done.

### Phases (one PR each, in order)

- **Phase 0 — tokens + primitives.** globals.css glass tier; `design_tokens.json`/`rn_tokens.ts` glass block; new `PhotoPill`, `PhotoBackdrop`, `EmptyState surface="glass"`, glass `ControlPill` variant. No screen changes yet.
- **Phase 1 — shell.** `WebSidebar` → `GlassTopBar`; `BottomNav` restyle (44px cells, top-notch active); `GlobalFAB` per 03; `MobileNavMenu` glass drawer (ref 13e); `AdaptiveModal` → heavier-glass dialog (ref 13d).
- **Phase 2 — core studio screens.** Home, Builds, Build detail (+ explorers restyle, board, timeline), Planner, Elements/closet, Element detail sheet (refs 6a–6d, 3b, 4a/4b, 8b).
- **Phase 3 — events.** Events, Event detail, Packing (refs 6e, 8a).
- **Phase 4 — social.** Feed, Discover, Public build, Groups, Group detail (refs 12a–12d, 8c) + OnlineOnlyBanner glass strip.
- **Phase 5 — settings, auth, legal.** Settings + sub-pages + subscription, all four auth screens, terms/privacy (refs 11a–11c, 13a–13c).
- **Phase 6 — landing.** Per the `Landing Live.dc.html` section of 04 (scroll-driven; reduced-motion gated).
- **Phase 7 — mobile parity.** Mirror per `rules/mobile-parity.mdc` using expo-blur + the shared glass tokens; screens per 04 refs 7a–7e.

### Per-phase definition of done

1. Matches the prototype block for that screen (`data-screen` markup) to the pixel where feasible; where the app's real data shape differs, the spec's grammar wins over the mock data.
2. QA lint rules pass (grep your diff for `font-size: ?[0-8]px`, `letter-spacing: ?0\.1[0-3]?em`, `0.92)`, `dashed` on non-add elements, emoji).
3. No cream (`--kyar-*` background) surface newly rendered inside the product; no glass-on-glass nesting (rule 3).
4. Existing tests green; new/changed strings in en+ja+es; screenshots (desktop 1280×820, mobile 390×844) attached to the PR for the screens touched.

Work autonomously through the current phase; ask the owner only when the spec and the real data model genuinely conflict.

## (end of prompt)

---

### Notes for the human

- The prototype's five nav items + Feed/Groups/Settings top-bar layout is the approved IA; `navConfig.ts` order stays the source of truth if they disagree — flag, don't silently pick.
- Screens QA'd as already perfect (Planner, Elements, Discover, Element detail, Sign in, drawer, first-run empty, no-imagery fallback) should be built exactly as specced — no "improvements".
- Suggested review cadence: eyeball Phase 1 (shell) and Phase 2 (core screens) carefully; later phases mostly reuse their vocabulary.
