# Kyarafit v2 "Glass Studio" — Redesign Handoff

Instructions for an implementation agent migrating the existing Kyarafit codebase to the v2 design. **This is an evolution of the current code, not a rewrite** — every change below names the source file it modifies. The approved visual reference lives in the design project: the **consolidated prototype `explorations/Kyarafit Prototype.dc.html` is the post-QA pixel source of truth** for all routed screens (desktop + mobile); `explorations/Kyarafit Redesign.dc.html` turn 13 covers the last-mile states (auth variants 13a–13c, creation modal 13d, mobile drawer 13e, first-run empty 13f, no-imagery fallback 13g); earlier options **1b/3b/4a/4b/6a–6e/7a–7e** remain useful for detail not present in the prototype. A design-QA pass (July 2026) is folded into the prototype and codified in `05-qa-addendum.md`.

**To hand this to a coding agent: read `AGENT_PROMPT.md`.**

## The concept in one paragraph

The user's cosplay photography becomes the page itself; all chrome floats above it as frosted glass. Cream/ink editorial surfaces are gone from top-level screens — light text on photo + glass replaces them. Identity retained exactly: italic Bodoni Moda display, uppercase wide-tracked meta system, fixed dark scrims with fixed light foreground (`--kyar-media-fg`), ink-primary buttons (accent stays links/focus only), Material Symbols Outlined wght 300. The two chronic problems this fixes: card-inside-card nesting (now illegal — max ONE glass panel per screen region) and mismatched one-off components.

## Files in this package

| File | Contents |
|---|---|
| `AGENT_PROMPT.md` | **Start here to implement** — copy-paste operating prompt + phase plan for a coding agent in the Kyarafit repo |
| `01-foundations.md` | Tokens: what's kept, what's added (glass tier), what's removed |
| `02-surface-rules.md` | The laws of the language — panel budget, scrims, when glass is allowed |
| `03-component-changes.md` | File-by-file change list against `web/src/` and `design-system/` |
| `04-screens.md` | Per-screen specs, desktop + mobile, keyed to the approved options |
| `05-qa-addendum.md` | July 2026 design-QA pass — normative deltas; wins over older text |
| `tokens.css` | Drop-in CSS custom properties for the new glass tier (post-QA values) |

## Ground rules for the implementing agent

1. Read the existing component before touching it. The tree/drag logic in `web/src/components/builds/explorer/` (useExplorerDrag, useLongPressDrag, drop-zone rendering in `BuildExplorerRow.tsx`) is CORRECT — restyle it, never reimplement it.
2. All existing tokens in `web/src/app/globals.css` stay. v2 only ADDS the `--glass-*` tier (see `tokens.css`) and retires cream page-chrome usage on top-level screens.
3. Keep the shared component contract (`docs/DESIGN_SYSTEM.md` §3) — same names, same props; only presentation changes.
4. Accessibility is non-negotiable: WCAG AA on glass means the scrim UNDER a glass panel must be ≥ the values in `02-surface-rules.md`; keep focus rings (`--kyar-accent`), reduced-motion (existing), and add `@supports not (backdrop-filter: blur(1px))` fallbacks (opaque `rgb(20 19 32 / 0.85)` panels).
5. Dark mode: v2 screens are photo-dark by nature; the *panel* tokens don't flip. **The glass language covers the entire app** — settings, auth, form modals, and legal pages (`/terms`, `/privacy`) all speak it (see 11a/11b/11c), so there is no cream surface left inside the product. The `--kyar-*` cream tokens survive ONLY in transactional email, which renders outside the app runtime.
6. Offline/local-first UX rules are unchanged (SyncStatus, PendingBadge, OnlineOnlyBanner keep their jobs — restyled per `03-component-changes.md`).
