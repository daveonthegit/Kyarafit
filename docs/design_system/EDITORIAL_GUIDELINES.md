# Kyarafit Editorial Design Guidelines

Kyarafit is a premium cosplay project workspace. It is **not** a generic productivity app or a bland CRUD dashboard. It sits at the intersection of cosplay project planning, visual inspiration, costume progress tracking, materials organization, and build collaboration.

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

We use a specific combination of serif and sans-serif fonts to achieve the editorial feel.

- **Serif (Playfair Display):** Used for major headings, build names, and large numbers (e.g., percentages, budgets). It provides the "fashion magazine" feel.
- **Sans-Serif (Inter / Montserrat):** Used for UI elements, meta-text, body copy, and functional labels.

### Usage Rules

- **Display Typography:** Use Serif for big moments (H1s, Hero sections).
- **Meta Typography:** Use small, uppercase, widely tracked (letter-spaced) Sans-Serif for labels, section headers, and metadata (e.g., `text-[9px] uppercase tracking-widest text-kyar-textTertiary`).

---

## Color System

The color palette is restrained to let the user's imagery shine. We use a monochrome base with subtle borders and a single accent color.

- **Backgrounds:** Pure white (`#FFFFFF`) or very subtle off-white/muted (`#F9F9F9`) for differentiation.
- **Text:** High contrast black (`#000000`) for primary text, with alpha variations for secondary (`60%`) and tertiary (`40%`) text.
- **Borders:** Extremely subtle. Avoid heavy boxes. Use `rgba(0,0,0,0.10)` or `rgba(0,0,0,0.05)`.
- **Accent:** A specific, elegant blue (`#1152D4`).

---

## Shape & Structure

- **Borders & Radii:** We use soft, elegant rounded corners to create a polished, modern feel. The default border-radius for larger cards and surfaces is `16px` (`2xl` in Tailwind), with interactive elements like checkboxes, small action buttons, and pills using fully rounded shapes (`full`).
- **Lines & Separators:** Use thin, crisp lines (`1px` or hairline) to separate content, often full-bleed or deliberately inset to create structure.
- **Shadows:** Use soft, diffused shadows (`shadow-soft`) to gently elevate cards and floating action bars above the background, avoiding harsh or dark drop shadows.
- **Spacing:** Generous spacing. Use large gaps between distinct sections to let the content breathe.

---

## Cross-Platform Adaptation (Web vs. Mobile)

**Crucial:** "Mobile Parity" does not mean identically copying the web UI. We adapt the premium editorial language into **mobile-native paradigms**.

### Web

- **Layout:** Spacious, multi-column (e.g., 3 columns on build detail), masonry grids for visual boards.
- **Interactions:** Hover states are critical. Drag-and-drop is expected for organizing items and assigning tasks.
- **Navigation:** Sidebar for desktop, top bar for global actions.

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

- Checkboxes should be `rounded-full` to fit the softer aesthetic.
- Form inputs often look best with an underline style (`border-b`) or as fully rounded pills depending on context.

### Progress Visualization

- **Editorial Donut:** A thin-stroked, elegant circular progress indicator (implemented as `EditorialProgressDonut`).
- **Rail Progress:** Thin vertical or horizontal bars instead of chunky progress bars.

### Section Headers

- Small, uppercase, widely tracked text. Often paired with a thin top or bottom border to anchor the section.
