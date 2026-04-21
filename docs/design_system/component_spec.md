# Kyarafit – Component Specs (Token-Aligned)

These specs lock the **editorial studio** system in place so UI can scale without drifting. **Semantic OKLCH tokens** (`kyar.*` in Tailwind) replace hard-coded black/white on components.

**Primitives:** `Button`, `UnderlineInput`, `EmptyState`, `PageHeader`, `Surface`, `Panel` (see `web/src/components/ui/`).

## 1) Button

### Variants

- **Primary**: `bg-kyar-text text-kyar-bg` (semantic inverse—works in light and dark)
- **Secondary**: Border/text via `border-kyar-border` / `text-kyar-text`
- **Ghost / text**: Token text colors; underline variants for tertiary actions

### Shape & Spacing

- Radius: Tailwind `rounded-sm` (6px in current theme) unless a variant specifies otherwise
- Height: 52–56px (mobile primary CTA)
- Horizontal padding: 16–24px

### Typography

- Label: Albert Sans (`font-sans` / wide label styles as needed)
- Meta-style labels may use `tracking-wider` / `text-kyar-meta`; avoid all-caps everywhere

### States

- Pressed: `scale 0.98` OR opacity 0.85
- Disabled: opacity 0.25, no shadow
- Focus (web): visible ring/focus styles on `kyar-accent` where applicable

---

## 2) Input (Underline Input)

### Visual

- No box, no rounding
- Bottom border only: `borderWidth.thin`, `colors.borderStrong`
- Background: transparent

### Typography

- Value: Albert Sans 14px (or 16px on larger screens)
- Label: optional uppercase wide label; prefer `text-kyar-meta` over raw gray
- Placeholder: `text-kyar-textMuted` / tertiary tokens

### Behavior

- Focus underline uses `kyar-accent`
- Validation errors do **not** turn the whole field red; instead show:
  - small meta line below in `text-kyar-danger`

---

## 3) Checklist Row

### Visual

- Square or softly rounded per implementation; contrast in **both themes**
- Checkbox border: `border-kyar-borderSubtle` (or stronger as needed)
- Checked state: fill using `kyar-text` / `kyar-bg` pattern for the check affordance

### Typography

- Item text: uppercase, 13px, tracking "wide-ish"
- Optional right code: 9–10px, `colors.textTertiary`

### Interaction

- Entire row is tappable (not just checkbox)
- Completed items may use:
  - subtle line-through OR reduced opacity (0.6)
  - do NOT use bright colors for completion

---

## 4) Card (Editorial Image Card)

### Use Cases

- Closet items
- Build hero
- Itinerary look tile
- "Current focus" featured hero

### Rules

- Images are dominant (no heavy overlays)
- If overlay exists, it's minimal and editorial:
  - small uppercase tag
  - subtle border
  - low-opacity background

### Styling

- Container: `bg-kyar-surface` or `bg-kyar-panel`, border `border-kyar-borderSubtle` when needed
- Shadow: `shadow-soft` / `shadow-card` (theme-aware via `--kyar-shadow`)
- Spacing: generous; avoid dense information blocks

---

## 5) Bottom Navigation

### Layout

- Icon + uppercase label
- Inactive: opacity ~0.30
- Active: opacity 1.0 + small black dot indicator

### Rules

- Never hide nav on core screens
- Keep labels short (see `design-system/navConfig.ts` for canonical ids)

**Web:** `WebSidebar` uses `bg-kyar-panel`, `text-kyar-meta`, and token-aware active states. **Mobile web:** `BottomNav` mirrors the same token pattern.

---

## 6) Floating Action Button (FAB)

### Visual

- **GlobalFAB:** `bg-kyar-text text-kyar-bg`; menu surfaces on `bg-kyar-surface`
- Shadow: `shadow-fab`

### Placement

- Bottom-right above tab bar (~bottom: 112px)

### States

- Pressed: scale 0.95
