# UI Refinement Audit – Magic UI & Design System Alignment

**Branch:** `design/magic-ui-refinement`  
**Date:** 2025-03-06

> **2026 update:** The product-wide visual foundation is documented in **[`PRODUCT_REDESIGN_PLAN.md`](./PRODUCT_REDESIGN_PLAN.md)** (OKLCH `--kyar-*`, Albert Sans + Bodoni Moda + JetBrains Mono, dual-theme parity, refreshed shell and landing). This audit remains a **historical record** of the Magic UI pass and token fixes on that branch. For **current** token names and rules, use `docs/design_system/design_lint.md`, `component_spec.md`, and `EDITORIAL_GUIDELINES.md`.

## 1. Design system source of truth

- **Tokens:** `design-system/design_tokens.json` (v0.2+), `web/src/app/globals.css`, `web/tailwind.config.js` (`kyar.*` OKLCH map)
- **Rules:** `docs/design_system/component_spec.md`, `docs/design_system/design_lint.md`, `EDITORIAL_GUIDELINES.md`
- **Principles (still aligned):** Editorial utility; display serif for hero/titles, sans for body; restrained meta labels; one accent family; underline-first inputs; subtle motion; minimal gratuitous chrome. **Radii** follow the live Tailwind theme (e.g. `rounded-sm` = 6px).

## 2. What was visually weak

| Area                       | Issue                                                                                                                                | Design system conflict                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Landing (page.tsx)**     | `text-zinc-*` used for labels and secondary text                                                                                     | Secondary text should use opacity / kyar tokens, not arbitrary grays                       |
| **Home hero**              | Strong gradient overlay `from-black/60` on hero image                                                                                | Design lint: "Overlays are minimal and editorial (no big gradients on images)"             |
| **Builds page**            | Form controls use `border-gray-300`, `rounded-md`, `bg-gray-50`, `bg-gray-200`; checkboxes `rounded`; `text-red-600` for over budget | Borders/backgrounds should use kyar.\*; radius.sm; square checkboxes; danger = kyar-danger |
| **Closet page**            | Same form/control tokens; status shown with `text-green-700`, `text-amber-700`                                                       | One accent only; "No colorful chips or badges" – use opacity/muted for status              |
| **Settings**               | `border-gray-100`, `bg-gray-100`, `text-red-500/80` for sign out                                                                     | Use kyar-borderSubtle, kyar-muted, kyar-danger                                             |
| **Planner**                | Progress bar uses `bg-kyar-primary` (undefined in Tailwind; should be accent); `border-gray-100`; task checkbox `rounded`            | kyar-primary not in theme; square checkbox                                                 |
| **AdaptiveModal**          | `rounded-lg` on dialog                                                                                                               | radius.sm / sharp corners                                                                  |
| **Card accordion**         | `rounded-2xl` on panels                                                                                                              | radius.sm for consistency                                                                  |
| **FloatingAdd**            | `shadow-lg`                                                                                                                          | Design tokens specify shadow.fab                                                           |
| **Empty / loading states** | Plain text only; no shared pattern                                                                                                   | Could use a reusable EmptyState for hierarchy and consistency                              |

## 3. What was improved

### 3.1 Token and consistency fixes (no Magic UI)

- **Landing:** Replaced all `text-zinc-*` with `text-kyar-meta`, `text-kyar-textSecondary`, `text-kyar-textTertiary`. Softened hero overlay to a minimal bottom gradient for readability while staying editorial.
- **Builds:** Selects and search input use `border-kyar-border`, `rounded-sm`, focus `ring-kyar-accent`. Build cards use `bg-kyar-muted` for image placeholder; progress/budget bars use kyar borders; over-budget text uses `text-kyar-danger`. Selection checkboxes are square (`rounded-sm`). Bottom bar and modals use kyar borders.
- **Closet:** Same form/control alignment; status labels use opacity/muted only (no green/amber). Square checkboxes.
- **Settings:** Section borders `border-kyar-borderSubtle`; language pills `bg-kyar-muted` and `bg-black` for selected; sign out `text-kyar-danger`. Links use kyar hover states.
- **Planner:** Progress bar uses `bg-kyar-accent` (fixed undefined kyar-primary). Event list borders `border-kyar-borderSubtle`. Task row checkbox square.
- **AdaptiveModal:** Dialog container `rounded-sm` to match radius.sm.
- **Card accordion:** Panels and focus ring use `rounded-sm` for editorial consistency.
- **FloatingAdd:** Uses `shadow-[0_10px_20px_rgba(0,0,0,0.12)]` (shadow.fab) per design tokens.

### 3.2 Shared primitive

- **EmptyState:** New reusable component (`web/src/components/ui/EmptyState.tsx`) with optional icon, message, and CTA. Used on builds and closet empty states for consistent hierarchy and spacing.

### 3.3 Magic UI usage (redesigned to fit design system)

- **BlurFade** (`web/src/components/ui/blur-fade.tsx`): Magic UI blur-fade entrance, **redesigned** for Kyarafit (shorter duration, subtle blur, `prefers-reduced-motion` support). Available for use elsewhere; **not used on home quick links** (per preference).
- **MagicCard** (`web/src/components/ui/magic-card.tsx`): Magic UI magic-card spotlight, **redesigned** for Kyarafit:
  - **Black-only** spotlight: `gradientFrom`/`gradientTo`/`gradientColor` are black/transparent only (no purple/pink). Border glow and inner hover glow use black at low opacity.
  - Default `rounded-sm` and `border-kyar-borderSubtle` to match component spec.
  - `gradientOpacity` set to 0.12 so the inner glow is subtle, not neon.
  - **Used on:** Home quick link cards (Builds, Conventions, Closet) so hover reveals a soft black edge highlight.

All improvements stay within the design system: kyar colors, spacing, typography, radius, and shadow. No new accent colors, no gradients in chrome (MagicCard uses black only), and motion is subtle.

## 4. Why these choices fit the design system

- **Tokens only for color/shape:** Every change uses existing kyar.\* or token-derived values so the UI stays single-accent, editorial, and consistent.
- **Sharp corners:** radius.sm (2px) applied to controls, modals, and cards aligns with the component spec and design lint.
- **Status without color chips:** Closet status is communicated with opacity and weight, not green/amber, respecting "no colorful chips or badges."
- **Minimal overlay:** Landing hero overlay was reduced so imagery stays dominant and the overlay stays editorial.
- **EmptyState:** Improves clarity and reuse without introducing new visual language; uses existing typography and spacing.
- **BlurFade / MagicCard:** Magic UI components are restyled so they support the product identity: BlurFade with shorter, subtler animation and reduced-motion support; MagicCard with black-only spotlight and sharp corners (no gradients, no neon).

## 5. Screens/components updated

- `web/src/app/page.tsx` – Landing: tokens, hero overlay
- `web/src/app/home/page.tsx` – Quick links: MagicCard wrapper per link (no BlurFade)
- `web/src/app/builds/page.tsx` – Forms, cards, empty state, selection bar, modal
- `web/src/app/closet/page.tsx` – Forms, cards, status, empty state, selection bar, panels
- `web/src/app/settings/page.tsx` – Sections, language switcher, sign out
- `web/src/app/planner/page.tsx` – Progress bar, borders, task checkbox
- `web/src/components/layout/AdaptiveModal.tsx` – Dialog radius
- `web/src/components/layout/FloatingAdd.tsx` – Shadow
- `web/src/components/ui/card-accordion.tsx` – Panel radius
- `web/src/components/ui/EmptyState.tsx` – New component
- `web/src/app/conventions/page.tsx` – Form controls (border, radius, focus ring), modal checkboxes
- `web/src/components/ui/blur-fade.tsx` – New (Magic UI BlurFade, redesigned)
- `web/src/components/ui/magic-card.tsx` – New (Magic UI MagicCard, redesigned)

## 6. Magic UI elements introduced

- **BlurFade:** Scroll-triggered blur-fade entrance; tuned for short duration, subtle blur, and `prefers-reduced-motion`. Available; not used on home quick links.
- **MagicCard:** Mouse-following border and inner glow; redesigned to black-only (no purple/pink), `rounded-sm`, low-opacity glow. Used on home quick link cards.

## 7. Remaining UI debt / future opportunities

- **Underline inputs in filter bars:** Builds/closet/conventions use full-border inputs for search/filter. Design spec prefers underline-only for primary inputs; filter bars could later use UnderlineInput or a minimal variant for consistency.
- **Blur-fade:** Implemented on home quick links with reduced-motion support.
- **Reduced motion:** BlurFade respects `prefers-reduced-motion`; MagicCard motion is cursor-follow only (no auto-motion).
- **Mobile:** Same token and component fixes apply on mobile; RN uses `@kyarafit/design-system/rn` and was not modified in this branch.
