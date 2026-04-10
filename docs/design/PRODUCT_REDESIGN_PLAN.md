# Kyarafit Product Redesign Plan

**Date:** 2026-04-10  
**Scope:** Web + mobile design system and product UX refresh  
**Guiding inputs:** `.impeccable.md`, existing design docs, current implementation critique

## 1. Redesign Goal

Redesign Kyarafit so it feels like a serious cosplay studio tool with fashion-level visual confidence, while remaining fast to scan, dependable in use, and credible for high-frequency planning work.

This is not a "make it prettier" pass. It is a structural redesign that should:

- remove generic SaaS and AI-template signals
- create a distinctive, memorable visual system
- preserve or improve workflow clarity for serious cosplayers
- establish equal-quality light and dark themes
- make imagery useful **and** aspirational

## 2. North Star

Kyarafit should feel like:

- a studio planner when the user is working
- a fashion editorial product when the user is browsing
- a trustworthy operations tool when the user is under convention pressure

If the current UI often feels like "polished prototype," the target should feel like "finished product with taste."

## 3. Non-Negotiables

Derived from project context and critique:

- Primary audience is serious cosplayers first
- Brand personality is studio-practical, fashion-informed, assured
- Light and dark mode are both first-class now
- Images must support both function and visual pop
- WCAG 2.2 AA is the accessibility baseline
- Avoid AI slop patterns: over-carding, empty gradients, generic font stacks, decorative dashboard chrome, trend-chasing effects

## 4. Current-to-Target Shift

| Current | Target | Why |
| --- | --- | --- |
| Polished prototype typography using familiar defaults | Distinctive branded type system with stronger hierarchy | Typography is the fastest way to remove generic feel |
| Reusable rounded cards as the dominant layout unit | A smaller set of layout archetypes with selective surfaces | The product needs composition, not blanket boxing |
| Repeated black image overlays and one-note art direction | Multiple image treatments based on use case | Images should feel intentional, not templated |
| Operations-first chrome with weak brand signature | Productive shell with sharper identity | Kyarafit must feel useful and unmistakable |
| Light-first foundation with dark mode implied | Shared token system with true dual-theme parity | Equal-quality theming must be designed, not inverted later |

## 5. Redesign Principles

### Principle A: Foundation Before Decoration

Do not redesign isolated screens before replacing the underlying type, color, spacing, surface, and motion rules.

### Principle B: Fewer Patterns, Better Patterns

Kyarafit should not have one generic "content card" for everything. It should have a small set of archetypes that match different jobs:

- image-led showcase
- planning list
- status/summary panel
- form/input section
- timeline/schedule block

### Principle C: Motion Must Support Perceived Quality

Animation should improve feel and continuity, not add novelty. Standard product interactions stay crisp and restrained. More expressive motion belongs in hero, preview, and high-value showcase moments only.

### Principle D: Mobile Is Not a Shrunk Web App

The redesign must preserve the same hierarchy and identity across web and mobile, but layouts should adapt to the device context rather than mirror pixel structure.

## 6. Workstreams

The redesign should run across six coordinated workstreams:

1. **Visual Foundation**
   - Typography, color, spacing, surfaces, shadows, borders, radii, motion, theme parity
2. **Product Shell**
   - Navigation, headers, page framing, global actions, shell density, empty/loading/error states
3. **Public Brand Surfaces**
   - Landing page, hero/video treatment, public build detail, promotional previews
4. **Core Workflow Surfaces**
   - Home, builds, build detail, closet, conventions, planner, packing
5. **Mobile Parity**
   - Theme parity, component consistency, layout adaptation, interaction fit
6. **Quality and Verification**
   - Accessibility, responsiveness, performance, visual consistency, reduced motion

## 7. Execution Sequence

## Phase 0: Alignment and Freeze

### Objective

Stop ad hoc visual drift and define what is allowed to change.

### Tasks

- Freeze introduction of new UI patterns until the foundation pass is complete
- Inventory current fonts, tokens, reusable components, and image treatments
- Tag components and screens by redesign priority: `replace`, `rework`, `keep`, `review later`
- Confirm which existing docs remain canonical and which are obsolete

### Deliverables

- Component inventory
- Screen priority list
- Pattern debt list

### Acceptance Criteria

- The team can identify which existing patterns are temporary and should not spread further

## Phase 1: Visual Foundation System

### Objective

Replace the generic prototype foundation with a real brand system.

### Tasks

- Choose a new font pairing that fits "studio-practical, fashion-informed, assured"
- Remove current fallback reliance on Inter / Playfair Display / Montserrat as primary identity carriers
- Replace current color tokens with semantic theme tokens built for light and dark together
- Move palette logic toward perceptual color usage and theme-consistent neutrals
- Define spacing rhythm and section cadence across marketing and app UI separately
- Define a strict surface model:
  - when to use full containers
  - when to use dividers only
  - when to use image-backed blocks
- Define motion rules for:
  - pressed states
  - hover states
  - entrances/exits
  - expanded/collapsed UI
  - reduced motion fallback

### Deliverables

- Updated design tokens
- Updated global CSS/theme variables
- Typography spec
- Surface and spacing rules
- Motion rules

### Acceptance Criteria

- The product no longer reads as a generic template from typography alone
- Light and dark themes both feel designed, not inverted
- New UI work can be built without inventing one-off styles

## Phase 2: Core Primitives Refresh

### Objective

Rebuild the reusable UI layer so downstream screens inherit better taste by default.

### Priority Components

- Button
- Input / UnderlineInput
- Section container primitives
- Labels / metadata text
- Empty state
- Sheet / modal / adaptive modal
- Image card primitives
- Page header
- Responsive grid / content container

### Tasks

- Remove default rounded-card/shadow patterns where they are not serving hierarchy
- Establish tactile press states and refined hover behavior
- Improve type scale and label handling to avoid overuse of uppercase microcopy
- Create at least 3 surface primitives instead of one catch-all card
- Standardize skeleton/loading states and inline error treatment

### Deliverables

- Refreshed shared primitives
- Primitive usage guide

### Acceptance Criteria

- New screens built from primitives already feel closer to the target brand without custom styling

## Phase 3: Product Shell Redesign

### Objective

Make navigation and page framing feel calmer, sharper, and more branded.

### Priority Surfaces

- Web sidebar
- Bottom navigation
- Page header
- Global FAB / create flows
- Settings shell

### Tasks

- Rework navigation so it keeps Linear/Trello clarity without drifting into admin-dashboard energy
- Reduce repetitive uppercase metadata in shell chrome
- Improve active-state language and hierarchy
- Make shell spacing and contrast more intentional in both themes
- Ensure shell behavior works well on long sessions and repeated use

### Deliverables

- Redesigned app shell
- Navigation state rules

### Acceptance Criteria

- The app frame feels like Kyarafit, not a skin on a generic SaaS layout

## Phase 4: Public Brand Surfaces

### Objective

Turn the public-facing product into a strong expression of the brand.

### Priority Screens

- Landing page
- Landing hero
- Device showcase / workflow previews
- Public build detail

### Tasks

- Give the hero stronger asymmetry and stronger art direction
- Make imagery more expressive and less dependent on repeated black overlays
- Clarify value proposition and reduce "generic product site" patterns
- Use motion selectively for premium feel, not spectacle
- Treat public surfaces as the place where image-led decorative pop can be strongest

### Deliverables

- Refreshed public landing system
- Marketing image treatment rules

### Acceptance Criteria

- The landing experience feels memorable and brand-specific within seconds
- Visual pop is present without hurting legibility or comprehension

## Phase 5: Workflow Screen Redesign

### Objective

Bring the core product screens up to the same quality level without slowing task completion.

### Priority Order

1. Home dashboard
2. Builds index
3. Build detail
4. Closet
5. Conventions
6. Planner
7. Packing

### Tasks

- Replace card-heavy compositions with screen-specific layout archetypes
- Increase information clarity through grouping, spacing, and emphasis rather than extra containers
- Differentiate image-led areas from task-led areas
- Improve summary panels, progress handling, and action visibility
- Ensure workflow states are legible under real-world density, not just mock data

### Deliverables

- Updated workflow screens
- Screen archetype library

### Acceptance Criteria

- Users can scan high-value information faster than before
- The screens feel calmer and more premium without becoming sparse or vague

## Phase 6: Mobile Parity and Adaptation

### Objective

Make mobile feel intentionally designed, not merely synchronized.

### Tasks

- Bring mobile onto the same theme and token foundation
- Rework mobile layouts where web assumptions do not hold
- Ensure imagery, actions, and hierarchy translate to smaller screens
- Tune motion and density specifically for handheld use
- Audit touch states and gesture clarity

### Deliverables

- Mobile visual parity pass
- Mobile-specific layout rules

### Acceptance Criteria

- Mobile and web clearly belong to the same product family
- Mobile remains fast and usable under pressure

## Phase 7: Quality Pass

### Objective

Lock in visual quality and remove regressions before declaring the redesign complete.

### Checks

- Accessibility audit against WCAG 2.2 AA
- Reduced motion audit
- Responsive audit across major breakpoints
- Contrast audit in both themes
- Performance review for animation and media-heavy surfaces
- Pattern audit for AI-slap/slop regressions:
  - generic 3-column feature rows
  - overused card shells
  - gradient-heavy image overlays
  - default-ish font fallback behavior
  - decorative effects without purpose

### Deliverables

- QA checklist
- Visual regression review
- Final cleanup pass

### Acceptance Criteria

- The redesign feels cohesive across all major surfaces
- No major screen looks like it belongs to the pre-redesign system

## 8. Concrete First Sprint Recommendation

Start with the smallest set of changes that unlocks the rest of the redesign:

1. Redefine typography and theme tokens
2. Refresh Button, Input, SectionCard replacement primitives, EmptyState, PageHeader
3. Redesign WebSidebar and shell framing
4. Redesign LandingHeroSection and one core logged-in screen as reference implementations

Recommended reference screens:

- **Public:** landing hero
- **Private:** home dashboard

These two screens should set the standard for the rest of the product.

## 9. What Not To Do

- Do not begin with one-off polishing of random feature screens
- Do not keep shipping new screens on the old token foundation
- Do not solve distinct layout problems by making another generic card component
- Do not add visual pop through louder gradients, glow, or trend effects
- Do not treat dark mode as a color inversion pass after the fact

## 10. Success Metrics

The redesign is successful when:

- Kyarafit no longer resembles an attractive prototype or generic SaaS template
- The product has a recognizable visual point of view
- Core workflows remain fast to scan and operate
- Images feel intentionally art-directed instead of repeatedly overlaid
- Light and dark both feel equally authored
- Shared primitives make good design the default rather than the exception

## 11. Recommended Implementation Order for This Repo

- `design-system/` token refresh
- `web/src/app/globals.css`
- `web/src/app/layout.tsx`
- shared web primitives in `web/src/components/ui/`
- shell components in `web/src/components/layout/`
- public surfaces in `web/src/components/landing/` and `web/src/app/page.tsx`
- core app routes in `web/src/app/`
- mirrored mobile updates in `mobile/`

This order minimizes rework and keeps later screen work from drifting away from the new foundation.

---

## 12. Progress Tracker

**Last updated:** 2026-04-10

### Completed

| Phase | Item | Status |
| --- | --- | --- |
| 1 | OKLCH `--kyar-*` token system in `globals.css` (light + dark) | Done |
| 1 | Tailwind `kyar.*` color map wired to CSS variables | Done |
| 1 | Font stack: Albert Sans (body) + Bodoni Moda (display) + JetBrains Mono | Done |
| 1 | Root layout inline theme script (`kyar-theme` localStorage, `data-theme`, `html.dark`) | Done |
| 1 | `design_tokens.json` v0.2 reference palette | Done |
| 2 | `Button` — all variants on semantic tokens | Done |
| 2 | `EmptyState` — semantic tokens | Done |
| 2 | `UnderlineInput` — semantic tokens | Done |
| 2 | `Surface` + `Panel` primitives created | Done |
| 2 | `PageHeader` — typography + token refresh | Done |
| 3 | `WebSidebar` — `bg-kyar-panel`, `kyar-meta`, wordmark, active states | Done |
| 3 | `BottomNav` — same token pattern as sidebar | Done |
| 3 | `GlobalFAB` — `bg-kyar-text text-kyar-bg`, menu on `kyar-surface` | Done |
| 3 | Settings shell — theme/locale pills on `kyar-text`/`kyar-surface` | Done |
| 4 | `LandingHeroSection` — asymmetric layout, motion, token-aware | Done |
| 4 | `LandingSiteHeader` — theme toggle, mix-blend header | Done |
| 4 | Landing mini previews — Builds/Elements/Conventions/Tasks on `kyar-*` | Done |
| 4 | `LandingMiniAppFrame` — fully semantic shell | Done |
| 4 | `ChecklistRow` — `kyar-text`/`kyar-bg` checkbox tokens | Done |
| 5 | `home/page.tsx` — hero chip, cards, progress bars on `kyar-*` | Done |
| 5 | `elements/page.tsx` — shared filter class, card tokens, select `color-scheme` | Done |
| - | `ThemeContext` + `ThemeToggle` (sidebar + header variants) | Done |

---

## 13. Next Phases — Concrete Execution Plan

The foundation (Phase 1), core primitives (Phase 2), product shell (Phase 3), and public brand surfaces (Phase 4) are substantially complete. The next work focuses on **workflow screen hardening** (Phase 5), **mobile parity** (Phase 6), **modal/sheet system** (cross-cutting), and the **quality pass** (Phase 7).

### Next Sprint A: Modal & Sheet Surface System

**Why first:** Modals are the single largest source of remaining `bg-white` / `text-gray-*` / `bg-black` patterns. Every build, convention, and closet flow opens at least one modal. Fixing the modal primitives once fixes dozens of downstream instances.

**Scope:**

1. **`BuildDetailModalShell`** — Replace `bg-white` panel + `bg-black/50` backdrop with `bg-kyar-surface` + `bg-kyar-text/50` (or a new `kyar-overlay` token)
2. **`BuildSummaryModal`** — Same surface swap; buttons `bg-kyar-text text-kyar-bg`
3. **`BuildReferenceImagesSection`** modal — `bg-kyar-surface`, border tokens
4. **`BuildProcessPicturesSection`** modal — Same pattern
5. **`LinkClosetItemsForm`** modal/sheet — Replace `bg-white`, `text-gray-*`, `border-gray-*`
6. **Convention detail `[id]/page.tsx`** inline modals — `bg-white rounded-3xl` → `bg-kyar-surface`
7. **Shared sheet/modal primitive** — If no reusable `<Sheet>` or `<Modal>` wrapper exists, create one that enforces `bg-kyar-surface border-kyar-borderSubtle` and trap-focuses correctly

**Acceptance:** Every modal in builds + conventions uses `kyar-surface` and has correct contrast in both themes.

### Next Sprint B: Builds Index & Detail

**Why:** Builds is the highest-traffic workflow screen. It has the most `bg-black`, `text-white`, `hover:bg-black`, `border-black` patterns outside of modals.

**Scope:**

1. **`builds/page.tsx`** (index)
   - Filter chips: `bg-kyar-text text-kyar-bg` (selected), `bg-kyar-surface text-kyar-textSecondary` (inactive)
   - Search input: `bg-kyar-surface`, `placeholder:text-kyar-textMuted`
   - Grid cards: Keep photo overlays (`from-black/60 text-white`) as editorial-on-media — these are intentional
   - Status badges, hover states, links → replace `hover:text-black` with `hover:text-kyar-text`
   - Checkbox circles on cards → `border-kyar-borderSubtle bg-kyar-text/20` instead of `border-white/50 bg-black/20`
2. **`builds/new/page.tsx`** — Form inputs on semantic tokens
3. **Build subcomponents** (`components/builds/`)
   - `TaskChecklist` — Replace `text-gray-*` with `text-kyar-textTertiary`/`kyar-textSecondary`
   - `BuildDetailFab` — `bg-kyar-surface` instead of `bg-white`
   - `BuildSummarySection` — Replace `bg-white`, `bg-black` blocks
   - `WorkflowTree` — Token-ize node colors and connectors
   - `BuildNodeManagerSection` — Replace `bg-white` panels

**Acceptance:** Builds index and detail render correctly in both themes. No `bg-white` or `bg-black` on surfaces (photo overlays excluded).

### Next Sprint C: Conventions Index, Detail & Packing

**Why:** Conventions is the second core workflow and shares many of the same patterns as builds.

**Scope:**

1. **`conventions/page.tsx`** (index) — Same chip/search/card token sweep as builds
2. **`conventions/[id]/page.tsx`** (detail)
   - Timeline day dots: `bg-kyar-text text-kyar-bg` (already done in landing preview, apply to real page)
   - Buttons: `bg-kyar-text text-kyar-bg` instead of `bg-black text-white`
   - Modal panels: Follow Sprint A modal system
3. **`conventions/[id]/packing/page.tsx`**
   - Primary actions: `bg-kyar-text text-kyar-bg`
   - Input fields: `bg-kyar-surface`
   - `PackingItemRow` — Replace `bg-white`, `bg-black`, `hover:text-black`
4. **`conventions/[id]/edit/page.tsx`** — Form token sweep
5. **`conventions/new/page.tsx`** — Form token sweep

**Acceptance:** All convention pages render correctly in both themes.

### Next Sprint D: Mobile Nav & Responsive Gaps

**Why:** `MobileNavMenu` is hard-coded for light theme only. Dark-mode users see wrong colors on the slide-out menu.

**Scope:**

1. **`MobileNavMenu.tsx`**
   - Replace `text-black` → `text-kyar-text`
   - Replace `bg-black` underline → `bg-kyar-text`
   - Replace `focus-visible:ring-offset-[#F4F4F4]` → `focus-visible:ring-offset-kyar-bg`
   - Replace `hover:bg-black/5` → `hover:bg-kyar-muted`
2. **Any remaining mobile-specific components** — Audit for same class of issues
3. **Responsive audit** — Verify all token-ized screens at `sm`, `md`, `lg`, `xl` breakpoints in both themes

**Acceptance:** Mobile menu works in dark mode. No light-only hardcoded values remain in layout components.

### Next Sprint E: Theme-Aware Shadows & Polish

**Why:** `tailwind.config.js` shadows (`soft`, `card`, `fab`) use fixed `rgba(23,22,41,…)` — they look correct on light backgrounds but don't adapt for dark mode.

**Scope:**

1. **Tailwind shadow tokens** — Replace `rgba(23,22,41,…)` with CSS custom properties:
   ```css
   --kyar-shadow-color: 23 22 41;
   /* dark: */ --kyar-shadow-color: 0 0 0;
   ```
   Then reference in Tailwind: `rgba(var(--kyar-shadow-color) / 0.04)` etc.
2. **Settings page** — Map `hover:bg-red-500/10` to `hover:bg-kyar-danger/10` for consistency
3. **Landing hero** — Evaluate whether `bg-[#0A0A0A]` video well should become `bg-kyar-text` or remain intentionally fixed
4. **`ThemeToggle` header variant** — If landing header changes from `mix-blend-difference`, update white-on-blend to semantic tokens
5. **`calendar.tsx`** — Replace remaining `text-black`, `bg-black`, `data-[selected]:text-white` with kyar tokens

**Acceptance:** Shadows feel right in dark mode. No one-off color escape hatches remain.

### Next Sprint F: Quality Pass (Phase 7)

**Scope:**

1. **Automated grep sweep** — `rg "bg-white|bg-black|text-white|text-black|text-gray-|bg-gray-|border-black|border-white|border-gray-" web/src/` excluding:
   - Photo overlays (`from-black/` on images: intentional)
   - `mix-blend-difference` contexts
   - Remotion/video canvas backgrounds
2. **Accessibility audit**
   - Contrast ratios in both themes (use axe-core or Lighthouse)
   - Keyboard focus visibility on all interactive elements
   - `aria-*` labels on custom controls (FAB split button, filter chips, modals)
   - Reduced motion: verify `prefers-reduced-motion` disables landing parallax, scroll-linked animations
3. **Responsive audit** — All core pages at 375px, 768px, 1024px, 1440px
4. **Performance review**
   - Landing page: check LCP, CLS from hero video/images
   - Build detail: check for unnecessary re-renders from modal state
   - Convention packing: verify checklist toggle responsiveness under load
5. **AI-slop regression check** (per Phase 7 criteria):
   - No generic 3-column feature grids
   - No overused uniform card shells
   - No gradient-heavy overlays without purpose
   - No decorative effects that don't serve hierarchy

**Acceptance:** The redesign feels cohesive across all major surfaces. No screen looks like it belongs to the pre-redesign system.

---

## 14. Execution Priority Summary

| Priority | Sprint | Est. scope | Key risk |
| --- | --- | --- | --- |
| **P0** | A — Modals & sheets | ~8 components | High impact: every workflow opens modals |
| **P0** | B — Builds index + detail | ~10 files | Highest-traffic workflow |
| **P1** | C — Conventions + packing | ~8 files | Second workflow; shares builds patterns |
| **P1** | D — Mobile nav + responsive | ~3 files | Dark mode broken for mobile menu |
| **P2** | E — Shadows, polish, calendar | ~5 files | Low risk, high polish value |
| **P2** | F — Quality pass | Full audit | Catches regressions before declaring done |

**Dependency chain:** A → B → C (modals must be fixed before builds/conventions since they use them). D and E can run in parallel with B/C. F is the final gate.
