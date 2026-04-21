# Kyarafit – Design Lint Checklist (Anti-Drift)

Run this checklist whenever a new screen or component is added. **Verify in both light and dark** (`data-theme` / `.dark` / user toggle).

**Canonical direction:** [`../design/PRODUCT_REDESIGN_PLAN.md`](../design/PRODUCT_REDESIGN_PLAN.md).

## Typography

- [ ] Display titles use **Bodoni Moda** (`font-serif` / display role), not generic sans
- [ ] Body and UI use **Albert Sans** (`font-sans`), not display serif
- [ ] Mono labels use **JetBrains Mono** only where appropriate (`font-explorer-mono`)
- [ ] Meta labels use `text-kyar-meta` / tracking helpers; avoid all-caps wall-to-wall
- [ ] Hierarchy is primarily spacing + scale + weight, not random color

## Color

- [ ] Surfaces use **`kyar-*`** classes (`bg-kyar-bg`, `bg-kyar-surface`, `bg-kyar-panel`, …), not raw `white`/`black`/`gray-*` on app chrome
- [ ] Text uses **`text-kyar-text`** (and secondary/tertiary/muted roles), not ad-hoc grays
- [ ] Primary actions use the **semantic inverse** pattern where applicable: `bg-kyar-text text-kyar-bg`
- [ ] One accent family: **`kyar-accent`** / **`kyar-accentSoft`** for links, focus, emphasis
- [ ] Destructive actions use **`kyar-danger`**, not generic `red-*`
- [ ] Contrast meets **WCAG 2.2 AA** in **both** themes for text and interactive controls

## Shapes

- [ ] Radii align with the shared scale (`rounded-sm` default for many controls unless spec says otherwise)
- [ ] Primary form controls in editorial flows prefer **UnderlineInput** over boxed fields
- [ ] Checklists use shared **ChecklistRow** / tokenized checkbox styling

## Layout

- [ ] Generous padding (24–32px typical mobile; scale up on `lg`)
- [ ] Clear vertical rhythm: sections separated with space or `border-kyar-borderSubtle`
- [ ] Grids are simple and intentional (avoid random masonry unless designed)
- [ ] Prefer **Surface** / **Panel** / layout archetypes over a single catch-all card

## Components

- [ ] Buttons use shared **`Button`** variants on tokens
- [ ] **FAB** uses `bg-kyar-text text-kyar-bg`; menus on `bg-kyar-surface`
- [ ] **Bottom nav** uses the same token language as the sidebar (inactive/active readable in both themes)
- [ ] Modals / sheets target **`bg-kyar-surface`**, backdrop tokenized (e.g. `bg-kyar-text/50`)—no stray `bg-white` panels

## Imagery

- [ ] Images lead; UI chrome does not compete
- [ ] Image overlays are **intentional** (e.g. editorial gradient on photo)—not default heavy black slabs on every tile
- [ ] Thumbnails and crops feel deliberate

## Motion

- [ ] Transitions are short and purposeful; **`prefers-reduced-motion`** respected on marketing motion
- [ ] No decorative parallax on dense task UIs

## Trust / Offline

- [ ] Offline state never blocks usage
- [ ] Sync messaging is calm ("will sync when online"), no panic modals
- [ ] Export/backup is discoverable (Settings/Data Management)

## "If this happens, stop and fix"

- [ ] The UI starts to look like a generic SaaS dashboard or AI template
- [ ] New screens only work in one theme
- [ ] You add `text-gray-*`, `bg-white`, or `border-black` on app surfaces instead of tokens
- [ ] Screens feel cramped, loud, or card-stacked with no hierarchy
