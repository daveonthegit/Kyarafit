# 01 · Foundations — kept / added / retired

## Kept exactly (do not touch)

- All `--kyar-*` oklch triplets in `web/src/app/globals.css` (light + dark) — settings, forms, modals, legal, and email surfaces still use them.
- Fonts and loading (`web/src/app/layout.tsx`): Albert Sans (`--font-body`), Bodoni Moda (`--font-display`), JetBrains Mono (`--font-explorer-mono`), Material Symbols Outlined (opsz 24, wght 300, FILL 0).
- The uppercase meta system: 9–11px, 700/600 weight, tracking 0.14–0.28em. It is the ONLY label style. (QA floor: nothing under 9px, tracking never under 0.14em — see `05-qa-addendum.md`.)
- `.bg-kyar-media-scrim*` utilities and `--kyar-media-fg*` — fixed, never theme-flipped.
- Type scale, spacing scale, `--ease-out-strong` (0.23,1,0.32,1) 180ms transitions, press `scale(0.98)`, reduced-motion block, focus ring (2px accent, offset 2).
- Accent role: links, focus rings, soft radial glow. **Never a button fill. Never status.** (Per product owner: "indigo was never an accent" — treat ink as the only action color.)

## Added (see tokens.css)

- The `--glass-*` tier: panel/bar/chip surfaces, borders, dividers, blur radii (24/18/10px), radii (14px panel, 20px sheet).
- On-glass state colors: danger `rgb(255 168 168/.95)`, and translucent chip tone pairs (done=emerald, active=sky, warn=amber, neutral=cream) replacing the Tailwind `amber-50/sky-50/emerald-50` chips ONLY when rendered on glass. On cream surfaces (settings etc.) the existing `STATUS_TONE_CLASSES` in `explorer/BuildExplorerRow.tsx` stay.
- Page scrims `--scrim-page-right` / `--scrim-page-vertical` and the `--studio-wall` gradient (board + closet backdrop when no single photo dominates).
- Drop indicators: `--drop-line` (2.5px light line + glow + 8px dot at its start) and `--drop-into-ring` (1.5px inset ring + `--glass-bg-active` wash).

## Retired from top-level screens

- Cream page background + accent-soft radial glow (retired app-wide; `--kyar-*` cream survives only in transactional email).
- `SectionCard` chrome everywhere including settings (ref 11a now renders settings as a glass work panel; the component is retired, not merely relocated — supersedes older notes).
- `rounded-2xl border shadow-soft` white cards stacked on cream — the source of the card-in-card slop. Replaced by: photo, scrim, ONE glass panel.
- Sidebar (`WebSidebar.tsx`) as primary desktop nav → glass top bar (see 03). Collapse behavior no longer needed.

## Type on photo — sizes used in the approved screens

- Page headline: italic Bodoni 64–92px (never below 40px desktop; studio-wall pages 52px), line-height 0.95, tracking −0.02em, text-shadow `0 3px 14px rgb(12 11 20/.45)`.
- Panel row title: Albert Sans 14–15px / 500. Row meta: 9px uppercase 0.14–0.2em at 55–70% opacity. List CONTENT (task titles, packing items) is sentence-case body, never uppercase meta (QA-4).
- Serif inside panels only for entity names (event names, element names on tiles), 17–24px italic.
- Wordmark in bar: italic Bodoni 21px. Minimum text on glass: **9px, both platforms** (raised from 8px mobile in QA).
