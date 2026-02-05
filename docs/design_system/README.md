# Kyarafit Design System (Tokens + Specs)

This folder contains:

- `design_tokens.json` – canonical tokens (colors, spacing, typography roles)
- `tailwind.config.js` – web config aligned to tokens
- `rn_tokens.ts` – React Native token map + helpers
- `component_spec.md` – component rules and variants
- `design_lint.md` – checklist to prevent UI drift

Workflow:

1. Change design in tokens first.
2. Update Tailwind + RN maps if needed.
3. Validate new screens using `design_lint.md`.
