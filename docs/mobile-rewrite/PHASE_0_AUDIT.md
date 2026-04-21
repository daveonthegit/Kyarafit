# Kyarafit Mobile Rewrite — Phase 0: Discovery & Audit

> This document is the canonical reference for the mobile rewrite.

---

## 1. Audit Summary

### 1.1 Repository Structure

Kyarafit is an npm-workspaces monorepo with three packages:

| Package          | Stack                                                                | Role                                                      |
| ---------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `web/`           | Next.js 16, React 19, Tailwind 3, Convex, Better Auth, Framer Motion | Web app (source of truth)                                 |
| `mobile/`        | Expo ~55, React Native 0.83, NativeWind v4, Convex, Better Auth      | Mobile app (rewrite target)                               |
| `design-system/` | Shared TS package                                                    | Nav config, types/Zod schemas, Tailwind preset, RN tokens |

Backend: **Convex** (serverless DB + real-time queries/mutations). Auth: **Better Auth** with email/password + Google/GitHub OAuth. Both web and mobile consume the same Convex API.

### 1.2 Current Web App (Source of Truth)

**Tech:** Next.js App Router, Tailwind with `kyar.*` design tokens, Material Symbols icons, Bodoni Moda / Playfair Display / Montserrat / Inter font stack, editorial aesthetic.

**Routes and features:**

| Feature Area     | Web Routes                                                                         | Description                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home/Dashboard   | `/home`                                                                            | Authenticated dashboard with focused build, upcoming events                                                                                         |
| Outfits (Builds) | `/builds`, `/builds/new`, `/build-detail`, `/b/[id]`, `/b/s/[shareToken]`          | List, filter, sort, create, detail (tasks, progress, visual board, reference images, process pictures, collaborators, sharing), public/shared views |
| Closet           | `/closet`, `/closet/new`, `/closet/[id]`                                           | Grid browse, add item, item detail with images                                                                                                      |
| Events           | `/conventions`, `/conventions/new`, `/conventions/[id]`, `.../edit`, `.../packing` | List, create, detail with itinerary/day plans, per-event packing                                                                                    |
| Planner          | `/planner`                                                                         | Calendar-style planning, task aggregation                                                                                                           |
| Groups           | `/groups`, `/groups/new`, `/g/[groupId]`                                           | Group management, members, group convention days                                                                                                    |
| Social           | `/discover`, `/feed`, `/u/[username]`                                              | Discovery feed, following feed, public profiles, follows                                                                                            |
| Settings         | `/settings`, `.../account`, `.../notifications`, `.../subscription`                | Full settings hub with account, notifications, subscription/tier management                                                                         |
| Auth             | `/auth/signin`, `/auth/signup`, `/auth/reset-password`, `/auth/verify-email`       | Full auth flows                                                                                                                                     |
| Creation Modals  | Global modals via `CreationModalsContext`                                          | New build, closet item, convention, group — modal-based creation from anywhere                                                                      |

**Web UI primitives:**

- `SectionCard` — rounded-2xl, subtle border, shadow-soft, uppercase meta titles
- `PageHeader` — Bodoni Moda italic 32–40px titles, sticky with backdrop blur, search, breadcrumbs
- `Button` — Montserrat uppercase, 52px height, sharp corners, black primary
- `BottomNav` — Material Symbols icons, 9px uppercase tracking labels, active indicator bar
- `AdaptiveModal` / `Sheet` — full-viewport overlay / slide-over
- `WebAppShell` — sidebar (desktop) + content container + bottom nav (mobile viewport)
- `GlobalFAB` — floating add button with creation menu
- `UnderlineInput` — minimal underlined text fields
- `ChecklistRow` — square checkboxes, high contrast
- `EmptyState` — consistent empty state pattern
- `ImageCard` — 3:4 ratio images, editorial typography below

**Web design tokens (Tailwind):**

- Colors: `kyar.bg` (#FFF), `kyar.bgWarm` (#FAF9F7), `kyar.accent` (#1152D4), `kyar.text` (#000), opacity-based secondaries
- Fonts: Inter (sans), Playfair Display (serif), Bodoni Moda (serif-elegant), Montserrat (sans-wide)
- Spacing: 4px base unit, generous section gaps
- Shadows: `soft` (20px blur, 5% opacity), `card` (subtle), `fab` (elevated)
- Border-radius: 2px (sm) to 6px (default) — with `rounded-2xl` on cards

### 1.3 Current Mobile App (Rewrite Target)

**Tech:** Expo Router (file-based), NativeWind v4 + Tailwind preset from design-system, Convex, Better Auth, SQLite for offline/local-first, Bottom Sheet Modal.

**Current mobile screens:**

| Screen            | File                      | Status                                                                                |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| Home              | `(tabs)/index.tsx`        | Basic — hero image card, upcoming events carousel, quick links                        |
| Outfits           | `(tabs)/builds.tsx`       | Basic — 2-col grid, status filters, dual-source (cloud/local)                         |
| Closet            | `(tabs)/closet.tsx`       | Basic — 2-col grid, category filters, dual-source                                     |
| Planner           | `(tabs)/planner.tsx`      | Basic — daily/events/calendar tabs; calendar stub                                     |
| Menu              | `(tabs)/menu.tsx`         | Empty placeholder (tab intercept opens bottom sheet)                                  |
| Build Detail      | `build-detail.tsx`        | Most complete screen — edit form, tasks, closet items, progress donut, budget tracker |
| Build New         | `build-new.tsx`           | Form sheet                                                                            |
| Build Link Items  | `build-link-items.tsx`    | Closet item picker                                                                    |
| Add Item (Closet) | `add-item.tsx`            | Camera/gallery + form sheet                                                           |
| Convention Detail | `convention-detail.tsx`   | Day plan, packing, Convex+local                                                       |
| Convention New    | `convention-new.tsx`      | Form                                                                                  |
| Plan (Events)     | `plan.tsx`                | Events list                                                                           |
| Packing           | `packing.tsx`             | Packing checklist per convention                                                      |
| Itinerary         | `itinerary.tsx`           | Itinerary view                                                                        |
| Profile           | `profile.tsx`             | Minimal — name, email, back button                                                    |
| Settings          | `settings.tsx`            | Minimal — sign in/out, placeholder menu rows                                          |
| Auth              | `auth.tsx` → `AuthScreen` | OAuth + email/password + anonymous/local mode                                         |

**Mobile UI components:**

- `Button` — 3 variants (primary/secondary/text)
- `ImageCard` — image + title/subtitle overlay
- `ChecklistRow` — task toggle
- `UnderlineInput` — text input
- `EditorialProgressDonut` — SVG donut chart
- `UnifiedAddFAB` — floating add button + bottom sheet
- `MobileNavMenu` — bottom sheet with nav links

**Mobile styling:** Mix of NativeWind `className` and `StyleSheet.create`. RN tokens from design-system for some components. Inline hardcoded colors/sizes in many screens.

---

## 2. Web-to-Mobile Feature Parity Matrix

| Feature                      | Web                                                                                      | Mobile                                                 | Gap                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Home Dashboard**           | Focused build, upcoming events, stats                                                    | Hero card, events carousel, quick links                | Minor — web has richer content composition                                                          |
| **Builds List**              | Filter/sort/search, status tabs, rich grid                                               | Status tabs, basic 2-col grid                          | **Medium** — no search, no sort options                                                             |
| **Build Detail**             | Visual board, tasks, ref images, process pics, collaborators, sharing, notes, image crop | Tasks, linked items, progress donut, budget, edit form | **Large** — missing visual board, reference images, process pictures, collaborators, sharing, notes |
| **Build Sharing**            | Share token, public build page, collaborator invites                                     | None                                                   | **Critical** — entirely absent                                                                      |
| **Closet Browse**            | Grid, category filters, search                                                           | Grid, category filters                                 | **Small** — no search                                                                               |
| **Closet Item Detail**       | Full detail page with images, metadata                                                   | None (tapping closet item does nothing meaningful)     | **Large** — no detail view                                                                          |
| **Closet Item Create/Edit**  | Modal-based creation, image upload                                                       | Camera/gallery + basic form                            | **Medium** — no edit flow                                                                           |
| **Events (Conventions)**     | List, create, edit, detail with itinerary, packing                                       | List, create, detail, packing                          | **Small** — no edit flow                                                                            |
| **Event Packing**            | Full packing with regeneration, manual add                                               | Packing list, some regeneration                        | **Small**                                                                                           |
| **Planner**                  | Calendar-based planning, task aggregation                                                | Daily list, events list, calendar stub                 | **Medium** — no real calendar                                                                       |
| **Groups**                   | Create, manage, members, convention days                                                 | None                                                   | **Critical** — entirely absent                                                                      |
| **Discover**                 | Public build discovery feed                                                              | None                                                   | **Critical** — entirely absent                                                                      |
| **Feed**                     | Following-based feed                                                                     | None                                                   | **Critical** — entirely absent                                                                      |
| **Public Profiles**          | `/u/[username]` with builds, follow                                                      | None                                                   | **Critical** — entirely absent                                                                      |
| **Follows**                  | Follow/unfollow users                                                                    | None                                                   | **Critical** — entirely absent                                                                      |
| **Build Likes/Comments**     | Like, comment on builds                                                                  | None                                                   | **Critical** — entirely absent                                                                      |
| **Settings — Account**       | Full account management, profile picture                                                 | Placeholder rows only                                  | **Large**                                                                                           |
| **Settings — Notifications** | Notification preferences                                                                 | Placeholder                                            | **Large**                                                                                           |
| **Settings — Subscription**  | Tier management, Stripe                                                                  | Placeholder                                            | **Large**                                                                                           |
| **Tier/Feature Gating**      | `useTier`/`useFeatureAccess`, upgrade prompts                                            | None                                                   | **Large**                                                                                           |
| **i18n**                     | English + Spanish via next-intl                                                          | None                                                   | **Medium**                                                                                          |
| **Search (Global)**          | Per-section search in headers                                                            | Non-functional search icon in closet                   | **Medium**                                                                                          |
| **Creation Modals**          | Global modal system for new entities                                                     | FAB → bottom sheet → navigation                        | **Small** — different pattern, both work                                                            |
| **Image Upload/Crop**        | Client-side resize, crop modal                                                           | Camera picker + resize                                 | **Small**                                                                                           |
| **Build Reference Images**   | Add, remove, reorder reference images                                                    | None                                                   | **Large**                                                                                           |
| **Build Process Pictures**   | Add, remove, reorder WIP photos                                                          | Placeholder stub                                       | **Large**                                                                                           |
| **Offline/Local-first**      | None (cloud-only)                                                                        | SQLite repos + Convex sync                             | **Mobile advantage** — preserve this                                                                |

### Priority tiers:

**P0 (Must-have for rewrite):** Build detail parity, closet item detail, build sharing, settings screens
**P1 (High-value):** Groups, discover, feed, public profiles, search, tier gating
**P2 (Important):** Build reference/process images, calendar planner, i18n, follows, likes/comments
**P3 (Polish):** Event editing, full notification preferences, advanced subscription management

---

## 3. Legacy Mobile Deprecation List

### Files/patterns to DELETE or REPLACE entirely:

| Item                                                   | Reason                                                            | Action                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `app/(tabs)/menu.tsx`                                  | Empty placeholder file                                            | Delete                                                  |
| `app/profile.tsx`                                      | Minimal stub (name + email only)                                  | Replace with full profile screen                        |
| `app/settings.tsx`                                     | Placeholder menu rows, no real functionality                      | Replace with settings hub + sub-screens                 |
| All screens with inline hardcoded colors               | Inconsistent, not using design tokens                             | Replace with token-based styling                        |
| `src/screens/AuthScreen.tsx`                           | Monolithic 500+ line screen                                       | Refactor into modular auth flow                         |
| Dual-source data pattern (cloud/local) in every screen | Copy-pasted in builds, closet, planner — massive duplication      | Extract into reusable hook/pattern                      |
| `src/components/ui/ImageCard.tsx`                      | Functional but styling doesn't match web's `SectionCard` language | Replace/modernize                                       |
| `src/components/layout/MobileNavMenu.tsx`              | Basic bottom sheet nav                                            | Replace with richer menu matching web's mobile nav menu |

### Patterns to RETHINK:

| Pattern        | Current                                       | Proposed                                                       |
| -------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Tab navigation | 5 tabs (Home, Outfits, Closet, Planner, Menu) | Keep 5 tabs but improve Menu → full navigation drawer          |
| Screen headers | Ad-hoc per screen, no shared component        | Create shared `ScreenHeader` matching web's `PageHeader` style |
| Empty states   | Inline `<Text>` with opacity                  | Shared `EmptyState` component matching web                     |
| Loading states | Inline `"Loading…"` text                      | Shared skeleton/loading component                              |
| Filter tabs    | Inline horizontal scrollview per screen       | Shared `FilterTabs` component                                  |
| Section labels | Scattered inline uppercase text               | Shared `SectionLabel` component                                |
| Form inputs    | Mix of raw `TextInput` and `UnderlineInput`   | Standardize on editorial `UnderlineInput`                      |
| List rows      | No shared list row component                  | Shared `ListRow` / `SettingsRow` components                    |

---

## 4. Proposed New Mobile Information Architecture

```
Root Stack
├── Auth Flow (unauthenticated)
│   ├── Sign In
│   ├── Sign Up
│   ├── Reset Password
│   └── Verify Email
│
├── Tab Navigator (authenticated / local mode)
│   ├── Home Tab
│   │   └── Dashboard (focused build, upcoming events, activity feed summary)
│   ├── Outfits Tab
│   │   └── Builds List (filters, search, sort)
│   ├── Closet Tab
│   │   └── Closet Grid (categories, search)
│   ├── Planner Tab
│   │   └── Planner (daily tasks, events, calendar)
│   └── Menu Tab (intercept → drawer/sheet)
│       └── Navigation menu: Events, Groups, Discover, Feed, Profile, Settings
│
├── Detail Stacks (pushed from any tab)
│   ├── Build Detail
│   │   ├── Visual Board
│   │   ├── Tasks
│   │   ├── Linked Items
│   │   ├── Reference Images
│   │   ├── Process Pictures
│   │   ├── Budget Tracker
│   │   ├── Collaborators
│   │   └── Share
│   ├── Closet Item Detail
│   │   └── Edit Item
│   ├── Convention Detail
│   │   ├── Itinerary / Day Plan
│   │   ├── Packing
│   │   └── Edit Convention
│   ├── Group Detail
│   │   ├── Members
│   │   └── Convention Days
│   ├── User Profile (public)
│   │   └── Follow/Unfollow
│   └── Build Public View / Shared View
│
├── Modal Sheets (presented modally)
│   ├── New Build
│   ├── New Closet Item
│   ├── New Convention
│   ├── New Group
│   ├── Link Items to Build
│   ├── Image Picker/Crop
│   └── Filter/Sort Options
│
└── Settings Stack
    ├── Settings Hub
    ├── Account
    ├── Notifications
    ├── Subscription
    └── Profile Edit
```

---

## 5. Proposed Navigation Model

### Bottom Tabs (5)

| Tab | Icon                          | Label   | Destination          |
| --- | ----------------------------- | ------- | -------------------- |
| 1   | home (Material Symbols)       | HOME    | Dashboard            |
| 2   | layers (Material Symbols)     | OUTFITS | Builds list          |
| 3   | checkroom (Material Symbols)  | CLOSET  | Closet grid          |
| 4   | event_note (Material Symbols) | PLANNER | Planner              |
| 5   | menu (Material Symbols)       | MENU    | Opens overflow sheet |

### Tab bar design (matching web `BottomNav`):

- Background: `#F4F4F4`
- Active: black icon + bold black label + top indicator bar
- Inactive: 50% opacity icon + semibold meta-color label
- Labels: 9–10px uppercase, tracking-wide
- Height: 60px + safe area inset
- Icon style: Transition to Material Symbols (matching web) from Ionicons

### Menu Sheet contents:

- Events → `/conventions`
- Groups → `/groups`
- Discover → `/discover`
- Feed → `/feed`
- Profile → `/profile`
- Settings → `/settings`

### Global FAB:

- Floating add button (bottom-right, above tab bar)
- Opens creation sheet: New Outfit, New Item, New Event, New Group
- Hidden on detail screens that have their own contextual actions

### Navigation patterns:

- **Push** for detail screens (back button in header)
- **Modal/Sheet** for creation flows (swipe to dismiss)
- **Replace** for auth → tabs transition
- Preserve Expo Router file-based structure

---

## 6. Web-to-Mobile UI Adaptation Plan

### 6.1 Design Language Translation

The Kyarafit aesthetic is: **editorial, atelier, minimal, confident, calm**. Mobile must preserve this identity.

| Web Pattern                                         | Mobile Adaptation                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Bodoni Moda italic page titles (32–40px)            | Same font, scaled to 28–34px, same italic treatment                                  |
| Montserrat uppercase labels (9–11px, wide tracking) | Same font, same sizing, same tracking                                                |
| Inter body text                                     | Same font                                                                            |
| `SectionCard` (rounded-2xl, shadow-soft, border)    | RN equivalent: `borderRadius: 16`, soft shadow, thin border                          |
| Sticky `PageHeader` with backdrop blur              | Sticky header with blur (use `blurView` or solid bg)                                 |
| Underline inputs                                    | `UnderlineInput` component (already exists, needs polish)                            |
| Black primary buttons (52px, sharp corners)         | Same — full-width variant for mobile forms                                           |
| Material Symbols icons (sidebar/nav)                | Migrate from Ionicons to `@expo/vector-icons/MaterialIcons` or custom icon component |
| Horizontal filter tabs                              | Same pattern — horizontal scroll with underline active indicator                     |
| 2-column grids for builds/closet                    | Same — `FlatList` with `numColumns={2}`                                              |
| Progress bar (thin, black on gray)                  | Same                                                                                 |
| Empty states (centered, minimal)                    | Same pattern                                                                         |
| `Sheet` (slide-over panel)                          | `@gorhom/bottom-sheet` (already in use)                                              |
| `AdaptiveModal`                                     | Full-screen modal or bottom sheet depending on content                               |

### 6.2 Shared Component Plan

New mobile components to build, derived from web equivalents:

| Component        | Web Source                    | Mobile Implementation                                                   |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `ScreenHeader`   | `PageHeader.tsx`              | Bodoni italic title, optional subtitle/search, sticky, safe-area aware  |
| `SectionCard`    | `SectionCard.tsx`             | Rounded card with meta title, action link, consistent padding           |
| `FilterTabs`     | Inline in builds/closet pages | Horizontal scroll, underline active, uppercase labels                   |
| `EmptyState`     | `EmptyState.tsx`              | Icon + message + optional CTA                                           |
| `ListRow`        | Various inline patterns       | Standard row: icon/image + label + chevron                              |
| `SettingsRow`    | Web settings patterns         | Label + value/chevron, consistent spacing                               |
| `SectionLabel`   | Repeated inline pattern       | 9–11px uppercase tracking meta text                                     |
| `MetaLabel`      | Repeated pattern              | Smallest meta text (8–10px, uppercase, wide tracking)                   |
| `Button`         | `Button.tsx`                  | Already exists, needs alignment: Montserrat, 52px height, sharp corners |
| `UnderlineInput` | `UnderlineInput.tsx`          | Already exists, needs polish                                            |
| `ChecklistRow`   | `ChecklistRow.tsx`            | Already exists, needs polish                                            |
| `ImageCard`      | Custom                        | Keep but update styling to match web card language                      |
| `ProgressBar`    | Inline patterns               | Thin bar, black fill on gray track                                      |
| `Avatar`         | Web profile images            | Circular image with fallback initials                                   |
| `Badge`          | Status indicators             | Small pill with status text                                             |

### 6.3 Design Token Usage

Mobile should use design-system tokens consistently:

```typescript
// Import from design-system
import { colors, spacing, layout, font, radius, shadow } from "@kyarafit/design-system/rn";

// Use in components
const styles = {
  container: { padding: layout.screenPaddingX },
  title: { fontFamily: font.family.serifElegant, fontSize: font.size["3xl"] },
  label: { fontFamily: font.family.sansWide, letterSpacing: font.tracking.wide },
  card: { borderRadius: radius.lg, ...shadow.soft },
};
```

Where NativeWind `className` is used, tokens flow through the Tailwind preset. Screens should prefer `className` for layout and use RN tokens for computed/dynamic styles only.

### 6.4 Icon Migration

| Current (Ionicons) | Target                           | Rationale              |
| ------------------ | -------------------------------- | ---------------------- |
| `home-outline`     | Material Symbols `home`          | Match web              |
| `layers-outline`   | Material Symbols `layers`        | Match web              |
| `shirt-outline`    | Material Symbols `checkroom`     | Match web              |
| `checkbox-outline` | Material Symbols `event_note`    | Match web planner icon |
| `menu-outline`     | Material Symbols `menu`          | Match web              |
| `search-outline`   | Material Symbols `search`        | Match web              |
| `chevron-forward`  | Material Symbols `chevron_right` | Match web              |
| `arrow-back`       | Material Symbols `arrow_back`    | Match web              |

**Note:** Complete Ionicons → Material Symbols migration should happen during Phase 1 foundation work.

---

## 7. Phased Execution Plan

### Phase 1: Foundation (Risk: Low)

**Goal:** Establish the new mobile architecture, shared components, and navigation without breaking existing screens.

**Tasks:**

1. Create shared mobile component library (`src/components/shared/`)
   - `ScreenHeader`
   - `SectionCard`
   - `FilterTabs`
   - `EmptyState`
   - `ListRow` / `SettingsRow`
   - `SectionLabel` / `MetaLabel`
   - `ProgressBar`
   - `Avatar`
   - `Badge`
2. Update `Button`, `UnderlineInput`, `ChecklistRow` to match web styling
3. Set up Material Symbols icon system (or a mapping layer)
4. Create `useDataSource` hook to eliminate cloud/local duplication pattern
5. Standardize screen layout template (safe area, scroll, bottom padding)
6. Update tab bar styling to match web `BottomNav`
7. Update Menu sheet to show all navigation destinations
8. Verify design-system token usage is consistent

**Estimated effort:** 3–5 days
**Dependencies:** None
**Risk:** Low — additive work, no existing screen changes

### Phase 2: Core Flow Rebuilds (Risk: Medium)

**Goal:** Replace the highest-value screens with production-quality versions.

**2A: Home Dashboard**

- Rebuild with shared components
- Match web home layout: focused build card, upcoming events, activity summary
- Use `ScreenHeader`, `SectionCard`, `ImageCard`

**2B: Builds (Outfits) List**

- Add search
- Add sort options
- Use shared `FilterTabs`, `ScreenHeader`
- Improve grid cards to match web build cards

**2C: Build Detail**

- Most critical screen — this is where users spend the most time
- Add: reference images section, process pictures section
- Add: sharing (share token, copy link)
- Add: collaborators viewer
- Add: notes section
- Improve: task management UI
- Improve: edit form (use bottom sheet instead of inline toggle)
- Use shared `SectionCard` for each section

**2D: Closet**

- Add search
- Build closet item detail screen (new: `closet-detail.tsx`)
- Build closet item edit flow
- Improve grid cards

**2E: Events (Conventions)**

- Rebuild list with shared components
- Add convention edit flow
- Improve detail/itinerary screen
- Improve packing screen

**2F: Planner**

- Implement real calendar view (replace stub)
- Improve daily task list
- Better events integration

**Estimated effort:** 8–12 days
**Dependencies:** Phase 1 components
**Risk:** Medium — replacing existing screens, need careful testing of data flows

### Phase 3: Feature Parity (Risk: Medium-High)

**Goal:** Add the web features that are entirely missing from mobile.

**3A: Settings Hub**

- Settings hub with sub-screens: Account, Notifications, Subscription
- Profile editing with image upload/crop
- Tier display and upgrade prompts

**3B: Groups**

- Group list, create, detail
- Member management
- Convention day linking
- New screens: `groups.tsx`, `group-detail.tsx`, `group-new.tsx`

**3C: Social/Discovery**

- Discover feed (public builds)
- Following feed
- Public profile view
- Follow/unfollow
- Build likes and comments
- New screens: `discover.tsx`, `feed.tsx`, `user-profile.tsx`

**3D: Tier/Feature Gating**

- Implement `useTier` / `useFeatureAccess` hooks for mobile
- Add upgrade prompts where web has them
- Gate premium features consistently

**Estimated effort:** 8–12 days
**Dependencies:** Phase 2 for navigation and component patterns
**Risk:** Medium-High — new screens + new Convex API integrations

### Phase 4: Polish & Cleanup (Risk: Low)

**Goal:** Remove technical debt, improve quality, verify consistency.

**Tasks:**

1. Remove all deprecated screens/components from deprecation list
2. Eliminate dead code and unused imports
3. Complete Ionicons → Material Symbols migration
4. Add loading skeletons across all screens
5. Improve error states (network errors, auth errors, not-found)
6. Add subtle animations: screen transitions, list item entry, progress changes
7. Verify safe-area handling on all screens
8. Verify keyboard handling on all form screens
9. Test offline mode end-to-end
10. Verify all NativeWind classes resolve correctly
11. Accessibility pass: labels, roles, contrast, tap targets
12. Performance pass: FlatList optimization, image caching, unnecessary re-renders
13. Update mobile README and architecture documentation

**Estimated effort:** 4–6 days
**Dependencies:** Phases 1–3
**Risk:** Low — polish work

---

## 8. Files/Folders Likely to Be Created, Replaced, or Deleted

### Created (new)

```
mobile/src/components/shared/
  ScreenHeader.tsx
  SectionCard.tsx
  FilterTabs.tsx
  EmptyState.tsx
  ListRow.tsx
  SettingsRow.tsx
  SectionLabel.tsx
  MetaLabel.tsx
  ProgressBar.tsx
  Avatar.tsx
  Badge.tsx
  Icon.tsx (Material Symbols mapping layer)

mobile/src/hooks/
  useDataSource.ts (unified cloud/local data hook)
  useTier.ts
  useFeatureAccess.ts

mobile/app/
  closet-detail.tsx (new)
  closet-edit.tsx (new)
  groups.tsx (new)
  group-detail.tsx (new)
  group-new.tsx (new)
  discover.tsx (new)
  feed.tsx (new)
  user-profile.tsx (new)
  settings/ (new folder)
    index.tsx
    account.tsx
    notifications.tsx
    subscription.tsx
  convention-edit.tsx (new)
```

### Replaced (rewrite in place)

```
mobile/app/(tabs)/index.tsx — Home dashboard
mobile/app/(tabs)/builds.tsx — Outfits list
mobile/app/(tabs)/closet.tsx — Closet grid
mobile/app/(tabs)/planner.tsx — Planner
mobile/app/(tabs)/_layout.tsx — Tab layout + styling
mobile/app/_layout.tsx — Root layout
mobile/app/build-detail.tsx — Build detail (major expansion)
mobile/app/settings.tsx — Settings (full rewrite → settings hub)
mobile/app/profile.tsx — Profile (full rewrite)
mobile/app/plan.tsx — Events list
mobile/app/convention-detail.tsx — Convention detail
mobile/app/packing.tsx — Packing
mobile/src/components/ui/Button.tsx — Align with web
mobile/src/components/ui/ImageCard.tsx — Align with web
mobile/src/components/ui/ChecklistRow.tsx — Align with web
mobile/src/components/ui/UnifiedAddFAB.tsx — Styling update
mobile/src/components/layout/MobileNavMenu.tsx — Expand destinations
```

### Deleted

```
mobile/app/(tabs)/menu.tsx — Empty placeholder
mobile/src/screens/AuthScreen.tsx — After refactoring into app/auth/ flow
```

### Preserved (no changes needed)

```
mobile/src/storage/* — SQLite repos (business logic, works well)
mobile/src/services/convexSync.ts — Sync logic (works well)
mobile/src/lib/auth/* — Auth client setup (works well)
mobile/src/lib/deviceId.ts — Device ID logic
mobile/src/lib/imageUtils.ts — Image processing
mobile/src/hooks/useCurrentUser.ts — Convex user hook
mobile/src/hooks/useConvexSync.ts — Sync hook
mobile/convex-stubs/ — Metro resolution stubs
```

---

## 9. Technical Decisions & Constraints

### Keep

- **Expo Router** (file-based routing) — well-suited, team familiar
- **NativeWind v4** — Tailwind classes work well for editorial styling
- **Convex** as primary data layer — same API as web, real-time
- **SQLite offline-first** — valuable mobile-specific capability
- **Better Auth** — same auth as web
- **@gorhom/bottom-sheet** — mature, performant sheet component
- **Design-system package** — shared tokens, types, nav config

### Change

- **Ionicons → Material Symbols** — match web icon system
- **Ad-hoc styling → token-based** — use design-system consistently
- **Per-screen data duplication → shared hook** — `useDataSource` pattern
- **Monolithic screens → composed sections** — smaller, reusable pieces
- **Inline headers → shared ScreenHeader** — consistent page headers

### Watch out for

- **NativeWind v4** class resolution can be inconsistent with complex classes; test each new shared component
- **Font loading** — Playfair Display, Bodoni Moda, Montserrat must be loaded via `expo-font` (verify currently working)
- **Material Symbols on RN** — may need custom font loading or mapped icon component
- **Convex real-time** — heavy subscription usage can impact mobile battery; be selective
- **Bottom sheet + keyboard** — common source of interaction bugs; test thoroughly on forms

---

## 10. Success Metrics

After the rewrite, the mobile app should pass these checks:

- [ ] Every screen uses shared components (ScreenHeader, SectionCard, etc.) instead of ad-hoc layout
- [ ] All colors come from design-system tokens (no hardcoded hex except where tokens are defined)
- [ ] All font usage matches the web font hierarchy (serif titles, sans body, uppercase labels)
- [ ] All features from the P0 tier are fully implemented
- [ ] All features from the P1 tier have at least basic implementations
- [ ] Mobile and web screenshots placed side-by-side look recognizably like the same product
- [ ] No screen has more than 300 lines (extracted into components)
- [ ] No data fetching pattern is copy-pasted between screens
- [ ] All TypeScript types are clean (no `any` except where absolutely unavoidable)
- [ ] Offline mode works end-to-end for core flows
- [ ] Tab bar and navigation match web's mobile bottom nav exactly
