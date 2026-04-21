# Kyarafit Design System

Shared tokens and specs for web (Tailwind) and mobile (React Native). **Light and dark themes are both first-class**; ship features that work in both unless explicitly scoped.

See also: [`../design/PRODUCT_REDESIGN_PLAN.md`](../design/PRODUCT_REDESIGN_PLAN.md).

## Contents

- `design_tokens.json` – canonical tokens (colors for light + dark, spacing, typography)
- `web/tailwind.config.js` – `kyar.*` OKLCH-backed theme
- `rn_tokens.ts` / `rn/index.ts` – React Native token map and helpers
- `component_spec.md` – component rules and variants
- `design_lint.md` – checklist to prevent UI drift
- `EDITORIAL_GUIDELINES.md` – editorial + product patterns

## Usage

**Web (Next.js):** Theme variables live in `web/src/app/globals.css`; Tailwind maps them under `kyar.*`. Typography: **Albert Sans** (body/UI), **Bodoni Moda** (display), **JetBrains Mono** (mono). Use `font-serif` / `font-sans` / `font-explorer-mono` as defined in Tailwind.

**Mobile (Expo):** Import from `@kyarafit/design-system/rn`:

```ts
import { colors, spacing, font, layout } from "@kyarafit/design-system/rn";
```

## Design rules

- [Component spec](./component_spec.md)
- [Design lint checklist](./design_lint.md)
- [Editorial guidelines](./EDITORIAL_GUIDELINES.md)

## UI audit

Before shipping a screen or component, run the [design lint checklist](./design_lint.md).

**Discouraged patterns (avoid without a spec exception):**

- Raw Tailwind grays or `bg-white` / `text-black` on app surfaces (use `kyar-*` tokens)
- New UI built only in light mode (verify dark mode)
- Boxed inputs where **UnderlineInput** is the standard for the flow
- Decorative gradients and loud chrome that do not serve hierarchy (see redesign plan)
- A single catch-all “card” component for every layout (prefer **Surface** / **Panel** and screen-appropriate archetypes)
