# Kyarafit – Visual & Interaction Style Guide

This document describes the **current Kyarafit visual language** (2026 foundation). Implementation lives in `web/src/app/globals.css` (OKLCH `--kyar-*` variables), `web/tailwind.config.js` (`kyar.*` color map), and shared primitives under `web/src/components/ui/`.

**Canonical product direction:** [`docs/design/PRODUCT_REDESIGN_PLAN.md`](./design/PRODUCT_REDESIGN_PLAN.md) (north star, phases, and progress tracker).

---

## Design Thesis

Kyarafit presents cosplay as **craft, not fandom clutter**.

The interface feels like:

- an editorial lookbook
- a studio planner
- a personal archive

Every screen balances **aesthetic restraint** with **functional clarity**.

---

## Overall Aesthetic

### Keywords

- Editorial
- Atelier
- Minimal
- Confident
- Calm

### Explicit Non-Goals

- Cute or chibi styling
- Loud fandom visuals
- Gamified or “productivity app” tropes
- Dense dashboards

---

## Color System

Colors are **semantic and theme-aware**. Light and dark are both first-class: tokens are defined together in OKLCH and exposed as Tailwind `kyar.*` keys (`bg`, `surface`, `text`, `textSecondary`, `textTertiary`, `textMuted`, `meta`, `border`, `borderSubtle`, `accent`, `danger`, etc.).

### Principles

- Prefer **token classes** (`bg-kyar-bg`, `text-kyar-text`, `border-kyar-borderSubtle`) over raw hex, `gray-*`, or `black`/`white` on surfaces.
- **One accent family** (`kyar-accent` / `kyar-accentSoft`) for focus, links, and emphasis—not rainbow UI chrome.
- **Gradients** belong on imagery and intentional marketing moments, not as default app chrome (see redesign plan anti-patterns).
- **WCAG 2.2 AA** is the accessibility baseline in both themes.

### Reference

- JSON snapshot: `design-system/design_tokens.json` (v0.2+)
- Runtime: CSS variables in `web/src/app/globals.css`

---

## Typography

### Display (serif)

**Bodoni Moda** (`font-serif` / `--font-display`) — fashion/editorial display for:

- hero and page titles
- build and character names where display type fits
- large numbers or stats when the layout calls for editorial emphasis

### Body & UI (sans)

**Albert Sans** (`font-sans`, `font-sans-wide`) — UI, body, navigation, and wide-tracked meta labels.

### Monospace

**JetBrains Mono** (`font-explorer-mono`) — codes, technical labels, and explorer-style metadata where a mono voice helps.

### Typography Rules

- Display serif is not for long paragraphs; use sans for instructions and dense copy.
- Hierarchy comes from **scale, weight, and spacing** first; color is secondary.
- Avoid overusing **all-caps meta**; use `kyar-meta` and letter-spacing where labels need a studio stamp without shouting.

---

## Layout Principles

### Vertical Rhythm

- Generous top spacing
- Clear section separation
- Content flows vertically

### Grids

- Simple 2-column image grids
- Tall image ratios (3:4 or taller)
- Avoid masonry or uneven grids

### Negative Space

White space is intentional and structural, not decorative.

---

## Imagery

Images are the **primary storytelling element**.

Rules:

- Large hero images
- Minimal cropping
- Neutral backgrounds preferred
- No heavy overlays or badges

Images should feel archival and deliberate.

---

## Navigation

### Bottom Navigation

- Icon + short label (token-colored; **`text-kyar-meta`** for inactive where used)
- Opacity- or weight-based inactive states; active state uses semantic **`kyar-text`** / accent rules
- Predictable placement; see shared **`navConfig`**

Navigation remains visible and predictable on core flows.

---

## Components

### Buttons

- Primary fills use **semantic inverse**: `bg-kyar-text text-kyar-bg` (reads as “primary” in light and dark).
- Variants live on the shared `Button` component; states use tokens, not one-off grays.

### Inputs

- **UnderlineInput** is the default editorial pattern: bottom border, token borders/focus (`kyar-accent` for focus ring where applicable).

### Surfaces

- Prefer **`Surface` / `Panel`** (and selective cards) over a single generic “rounded card everywhere” pattern.

### Checklists

- **ChecklistRow** uses theme tokens for box and fill (`kyar-text` / `kyar-bg`); completion is clear in both themes.

---

## Lists & Planning Screens

- Tasks presented as editorial lists
- Priority shown via order and spacing
- Time metadata secondary

Avoid Kanban or card-heavy layouts.

---

## Offline & Trust Indicators

Trust is communicated visually through:

- stability
- restraint
- clarity

Patterns:

- Subtle offline indicators
- No blocking error modals
- Persistent local state

---

## Motion

- **Product UI:** Short, crisp transitions; respect `prefers-reduced-motion`.
- **Marketing / hero:** Slightly more expressive motion is allowed where it supports perceived quality (see landing hero), not novelty.

Motion exists to confirm actions and continuity; it should not decorate routine forms and lists.

---

## Consistency Across Platforms

Mobile and web may differ in density and navigation, but must preserve:

- the same **token-backed** colors and typography roles
- **theme parity** (light/dark) where the surface exists on both
- calm editorial tone and serious cosplay-studio clarity

Shared reference: `@kyarafit/design-system` (tokens + RN map); web uses CSS variables + Tailwind `kyar.*`.

---

## Summary

Kyarafit should feel like:

> a carefully typeset magazine that happens to be interactive

If a UI choice adds noise, urgency, or visual clutter, it is incorrect.
