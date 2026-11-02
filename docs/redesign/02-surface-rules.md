# 02 · Surface rules — the laws of Glass Studio

1. **Photography is the page.** Every top-level screen has exactly one backdrop: the contextually-relevant photo (featured/urgent build, convention venue) or, when content is itself a photo collection (Board, Closet), the `--studio-wall` gradient with the photos as tiles.
2. **Glass only ever sits on photography** (or the studio wall). Never glass on cream. Never cream cards on photos.
3. **Panel budget: max ONE glass panel per screen region** — one bar (top), one work panel (right/center), optionally one shelf (bottom). A glass panel never contains another glass panel. Inside a panel: hairline dividers (`--glass-divider`) and flat rows only. This is the anti-card-in-card law.
4. **Scrim before glass.** Text or glass never sits on raw photo: apply `--scrim-page-vertical` always (`--scrim-page-vertical-mobile` on mobile), plus `--scrim-page-right` when a right panel exists — and the **`-strong` variant on high-key photos** (daylight, con-floor, bright/busy shots) or whenever a right work panel is present (QA-1). Contrast target: a 10px 75%-light eyebrow must hit WCAG AA at the headline anchor — when in doubt, raise the local scrim, never the glass opacity above 0.14.
5. **Buttons on photo:** primary = solid light pill (`--glass-bg-solid` = **solid `#fffdf8`, never translucent**, ink text, 9–10px uppercase 0.18em label, icon 15px) — **exactly one primary per view**, and no other ink-filled element competing with it (QA-3; segmented-control active states are exempt). Secondary = 1px `--glass-border-strong` outline pill on `--glass-bg-bar`; tertiary = underlined uppercase meta. Ink-filled buttons remain for cream surfaces (settings/forms) via existing `Button.tsx`.
6. **Active nav/tab:** full-opacity light + 1–1.5px light underline (bar) or top-notch (mobile tab bar). Inactive: 55% light. Never pills for nav.
7. **Rows:** 44px+ touch height, radius 10px, hover `rgb(255 253 248/0.06)`; selected `--glass-bg-active` + inset ring `rgb(255 253 248/0.2)`.
8. **Drag & drop grammar (both explorers, desktop + mobile):**
   - handle `drag_indicator` 15px at 45% opacity, hover-reveal on desktop (`md:opacity-0 group-hover:opacity-100` behavior kept), long-press on mobile (existing `useLongPressDrag`);
   - dragged source row → opacity 0.35–0.4;
   - drag preview → floating chip: `--glass-bg-preview`, blur 20px, border `--glass-border-strong`, shadow `0 24px 48px -16px rgb(12 11 20/.6)`, rotate ±1.5°, shows name + destination hint ("↳ Armor plates" / "3rd ↕");
   - drop BEFORE/AFTER → `--drop-line` 2.5px with glow + 8px dot at line start;
   - drop INTO → `--drop-into-ring` inset + `Drop to nest ▸` affordance text in the row's trailing slot.
9. **Motion:** all existing durations/easings; add: panel entrance = 12px rise + fade 220ms `--ease-out-strong`; backdrop photo Ken-Burns ≤ 1.03 scale over 12s, disabled under reduced-motion; page-to-page = crossfade of backdrop, panels re-enter.
10. **Photo hygiene:** never place text over a face — anchor headlines lower-left, panels right; scrims guarantee legibility regardless of photo.
11. **Empty states** keep `EmptyState` semantics: icon + message + CTA, rendered light-on-glass inside the panel (no card).
12. **What stays cream:** only transactional email (rendered outside the app runtime). Everything inside the product — studio surfaces, settings, auth, subscription, form modals, and legal pages (`/terms`, `/privacy`, ref 11c) — speaks the glass language (forms on glass: glass-outline fields, solid-light primary, on-glass danger; long-form legal = glass reading panel on the studio wall). There is no cream surface inside the app.
13. **Dashed outline = "add" affordance ONLY.** Navigation/see-all tiles use solid 1px light-28% border + light-5% fill (QA-6).
14. **Content is never meta.** Task titles, packing items, element names render as sentence-case body text; uppercase tracking is reserved for labels, statuses, nav, buttons (QA-4).
15. **Glass weights never mix per element:** chrome 0.08/blur 18 · panel 0.10/24/border 0.16/radius 14 · overlay 0.14/30/border 0.22/radius 16 + `--glass-shadow-overlay` (QA-6). No fourth recipe.
16. **No emoji** anywhere, including seed data and i18n strings; unicode micro-glyphs (▸ ▾ ≡ ♡ ◂) are fine (QA-7).
