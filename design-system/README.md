# Kyarafit Design System

Shared tokens and specs for web (Tailwind) and mobile (React Native).

## Contents

- `design_tokens.json` – canonical tokens (colors, spacing, typography)
- `tailwind.config.js` – web theme aligned to tokens
- `rn_tokens.ts` / `rn/index.ts` – React Native token map and helpers
- `component_spec.md` – component rules and variants
- `design_lint.md` – checklist to prevent UI drift

## Usage

**Web (Next.js):** Extend your `tailwind.config.js` with the theme from this package, or copy the `theme.extend` from `tailwind.config.js`. Use serif for titles, sans for body, uppercase meta labels with letter spacing.

**Mobile (Expo):** Import from `@kyarafit/design-system/rn`:

```ts
import { colors, spacing, font, layout } from "@kyarafit/design-system/rn";
```

## Design rules

- [Component spec](./component_spec.md)
- [Design lint checklist](./design_lint.md)
