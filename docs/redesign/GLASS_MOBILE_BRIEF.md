# Glass Studio mobile — shared brief for screen-conversion agents

Hand this to any agent converting ONE mobile screen (Expo + RN + Expo Router + NativeWind +
Convex offline sync) to the Glass Studio v2 design. The primitives already exist. It repeats the
normative sources (`01`–`05`, `AGENT_PROMPT_MOBILE.md`) in working form; where they conflict, the
QA addendum wins. Previously lived in a session scratchpad; committed here so it survives sessions.

## Non-negotiable guardrails

- RESTYLE, NEVER REIMPLEMENT. Keep every query, mutation, offline path (`useOfflineMutation`,
  `useOfflineQuery`), DataBoundary usage, gesture handler (long-press drag, sheet drag states),
  navigation param, and gating exactly as-is. Only presentation changes.
- Tokens only: ALL glass colors come from `import { glass, ls, borderWidth } from "@kyarafit/design-system/rn"`.
  NO hex/rgba color literals in components. Fonts via `import { APP_FONT_FAMILIES } from "@/theme/fontFamilies"`
  (NOT `@/theme/appFonts` — that pulls expo-font into vitest suites).
- Glass never theme-flips: converted screens are photo-dark; read fixed glass tokens directly,
  never `useDesignTheme` colors for glass surfaces.
- DO NOT edit: `mobile/src/i18n/locales/*.json` (report new keys instead), `design-system/*`,
  `mobile/src/ui/glass/*` (primitives are frozen), any shared component in `mobile/src/components/**`
  unless your screen is its ONLY consumer (grep first). Build new glass presentation components in
  your screen's own file or a new sibling file.
- New user-facing strings: `t("ns.key", { defaultValue: "English text" })` and LIST every new key +
  English value in your final report. No emoji anywhere (unicode glyphs ▸ ▾ ≡ ♡ are fine).

## Primitives (mobile/src/ui/glass, exported from "@/ui/glass")

- `<PhotoBackdrop imageStorageId imageUrl focalX focalY scrim="default"|"off" kenBurns style/>` —
  absolute-fill backdrop: studio-wall gradient under the photo (never a gray box), mobile vertical
  scrim, Ken Burns ≤1.03/12s with reduced-motion off. Put inside a flex-1 View; content above it.
- `<GlassPanel style/>` (0.10/blur 24/radius 14) · `<GlassBar/>` (0.08/18) ·
  `<GlassOverlay surfaceStyle/>` (0.14/30/radius 16 + shadow). `blur={false}` = opaque fallback
  (REQUIRED inside scrolling list rows); `onWall` = wash over the studio-wall gradient.
- `<GlassSheet open onClose closeLabel/>` — bottom sheet scaffold (dim scrim, overlay glass, 20pt
  top radius, drag grip).
- `<PhotoPill variant="solid|outline|text" size="md|sm" icon label onPress/>` — solid = the ONE
  content primary per view (QA-3; the global FloatingCreateMenu FAB doesn't count against this —
  owner precedent from the Builds device check).
- `<GlassTextField label placeholder error/>` · `<GlassEmptyState icon message secondary action/>` ·
  `<GlassStatusChip tone="neutral|warning|active|success" label/>` + `glassChipColors(tone)`.
- `scrimGradientProps(glass.scrim.X)` → expo-linear-gradient props for tile scrims.
- `useReducedMotion()`.

## Type & layout rules (QA addendum — blocking lint rules)

- Min fontSize 9. Uppercase tracking ≥ `ls(0.14, size)` — ALWAYS `ls()` for letterSpacing.
- Meta tiers: card caption 9px/ls(0.14–0.16) · label 10px/ls(0.16–0.24) · hero eyebrow 9–10px/ls(0.26).
- Serif (`APP_FONT_FAMILIES.displayItalic`): mobile page headline ≥34, hero titles 38–40,
  **lineHeight ≥ 1.1 × fontSize** (equal values clip glyph tops on device).
- List CONTENT (task titles, packing items, element names) = sentence-case body 12–14px sans,
  NEVER uppercase meta (QA-4).
- Exactly ONE solid-#FFFDF8 content primary per screen (segmented-control actives exempt).
- ≥44pt tap targets (full-cell rows; icon alone is not a target).
- Dashed border = "add" affordance ONLY; nav tiles use solid `glass.border` + light 5% fill.
- Three glass weights only; never a fourth recipe. No per-row blur.
- Headline block: left/right 22, top `insets.top + 58`. Panels/shelves: left/right 16.
- Tab screens draw their own headline (no nav header); scroll content bottom padding
  `insets.bottom + 120` (the glass tab bar overlays).
- Status tones: done=success · active/in-progress=active · blocked/waiting=warning · else neutral;
  overdue/danger text = `glass.text.danger`. Sync status lives in Settings (ADR-0002).

## Device-verified pitfalls (MANDATORY — each broke on device once)

1. NEVER pass a function as Pressable `style` — NativeWind drops function styles. Static style
   arrays + `className="active:opacity-80"`.
2. `Link asChild` injects a `style` prop: reusable components spread `{...rest}` BEFORE their own
   `style` and flatten-merge an incoming `style`.
3. expo-router's Slot throws on ARRAY styles on its direct children — `StyleSheet.flatten` composed
   styles at primitive roots and on any `Link asChild` child.
4. Horizontal chip/filter rows must be horizontal ScrollViews (they clip at 390pt).
5. `FlatList numColumns` items need real widths (`flex:1` + `maxWidth:"50%"` in
   `columnWrapperStyle`) or tiles collapse to zero width.

## Verification (must pass before you finish)

From repo root: `npm run typecheck:mobile` and `npm run lint:mobile` (0 errors; a few pre-existing
warnings in unrelated files are OK). Do NOT run npm install, git commit, or edit locale JSONs.

## Final report format

1. What changed (files). 2. New i18n keys (`ns.key` → English). 3. Flags (spec vs data-model
conflicts, surfaces dropped to opaque fallback and why, anything left cream deliberately).
