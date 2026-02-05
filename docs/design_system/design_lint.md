# Kyarafit – Design Lint Checklist (Anti-Drift)

Run this checklist whenever a new screen/component is added.

## Typography

- [ ] Screen titles use **serif display/elegant**, not Inter
- [ ] Body text uses Inter (or system sans), not serif
- [ ] Meta labels are uppercase with wide tracking
- [ ] Hierarchy is primarily spacing + font changes, not color

## Color

- [ ] Background is white/off-white; no dark themes unless explicitly designed
- [ ] Only **one accent color** is used (kyar.accent)
- [ ] No gradients, no neon, no multi-accent UI
- [ ] Secondary text uses opacity, not random grays

## Shapes

- [ ] Corners are sharp or minimally rounded (radius.sm)
- [ ] Inputs are **underline-only** (no boxed fields)
- [ ] Checkboxes are square (no rounded toggles)

## Layout

- [ ] Generous padding (24–32px typical)
- [ ] Clear vertical rhythm: sections separated with space or thin dividers
- [ ] Grids are simple (2-col, consistent gaps), not masonry

## Components

- [ ] Primary CTA is black fill, uppercase wide label
- [ ] FAB is black square with +, placed above bottom nav
- [ ] Bottom nav uses opacity inactive + active dot

## Imagery

- [ ] Images are primary content; UI chrome never competes with images
- [ ] Overlays are minimal and editorial (no big gradients on images)
- [ ] Thumbnails/crops feel intentional (avoid random cropping)

## Motion

- [ ] Animations are subtle (opacity/translation)
- [ ] No playful bounces, no heavy parallax, no decorative motion

## Trust / Offline

- [ ] Offline state never blocks usage
- [ ] Sync messaging is calm ("will sync when online"), no panic modals
- [ ] Export/backup is discoverable (Settings/Data Management)

## "If this happens, stop and fix"

- [ ] The UI starts to look like a generic productivity app
- [ ] You add colorful chips/badges everywhere
- [ ] You add boxed inputs or rounded pill buttons
- [ ] Screens feel cramped or visually loud
