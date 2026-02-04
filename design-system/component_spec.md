# Kyarafit – Component Specs (Token-Aligned)

These specs lock the "editorial utility" system in place so UI can scale without drifting.

## 1) Button

### Variants
- **Primary**: Black fill, white text
- **Secondary**: Transparent, black border, black text
- **Text**: No border, underline (used rarely, for "View all" / "Add expense")

### Shape & Spacing
- Radius: `radius.sm` (sharp)
- Height: 52–56px (mobile primary CTA)
- Horizontal padding: 16–24px

### Typography
- Label: `font.family.sansWide`
- Size: 11–12px
- Uppercase, tracking: `tracking.wider`–`tracking.widest`
- Weight: 600–700

### States
- Pressed: `scale 0.98` OR opacity 0.85
- Disabled: opacity 0.25, no shadow
- Focus (web): outline none; border/underline in `colors.accent`

---

## 2) Input (Underline Input)

### Visual
- No box, no rounding
- Bottom border only: `borderWidth.thin`, `colors.borderStrong`
- Background: transparent

### Typography
- Value: Inter 14px (or 16px on larger screens)
- Label: uppercase wide label (11px, tracking wide)
- Placeholder: `colors.textTertiary`

### Behavior
- Focus underline uses `colors.accent`
- Validation errors do **not** turn the whole field red; instead show:
  - small meta line below in `colors.danger`

---

## 3) Checklist Row

### Visual
- Square checkbox, sharp corners
- Checkbox border: hairline/1px black
- Checked state: filled black square inset

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
- Container: white background, minimal border (`colors.borderSubtle`) when needed
- Shadow: only for "stagger image" moments: `shadow.soft`
- Spacing: generous; avoid dense information blocks

---

## 5) Bottom Navigation

### Layout
- Icon + uppercase label
- Inactive: opacity ~0.30
- Active: opacity 1.0 + small black dot indicator

### Rules
- Never hide nav on core screens
- Keep labels short (Home, Closet, Plan, Packing, Studio)

---

## 6) Floating Action Button (FAB)

### Visual
- Black square/near-square
- White add icon
- Sharp radius (`radius.sm`)
- Shadow: `shadow.fab`

### Placement
- Bottom-right above tab bar (~bottom: 112px)

### States
- Pressed: scale 0.95
