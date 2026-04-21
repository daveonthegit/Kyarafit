# Kyarafit Design System (Tokens + Specs)

**Product direction and rollout status:** [`../design/PRODUCT_REDESIGN_PLAN.md`](../design/PRODUCT_REDESIGN_PLAN.md) (north star, phased execution, progress tracker).

This folder contains:

- `design_tokens.json` – canonical tokens (v0.2+: light + dark palettes, typography roles, spacing)
- `web/tailwind.config.js` (repo root) – `kyar.*` colors map to OKLCH CSS variables
- `rn_tokens.ts` – React Native token map + helpers
- `component_spec.md` – component rules and variants
- `design_lint.md` – checklist to prevent UI drift
- `EDITORIAL_GUIDELINES.md` – philosophy + patterns

**Web runtime:** semantic colors and fonts are applied via `web/src/app/globals.css` (`--kyar-*`, `--font-body`, `--font-display`, `--font-explorer-mono`) and the root theme script (`kyar-theme`, `data-theme`, `.dark`).

Workflow:

1. Change design in tokens first (`design_tokens.json` ↔ `globals.css` variables).
2. Keep Tailwind `kyar.*` and RN maps in sync.
3. Validate new screens using `design_lint.md` (including **both themes**).
