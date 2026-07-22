# AGENT_PROMPT_MOBILE — implement Glass Studio phase 7 (mobile parity) in `mobile/`

Operating prompt for a coding agent (Claude Code etc.) doing the **mobile parity pass** of the
Kyarafit v2 "Glass Studio" redesign. Web phases 0–6 are already implemented on branch
`feat/glass-studio-phase-0` (commits `f170bec…d9128f7` plus owner follow-ups) — the web app is the
**living reference implementation**; this prompt ports the same language to the Expo app.

Run one sub-phase (7.0–7.5) per session/PR. Stop for an owner device-check after 7.1 and 7.2.

> **Progress (July 2026):** 7.0–7.4 are DONE (7.3 events + 7.4 social built and committed,
> awaiting owner device checks), plus the auth screens + signed-out welcome from 7.5 (pulled
> forward on owner request). Remaining: **7.5 settings** and the build-detail owner-feedback
> round. Live status + resume instructions: `docs/redesign/HANDOFF.md`; agent brief:
> `docs/redesign/GLASS_MOBILE_BRIEF.md`; open items: `WORK.md`.
> Two normative deltas since this prompt was written: **ADR-0002** (sync status lives in Settings,
> never a floating chip — supersedes 03/04 where they say otherwise) and the **implementation
> learnings** section at the bottom of this file (React Native pitfalls that broke on device —
> binding for all remaining sub-phases).

---

## PROMPT (copy from here)

You are implementing **phase 7 — mobile parity** of the approved "Glass Studio" v2 redesign in the
Kyarafit monorepo's `mobile/` workspace (Expo + React Native + Expo Router + NativeWind +
Convex/SQLite offline sync).

### Read first, in this order

1. `docs/redesign/README.md` — concept + ground rules
2. `docs/redesign/01-foundations.md` — tokens kept / added / retired
3. `docs/redesign/02-surface-rules.md` — the 16 laws
4. `docs/redesign/05-qa-addendum.md` — QA lint rules; **wins over anything that contradicts it**
5. `docs/redesign/03-component-changes.md` — the "Mobile app (`mobile/`)" section
6. `docs/redesign/04-screens.md` — mobile refs **7a–7e**, plus 13d (creation dialog), 13e (drawer),
   13f (first-run empty), 13g (no-imagery fallback)
7. `docs/redesign/reference/Kyarafit Prototype.dc.html` — pixel source of truth. Mobile screens are
   the `<div data-screen="…" data-plat="mobile">` blocks inside the `data-stage="mobile"` stage
   (390×844). Extract exact values with a quick script, e.g.
   `python3 -c 'h=open("docs/redesign/reference/Kyarafit Prototype.dc.html").read(); i=h.find("data-stage=\"mobile\""); print(h[i:i+6000])'`
8. Repo conventions: `CLAUDE.md`, `rules/mobile-parity.mdc`, `rules/frontend-patterns.mdc`,
   `rules/testing-patterns.mdc`, `docs/DESIGN_SYSTEM.md` (§3 component contract, §8 parity matrix).

### The web implementation is your semantic reference

Read these before building the RN equivalent — mirror behavior and grammar, not markup:

| Concern                   | Web reference (current HEAD, not this list, is authoritative)                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token source              | `design-system/design_tokens.json` → `glass` block; consume via `import { glass } from "@kyarafit/design-system/rn"` (surfaces, borders, text, chips, blur, radius, scrims-as-stops, drop, shadow, **fallback**) |
| Glass utilities & recipes | `web/src/app/globals.css` (the `--glass-*` tier + scrim utilities + `.glass-field`)                                                                                                                              |
| Backdrop                  | `web/src/components/layout/PhotoBackdrop.tsx` (studio-wall fallback under the photo — never a gray box; focal-point support; Ken Burns ≤1.03/12s)                                                                |
| Buttons/chips             | `web/src/components/ui/PhotoPill.tsx`, `ControlPill.tsx` (glass variant), `EmptyState.tsx` (`surface="glass"`)                                                                                                   |
| Shell                     | `web/src/components/layout/BottomNav.tsx`, `GlassTopBar.tsx`, `MobileNavMenu.tsx`, `AdaptiveModal.tsx`                                                                                                           |
| Screens                   | `web/src/app/{home,builds,planner,elements,conventions,feed,discover,groups,settings,auth}/…` and `web/src/app/build-detail/[id]/page.tsx`                                                                       |
| Task/checklist grammar    | `web/src/components/planner/PlannerWorkflowTaskUi.tsx`, `web/src/components/ui/ChecklistRow.tsx` (21px round task checkboxes; square packing checkboxes; sentence-case 13px content — QA-4)                      |
| Status chips on glass     | `BuildExplorerRow.tsx` `STATUS_TONE_CLASSES` → `glass.chip.{done,active,warn,neutral}`                                                                                                                           |
| Nav/add config            | `@kyarafit/design-system` `navConfig.ts` (`NAV_SECTIONS_BOTTOM`, `getPrimaryAddMenuItem`)                                                                                                                        |

### Non-negotiable guardrails

- **Restyle, never reimplement.** Keep every query, mutation, SQLite/offline sync path
  (`useConvexSync`, `mobile/src/offline`), gating, gesture handler (the explorer **long-press
  drag** and bottom-sheet drag states are correct as-is), navigation param, and test.
- **Tokens only.** All glass values come from the shared `glass` export in
  `@kyarafit/design-system/rn` (added in phase 0). No hex/rgba literals in components. If a value
  is missing, add it to `design_tokens.json` + mirror in `rn_tokens.ts` and note it in the commit.
- **Glass never theme-flips.** The existing `ThemeProvider`/`useDesignTheme` cream themes keep
  working for anything not yet converted, but converted screens are photo-dark by nature and read
  fixed glass/media-fg tokens directly. Do not route glass colors through the flipping theme.
- **QA lint rules on every line** (05-qa-addendum, adapted to RN):
  - min text 9px → min `fontSize: 9`; uppercase tracking ≥0.14em → `letterSpacing ≥ ls(0.14, size)`
    (helper in `rn_tokens.ts`);
  - exactly ONE solid-`#FFFDF8` primary per screen (`glass.surface.solid` + `glass.text.ink`);
    segmented-control active states are exempt;
  - list content (tasks, packing, element names) is sentence-case body, never uppercase meta;
  - ≥44pt tap targets everywhere (QA-5 is _blocking_ on mobile — tab cells are full-width flex
    cells with vertical padding, icon alone is not a target);
  - three glass weights only: bar 0.08/blur 18 · panel 0.10/24 · overlay 0.14/30 — never mixed;
  - dashed border = add-affordance ONLY; nav tiles use solid `glass.border` + light-5% fill;
  - no emoji anywhere (unicode micro-glyphs ▸ ▾ ≡ ♡ ◂ are fine);
  - the status-bar/dynamic-island cutout treatment is dark `rgb(12 11 20 / 0.9)` on every screen.
- **Keep working:** offline/local-first UX (SyncStatus, PendingBadge, OnlineOnlyBanner
  equivalents), i18n — every new string through `mobile/src/i18n` in **en + ja + es** (mobile has
  all three; `npm run i18n:check` enforces parity), dynamic type / font scaling, reduced motion
  (`useReducedMotion` / `AccessibilityInfo`), safe areas, WCAG AA on glass (raise the local scrim,
  never glass opacity past 0.14).

### Platform notes (why this isn't a class sweep)

- **`expo-blur` is NOT installed yet.** `npx expo install expo-blur` in `mobile/` as the first act
  of 7.0. `expo-linear-gradient` is already present — use it for the scrims/studio wall from
  `glass.scrim.*` (they ship as structured `{direction, stops[]}` for exactly this).
- **Blur fallback is a runtime decision:** on Android use `experimentalBlurMethod` where
  acceptable, otherwise render the opaque `glass.fallback.{bar,panel,overlay}` colors
  (`rgb(20 19 32 / 0.82–0.92)`). Wrap this choice inside the primitives so screens never care.
- **Blur is expensive.** Never blur inside scrolling list rows; blur the bar/panel container only.
  If a screen shows jank on device, drop that surface to its opaque fallback — spec explicitly
  allows it.

### Sub-phases (one per session/PR, in order)

- **7.0 — foundations.** Install expo-blur. Build the RN primitive layer in `mobile/src/ui/glass/`:
  `GlassPanel` / `GlassBar` / `GlassOverlay` (three weights + fallback), `PhotoBackdrop`
  (ResolvedImage equivalent + LinearGradient scrims + studio-wall fallback + focal point),
  `PhotoPill` (solid/outline/text), glass `TextField` styling, `EmptyState surface="glass"`,
  on-glass status chip helper. Add a dev gallery entry (`settings/dev/gallery.tsx`) rendering all
  of them for device QA. No screen changes.
- **7.1 — shell.** Tab bar → BlurView glass (bar weight, top hairline, light top-notch active,
  55% inactive, full-cell 44pt targets, same 5 sections from `NAV_SECTIONS_BOTTOM`);
  `FloatingCreateMenu` → solid-light pill + glass sheet menu (`getPrimaryAddMenuItem`); "more"
  drawer per 13e; stack headers → transparent-over-photo with light back affordances; dialogs/
  bottom sheets → overlay glass (13d), sheets keep 20pt top radius + drag grip. **STOP — owner
  device check before continuing.**
- **7.2 — core studio screens** (refs 7a–7e): Home 7a (headline → glass agenda card → horizontal
  studio strip), Builds 7b (full-bleed pager, dots, solid "Open build" + glass "Board",
  grid_view toggle), Build detail + element explorer 7c (glass bottom sheet over the build photo,
  long-press drag kept, helper line "Long-press a row to drag…"), Board 7d (2-col masonry on
  studio wall), Planner 7e. Element inspector sheet per 8b (overlay weight, half/full states
  kept). **STOP — owner device check.**
- **7.3 — events.** Conventions list/detail/edit + packing per 6e/8a grammar (day rail, packing
  panel, square sentence-case checklist rows).
- **7.4 — social.** Feed/Discover/Groups/Group detail/Public build + profile per 12a–12d/8c;
  OnlineOnlyBanner as the glass strip.
- **7.5 — settings + auth.** Settings tree as glass panels (11a; keep REQ-031 export warning),
  auth screens per 11b/13a–13c (note: web auth now has a split-media variant in
  `web/src/components/auth/AuthGlassFrame.tsx` — mirror the _current_ web look, and reuse its
  imagery path under `web/public/images/auth/` only if a mobile-appropriate asset exists;
  otherwise studio wall per 13g).

### Per-sub-phase definition of done

1. Matches the prototype's `data-plat="mobile"` block for that screen where feasible; the app's
   real data shape wins over mock data; screens QA'd as already perfect (Planner, Elements,
   Discover, element sheet, Sign-in, drawer 13e, first-run 13f, no-imagery 13g) are built exactly
   as specced — no "improvements".
2. `npm run typecheck:mobile`, `npm run lint:mobile`, mobile tests (`npm -w mobile run test`), and
   `npm run i18n:check` all green; new strings landed in en+ja+es.
3. QA grep over the diff: `fontSize: [0-8]\b`, letterSpacing below the 0.14em floor, translucent
   light fills used as primaries (`0.92`), `dashed` on non-add elements, emoji.
4. iOS simulator screenshots at 390×844 for every screen touched (attach to the PR); note any
   surface dropped to opaque fallback and why.
5. One conventional commit per coherent chunk (`feat(mobile): glass studio 7.x — …`); no PRs
   unless the owner asks.

### Branch & flags

- Branch off the current Glass Studio branch (`feat/glass-studio-phase-0` or its merged
  descendant) — check `git log` for owner follow-up commits and treat **current web HEAD** as the
  reference, not older commit summaries.
- Flag, don't silently pick, when: the prototype's mobile tab set disagrees with
  `NAV_SECTIONS_BOTTOM` (navConfig wins); the prototype's icon-only tab bar conflicts with the
  current labeled tabs (web kept labels — match web); blur cost forces a fallback; or a spec'd
  datum doesn't exist in the real model (compose from what exists, as web did for headline
  statements and packing meta).

Work autonomously through the current sub-phase; ask the owner only when the spec and the real
data model genuinely conflict, or at the two STOP checkpoints.

### Implementation learnings (7.0–7.2, binding)

- **Never pass a function as a Pressable `style`** (`style={({pressed}) => …}`): the NativeWind
  interop silently drops function styles on device. Use static style arrays +
  `className="active:opacity-80"` for pressed feedback.
- **`Link asChild` injects a `style` prop** into its child. In reusable components spread
  `{...rest}` BEFORE your own `style`, and flatten-merge an incoming `style` prop — otherwise the
  injected prop replaces your variant styles (this made solid pills render as bare text).
- **expo-router's Slot rejects style ARRAYS** on its direct children (dev-mode throw). Glass
  primitives `StyleSheet.flatten` their composed styles; do the same for any `Link asChild` child.
- **Serif (Bodoni) headlines clip glyph tops** at `lineHeight == fontSize` — always ≥ 1.1×.
- **FlatList `numColumns` items need real widths** (`flex:1` + `maxWidth:"50%"` inside
  `columnWrapperStyle`) or tiles collapse to zero width.
- Chip/filter rows that can exceed 390pt must be horizontal ScrollViews.
- **Fonts in components:** import `APP_FONT_FAMILIES` from `@/theme/fontFamilies` (pure constants),
  NOT `@/theme/appFonts` (pulls expo-font and breaks vitest component suites).
- **Vitest stubs** for natively-shipped JSX live in `mobile/src/test-support/` (expo-blur,
  expo-linear-gradient, @expo/vector-icons, react-native-safe-area-context) and are aliased in
  `mobile/src/offline/vitest.config.ts`; the shared RN mock is `createReactNativeMock()`.
- Sync status is a Settings surface (ADR-0002), not floating chrome; only transient banners float.

## (end of prompt)
