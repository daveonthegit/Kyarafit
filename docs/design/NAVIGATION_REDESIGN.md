# Navigation Redesign — Kyarafit / OutfAI

**Branch:** `design/navigation-redesign`  
**Date:** 2026-03-06

## 1. Problems with the old navigation

### Web (Next.js)

- **Unclear labels:** "Todo" pointed to `/planner` (task list); "Builds" was jargon—users think "Outfits."
- **Buried features:** Closet had no top-level nav item; it shared the "Builds" active state when on `/closet`. Settings lived only in the top bar (menu icon).
- **Duplicate logic:** Active section was derived in both `WebAppShell` and `WebSidebar` with the same pathname checks.
- **Missing context:** No breadcrumbs on detail pages. "Where am I?" was answered only by page content.
- **Deprecated routes:** `/packing` and `/itinerary` are deprecated; navigation does not link to them. Add action was a single fixed link (e.g. to `/closet/new`) instead of contextual or a menu.

### Mobile (Expo Router)

- **Mismatch with web:** Tabs were Home, Builds, **Plan** (conventions), **Packing**. Web had Home, Builds, **Todo** (planner), **Events**. "Plan" on mobile = conventions; "Todo" on web = planner—same words, different sections.
- **Closet not in tabs:** Closet was a stack screen only; no one-tap access.
- **Settings not in tabs:** Settings was a stack screen (menu from Home header); no Profile tab.
- **No shared nav config:** `design-system/navConfig.ts` was used only on web; mobile tabs were defined manually with different IDs and labels.

### Cross-cutting

- No single source of truth for section list or labels across web and mobile.
- Packing was a top-level tab on mobile while packing is event-specific (reachable from convention detail).

---

## 2. New navigation structure

### Information architecture

| Section  | Purpose                      | Web path       | Mobile (tabs)       |
| -------- | ---------------------------- | -------------- | ------------------- |
| Home     | Dashboard / overview         | `/home`        | `index` (Home)      |
| Outfits  | Cosplay builds               | `/builds`      | `builds` (Outfits)  |
| Closet   | Owned clothing items         | `/closet`      | `closet` (Closet)   |
| Events   | Conventions, meetups         | `/conventions` | `plan` (Events)     |
| Planner  | Daily tasks / build progress | `/planner`     | Stack (from Home)   |
| Settings | Account, preferences         | `/settings`    | `profile` (Profile) |

**Desktop (web):** Left sidebar: Home, Outfits, Closet, Events, Planner; divider; Settings. Top bar: logo, Add context menu. Bottom nav (mobile viewport): Home, Outfits, Closet, Events, Profile (5 tabs).

**Mobile (Expo):** Bottom tabs: Home, Outfits, Closet, Events, Profile. Planner and Packing are stack screens (Packing only via convention detail; no link to deprecated `/packing` or `/itinerary`).

---

## 3. Reasoning behind the information architecture

- **Outfits over Builds:** Label aligns with user mental model (cosplay outfits).
- **Closet as top-level:** Closet is a core resource; it deserved its own nav item instead of being folded under Builds.
- **Events over Plan:** "Events" matches web and avoids confusion with "Planner" (tasks).
- **Planner in sidebar, not in mobile tabs:** Keeps mobile tabs to five high-use areas; Planner remains accessible from Home or stack.
- **Profile tab:** Puts account/settings one tap away on mobile.
- **Add as context menu:** One Add control (top bar + FAB) opens a menu (Add outfit / Add item / Add event) so users can add from anywhere without a contextual button per section.
- **Deprecated routes:** `/packing` and `/itinerary` are not linked from nav; packing is only via convention detail (e.g. `/conventions/[id]/packing`).

---

## 4. Implementation summary

### Design system (`design-system/navConfig.ts`)

- **NAV_SECTIONS_PRIMARY:** Home, Outfits, Closet, Events, Planner.
- **NAV_SECTION_SETTINGS:** Settings (path `/settings`).
- **NAV_SECTIONS_BOTTOM:** Home, Outfits, Closet, Events, Settings (for mobile bottom nav; last item shown as "Profile").
- **getActiveSection(pathname):** Centralized pathname → section id; used by WebAppShell, WebSidebar, BottomNav.
- **ADD_MENU_ITEMS:** Add outfit → `/builds/new`, Add item → `/closet/new`, Add event → `/conventions/new`.

### Web

- **WebSidebar:** Renders primary sections, divider, then Settings; uses `getActiveSection` and design tokens.
- **WebTopBar:** Logo + Add context menu (dropdown). Settings removed from top bar (moved to sidebar).
- **BottomNav:** Uses `NAV_SECTIONS_BOTTOM`; last item labeled "Profile" via i18n.
- **FloatingAdd:** Opens same Add context menu (no per-page `href`).
- **AddContextMenu:** Shared component (top bar and FAB variants) with click-outside to close.

### Mobile

- **Tabs:** Home, Outfits, Closet, Events, Profile (5 tabs). Plan tab renamed to "Events"; Packing removed from tab bar.
- **Packing:** Moved from `(tabs)/packing.tsx` to `app/packing.tsx` (stack screen). Links from convention detail use `/packing` with params.
- **Closet tab:** New `(tabs)/closet.tsx` with closet list and tab-appropriate header.
- **Profile tab:** New `(tabs)/profile.tsx` with settings/profile content.

### Magic UI components used

- None. Navigation uses existing design tokens and components (no blur-fade or magic-card in nav).

---

## 5. Responsive behavior

- **Desktop (lg+):** Sidebar visible; bottom nav hidden.
- **Mobile (< lg):** Bottom tab bar visible; sidebar hidden.
- **Tablet:** Same as desktop (sidebar at lg). Collapsible sidebar can be a future improvement.

---

## 6. Future improvements

- **Breadcrumbs (desktop):** For detail and settings subpages (e.g. "Builds / [Build name]", "Settings / Account").
- **Search:** Global search (if/when search API exists).
- **Collapsible sidebar (tablet):** Hamburger + overlay for medium viewports.
- **Inspiration:** Top-level nav item when a dedicated inspiration/saved-ideas feature exists.
- **Deprecated routes:** Optional redirect or removal of `/packing` and `/itinerary`; document and update any remaining links.

---

## 7. Files changed (reference)

| Area          | File / change                                                                                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design system | `navConfig.ts`: NAV_SECTIONS_PRIMARY, NAV_SECTION_SETTINGS, NAV_SECTIONS_BOTTOM, getActiveSection, ADD_MENU_ITEMS                                                                              |
| Web           | `navIcons.ts`: closet, planner, settings; `WebAppShell`, `WebSidebar`, `BottomNav`: shared active logic; `WebTopBar`: Add context menu; `FloatingAdd`: context menu; `AddContextMenu.tsx`: new |
| Mobile        | `(tabs)/_layout.tsx`: 5 tabs (closet, profile; plan→Events; packing removed); `(tabs)/closet.tsx`, `(tabs)/profile.tsx`: new; `app/packing.tsx`: new (stack); `(tabs)/packing.tsx`: removed    |
| i18n          | Nav: builds→Outfits, closet, events, planner, settings, profile; Common: addOutfit, addEvent                                                                                                   |
