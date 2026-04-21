# Kyarafit Editorial Design Guidelines

Kyarafit is a premium cosplay project workspace. It is **not** a generic productivity app or a bland CRUD dashboard. It sits at the intersection of cosplay project planning, visual inspiration, costume progress tracking, materials organization, and build collaboration.

**Implementation source of truth:** OKLCH semantic tokens (`--kyar-*`), Tailwind `kyar.*`, and [`../design/PRODUCT_REDESIGN_PLAN.md`](../design/PRODUCT_REDESIGN_PLAN.md) for phased UX direction.

## Design Philosophy: The Cosplay Studio

The app should feel like a curated cosplay build studio and a visual planning workspace.
Users should feel like they are working inside a premium, creative environment.

### Core Traits

- **Premium & Editorial:** High-quality typography, intentional whitespace, elegant layout.
- **Image-Forward:** Content is led by imagery (references, progress photos, material shots).
- **Clean but not sterile:** It has character without being cluttered.
- **Fashion/Cosplay-oriented:** The aesthetic nods to lookbooks, fashion magazines, and creative portfolios.
- **Practical:** It must be usable for real-world tracking (budgets, tasks, timelines).

### Anti-Goals

- DO NOT make it look like a SaaS admin dashboard.
- DO NOT use generic, rounded, bubbly, or "tech-startup" UI patterns everywhere unless they serve the premium feel.
- DO NOT sacrifice usability for aesthetics (e.g., contrast must remain accessible).

---

## Typography

We pair a **fashion display serif** with a **neutral, legible sans** and a **mono** for technical moments.

- **Bodoni Moda (display / serif):** Major headings, hero lines, and display moments that should feel editorial—not long body copy.
- **Albert Sans (sans):** UI chrome, body copy, navigation, and most labels.
- **JetBrains Mono (`font-explorer-mono`):** Codes, compact technical labels, and “explorer” metadata where monospace improves scanability.

### Usage Rules

- **Display:** Use `font-serif` / Bodoni for hero and page titles, build names on marketing-heavy surfaces, and large stats when the layout is image-led.
- **Meta:** Prefer `text-kyar-meta` with restrained tracking over stacking uppercase everywhere. Example: `text-xs tracking-meta text-kyar-meta`.

---

## Color System

The palette is **semantic and dual-theme**: warm neutrals and ink tones are authored for **light and dark** together (`design_tokens.json` + `globals.css`). Let user photography stay the star; UI chrome stays quiet.

- **Surfaces:** `kyar-bg`, `kyar-surface`, `kyar-panel`, `kyar-muted` — pick the minimum surface needed; avoid boxing every row in a card.
- **Text:** `kyar-text`, `kyar-textSecondary`, `kyar-textTertiary`, `kyar-textMuted`, `kyar-meta`.
- **Borders:** `kyar-border`, `kyar-borderSubtle`, `kyar-cardBorder`.
- **Accent:** `kyar-accent` / `kyar-accentSoft` for links, focus, and single-accent emphasis.
- **Danger:** `kyar-danger` for destructive actions and validation errors (supporting text, not whole-field paint).

Do not rely on **pure `#000` / `#FFF`** for component surfaces; use tokens so dark mode stays legible.

---

## Shape & Structure

- **Radii:** Default interactive and surface rounding follows the Tailwind theme (`rounded-sm` = 6px for many controls; larger radii for marketing cards when intentional). Prefer **a small set of layout archetypes** (image-led showcase, planning list, summary panel) over one generic card for everything.
- **Lines & Separators:** Thin `border-kyar-borderSubtle` dividers or inset rules; full-bleed when separating major sections.
- **Shadows:** `shadow-soft`, `shadow-card`, `shadow-fab` — backed by `--kyar-shadow` for theme-aware elevation.
- **Spacing:** Generous vertical rhythm; separate sections with space or a single clear divider—not nested boxes by default.

---

## Cross-Platform Adaptation (Web vs. Mobile)

**Crucial:** "Mobile Parity" does not mean identically copying the web UI. We adapt the premium editorial language into **mobile-native paradigms**.

### Web

- **Layout:** Spacious, multi-column where it helps (e.g., build detail); image grids stay simple and intentional.
- **Interactions:** Hover states are critical on desktop. Drag-and-drop where implemented for organizing items and assigning tasks.
- **Navigation:** Sidebar (`WebSidebar`) on large viewports; **BottomNav** below `lg`; **GlobalFAB** + add menus for creation flows (see `navConfig.ts`).

### Mobile

- **Layout:** Vertical stacking, but preserving the spaciousness. Use horizontal scrolling (carousels) or masonry grids where appropriate for imagery.
- **Interactions:** Tap, long-press, and swipe. **No hover states.**
- **Touch Targets:** Minimum 44x44pt for interactive elements.
- **Modals vs. Sheets:** Use **Bottom Sheets** (e.g., `@gorhom/bottom-sheet`) instead of full-screen modals for task assignment, filtering, and creation flows. Bottom sheets feel more native and elegant on iOS/Android.
- **Navigation:** Native-feeling bottom tab bar and header, but styled with our custom typography and colors.

---

## The "Omni-Create" Pattern (Unified Add Actions)

To avoid scattered and confusing creation flows, we use a Unified Add Action pattern across both platforms.

### Web

- **Global Add:** The `WebTopBar` contains an `AddContextMenu` that allows creating any entity (Outfit, Material, Event) from anywhere in the app.
- **Mobile-Web:** A floating FAB (`FloatingAdd`) in the bottom right serves the same purpose.

### Mobile (React Native)

- **Global Add:** Implement a unified "Add" button (either a FAB or a central Tab Bar button) that opens a sleek **Bottom Sheet**.
- **Bottom Sheet Content:** Presents clear, elegant options to "Create Outfit", "Add Closet Item", or "Add Event".
- **Benefit:** Reduces navigation friction and makes the app feel like a cohesive workspace rather than isolated tabs.

---

## Specific Component Guidelines

### Layout & Detail Pages

- **Split-Screen Editorial:** Detail pages (Closet Item, Build, Convention) should use a split-screen grid (`lg:grid-cols-[minmax(0,400px)_1fr]`). The left column should feature a large, sticky image container. The right column should be scrollable and contain all details, data, and tasks.
- **Fixed Action Bars:** To keep headers clean, use floating, fixed action bars at the bottom of the screen (or bottom of the detail container) for primary page-level actions (e.g., Update Progress, Edit, Share).
- **Home Dashboard:** Use a "Bento Box" style asymmetrical grid. Eliminate scrolling on the main page wrapper if possible (`h-[100dvh]`, `overflow-hidden`), utilizing horizontal scrolling carousels inside specific grid areas (like Upcoming Events or Projects).

### Image Cards (Visual Boards)

- **Poster Style:** On list pages (Builds, Conventions, Closet), cards should ideally be unified with the image filling the background, a bottom gradient overlay for readability, and text information (Title, Character, Status) overlaid directly on the image, creating a cinematic/poster effect.
- Images should fill their containers (aspect ratios like 3:4, 4:3, or 1:1 depending on context).
- Empty states should look intentional, not broken.

### Inputs & Forms

- Default editorial pattern: **UnderlineInput** (`border-b`, token borders).
- Checkboxes and toggles use token colors for border/fill; shape follows the shared row component (**ChecklistRow**), not ad-hoc grays.

### Progress Visualization

- **Editorial Donut:** A thin-stroked, elegant circular progress indicator (implemented as `EditorialProgressDonut`).
- **Rail Progress:** Thin vertical or horizontal bars instead of chunky progress bars.

### Section Headers

- Small, uppercase, widely tracked text. Often paired with a thin top or bottom border to anchor the section.
