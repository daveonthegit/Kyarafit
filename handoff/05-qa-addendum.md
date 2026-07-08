# 05 · QA addendum (July 2026) — normative deltas

A senior design-QA pass was run against the full prototype (`explorations/Kyarafit Prototype.dc.html`, desktop 1280×820 + mobile 390×844) and the last-mile states (Redesign turn 13). **The prototype as it stands now is post-QA and canonical** — where an earlier handoff file disagrees with this addendum or with the prototype markup, this addendum wins. Every rule below was violated somewhere in the draft screens; treat them as lint rules, not suggestions.

## QA-1 · Scrims vs high-key photography (blocking)
Two scrim recipes, not one. Default `--scrim-page-right` (0.6 / 0.32 @45% / 0.55). **`--scrim-page-right-strong`** (0.7 / 0.42 @45% / 0.72) is REQUIRED when (a) the backdrop is high-key — daylight, con-floor, bright/busy shots — or (b) a right work panel sits on the photo. Mobile always uses `--scrim-page-vertical-mobile` (0.86 base). Rule of thumb: a 10px 75%-light eyebrow must hit AA at the headline anchor; if in doubt raise the local scrim, never glass opacity past 0.14.

## QA-2 · Type floors (blocking)
- Minimum text size on glass/photo: **9px, everywhere, both platforms.** The draft screens used 7px and 8px micro-captions — all raised to 9px. Nothing below 9px may be introduced.
- Minimum uppercase tracking: **0.14em.** (0.1em / 0.12em instances were removed.)
- Meta tiers: card caption 9px/0.14–0.16em · standard label 10px/0.16–0.24em · hero eyebrow 10px/0.26–0.3em.
- Serif page headline: never below 40px desktop. Studio-wall page tier = 52px (Board was 44 → 52). Mobile page serif ≥ 34px, hero titles 38–40px.

## QA-3 · Exactly one primary (blocking)
- Primary pill = **solid `#fffdf8`** with ink text. The translucent `rgb(255 253 248/0.92)` fill is retired — four screens had drifted to it.
- Max ONE ink-on-cream element per view. Non-buttons count: the subscription "Current plan" badge was ink-filled and competed with "Go Pro" — badges of that kind are outline (1px light-55% border, transparent bg, light text).
- Accepted exception: the ACTIVE segment of a segmented control (element status, modal status, appearance) is solid light + ink. It is a control state, not a CTA.

## QA-4 · Content is never meta (blocking)
List content — task titles, packing items, element names — is sentence-case body (13px, weight 400–600), NEVER uppercase-tracked meta. The draft packing lists were uppercase/0.1em; fixed. Uppercase is reserved for labels, status words, nav, and buttons.

## QA-5 · Tap targets (blocking, mobile)
≥44px effective height on every interactive element. Fixed in the prototype: tab-bar icons get full-width flex cells with vertical padding (icon alone is not a target); checklist/list rows padded to ~44px. Carry this into `BottomNav.tsx` and all RN rows.

## QA-6 · Affordance grammar
- **Dashed outline = "add" affordance ONLY.** Navigation tiles (e.g. "All builds") use solid 1px light-28% border + light-5% fill.
- Glass weights never mix: chrome 0.08/blur 18 · panel 0.10/24/border 0.16/radius 14 · overlay 0.14/30/border 0.22/radius 16 + `--glass-shadow-overlay`. (The public-build creator strip and group-detail convention tiles had drifted; fixed.)
- The dynamic-island/status cutout treatment on mobile is dark (`rgb(12 11 20/0.9)`) on every screen including studio-wall ones.

## QA-7 · No emoji
Unicode micro-glyphs (▸ ▾ ≡ ♡ ◂) are allowed; emoji are not (one 😍 removed from seeded comment copy). Applies to seed data and i18n strings too.

## Screens that passed QA untouched
Planner, Elements/closet, Discover, Element detail sheet, Sign in, mobile menu drawer (13e), first-run empty (13f), no-imagery fallback (13g). Implement these exactly as specced in `04-screens.md`.
