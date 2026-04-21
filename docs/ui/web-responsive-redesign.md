# Web responsive redesign

Redesigning the Kyarafit web app to scale on desktop and tablet while preserving shared logic and Expo parity.

**Design system:** Semantic **OKLCH** tokens (`--kyar-*`, Tailwind `kyar.*`), **dual light/dark** themes, typography **Albert Sans + Bodoni Moda + JetBrains Mono**. See [`../design/PRODUCT_REDESIGN_PLAN.md`](../design/PRODUCT_REDESIGN_PLAN.md) and `web/src/app/globals.css`.

## Implemented (current state)

- **Phases 0–5:** Shared nav config in `design-system/navConfig.ts`; WebAppShell, WebContentContainer, WebSidebar, WebTopBar; ResponsiveGrid; AdaptiveModal and ResponsivePanel; FAB hidden on `lg`; authenticated pages use the new shell. Sidebar is sticky and full-height on desktop; only main content scrolls.
- **Build detail:** Two-column layout (image + meta + completion + deadline + budget left, sticky; tasks + linked closet items + progress photos right). Budget tracker in left column. Closet items section shows completion bar and per-item status; drag handle only on task rows so checkbox/delete/link work.
- **Closet detail:** Two-column layout (image left, details right); status (planned / in progress / complete) and completion task; tasks section with add/toggle/delete/set completion; “Add to build” panel to assign this item to builds (addItemsToBuild).
- **Closet list:** Sort by completion status; status shown on cards; multi-select with “Assign to build” (addItemsToBuild) and Delete; ResponsivePanel to pick build.
- **Builds list:** Multi-select with status buttons (Idea, WIP, Ready, Archive); budget tracker on each card when budget set; list returns totalCostCents.
- **Home:** Hero with most recent build image or placeholder; responsive quick links; getMostRecentForUser query.
- **Link-items page:** Drag handle only on closet item rows so checkbox (select for linking) works; same pattern as TaskChecklist.
- **Closet item status and tasks:** Status and completionTaskId in schema; buildTasks.update syncs item status when completion task is toggled; buildTasks.remove clears completionTaskId; tasks can be build-only or closet-item-only (buildId optional); create from closet item page; linkItems and addItemsToBuild auto-create completion task for items that don’t have one.

## Current architecture summary

- **Monorepo:** npm workspaces: `web`, `mobile`, `design-system`.
- **Web:** Next.js (App Router, `web/src/app/layout.tsx`). Styling: Tailwind; **semantic theme** in `web/tailwind.config.js` + **`web/src/app/globals.css`** (OKLCH variables, theme script for `kyar-theme` / `data-theme`).
- **Mobile:** Expo, expo-router (`mobile/app/(tabs)/_layout.tsx`). Styling: React Native StyleSheet + `@kyarafit/design-system/rn`.
- **Shared:** `design-system` — types, Zod schemas (`design-system/types/`), RN tokens, Tailwind theme bridge. Both apps use Convex (`convex/react`, `convex/_generated/api`). No shared API wrapper; hooks (e.g. `useCurrentUser`) duplicated.
- **Responsive today:** Tailwind `sm:`/`md:`/`lg:`; authenticated layout uses **WebAppShell** (sidebar + top bar + content container where implemented); mobile viewport uses **BottomNav**; landing and app surfaces consume **`kyar-*`** tokens.

## Current web issues (mobile-only pain)

| Issue                                   | Where                                                              | Why it breaks desktop/tablet                            | Fix category  |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- | ------------- |
| Single global nav: bottom bar only      | `BottomNav` below `lg`                                             | Complement with **WebSidebar** on `lg+`                 | nav           |
| Inconsistent shell on older routes      | Legacy pages that bypass **WebAppShell**                           | Migrate to shell + `WebContentContainer`                | layout        |
| No content max-width on app pages       | builds, closet, conventions, packing, itinerary, planner, settings | Content stretches full width; low density               | layout        |
| Single-column lists                     | builds (`space-y-16`), conventions, packing, itinerary, planner    | Wasted horizontal space                                 | component     |
| Fixed FAB                               | `web/src/components/layout/FloatingAdd.tsx`                        | FAB is mobile pattern; desktop better as toolbar action | nav/component |
| Modals always centered, small           | Delete confirms, TaskChecklist assign                              | No full-screen on mobile, no side panel on desktop      | component     |
| Sticky headers with large padding       | builds `pt-14`, closet `pt-12`, home `pt-14`                       | Big vertical chrome on desktop                          | layout        |
| Closet grid fixed at 2 columns          | `web/src/app/closet/page.tsx`                                      | Doesn’t scale to 3–4 on desktop                         | component     |
| Build detail / link-items single column | build-detail, build-detail/link-items                              | Doesn’t use horizontal space                            | component     |
| No sidebar/secondary nav                | All flows full-page stacks                                         | Desktop could show list + detail                        | nav/layout    |

## Shared vs platform-specific boundaries

**Shared (single implementation):**

- Domain / types / validation: `design-system/types`; both apps use same Zod schemas and Convex API.
- Data & API: Convex only; no web-only or mobile-only API layers.
- Navigation IA: One shared config (route ids, labels, paths) — e.g. in `design-system`.
- Feature flags / analytics: When added, in shared package.

**Platform-specific (allowed):**

- Layout primitives: Web = WebAppShell, sidebar, topbar, content container. Mobile = Expo layout, bottom tabs.
- Navigation UI: Web = sidebar + topbar; Mobile = bottom tabs.
- Presentation: Web-only components (WebSidebar, ResponsiveGrid, AdaptiveModal) under `web/src/components/layout/`.

**Rule:** `design-system` and `mobile` must not import from `web/`. Lint rule to enforce.

## Web breakpoints and layout primitives

**Breakpoints (Tailwind):**

- mobile: &lt; 640px
- tablet: 640–1024px (`sm:`, `md:`)
- desktop: 1024–1440px (`lg:`)
- large: 1440px+ (`xl:`)

**Web-only layout primitives (`web/src/components/layout/`):**

- **WebAppShell:** Wraps authenticated app; sidebar (desktop/tablet) + topbar + content; mobile = topbar + content.
- **WebSidebar:** Collapsible; nav from shared config; hidden on mobile.
- **WebTopBar:** Logo, “Add”, settings.
- **WebContentContainer:** Max-width (e.g. `max-w-7xl`) + padding.
- **ResponsiveGrid:** 1/2/3/4 columns by breakpoint.
- **ResponsivePanel:** Drawer on mobile, side sheet on desktop.
- **AdaptiveModal:** Full-screen on mobile, centered max-w on desktop.

## Navigation strategy

- **Shared config:** `design-system` exports nav sections: `{ id, label, path, icon }[]` — Home, Builds, Plan, Packing (optional Settings).
- **Mobile:** Keep tabs; consume shared config for labels/paths.
- **Web:** Mobile viewport = BottomNav (from config). Desktop/tablet = WebSidebar + WebTopBar (same config).

## Component redesign map

| Feature UI           | Tablet                    | Desktop                         |
| -------------------- | ------------------------- | ------------------------------- |
| Builds list          | 2-col grid                | 3–4 col, WebContentContainer    |
| Closet grid          | 2–3 col                   | 3–4 col                         |
| Conventions list     | 2-col or list+preview     | List + detail or table          |
| Packing list         | 2-col or compact          | Same + side panel if needed     |
| Build detail         | 2-col (meta + tasks)      | Side panel or two-column        |
| Convention detail    | Dates + plan side-by-side | Higher density                  |
| Detail pages / forms | max-width center          | WebContentContainer             |
| Modals               | Same                      | AdaptiveModal / ResponsivePanel |
| FAB                  | Hide when sidebar         | Topbar “Add”                    |

Same data and actions; only layout and density change.

## Phased rollout plan

**Phase 0 — Guardrails:** ESLint: no `web/` imports in `design-system` or `mobile`. Add shared nav config in `design-system`.

**Phase 1 — WebAppShell + containers:** Create WebAppShell, WebContentContainer; authenticated layout group; pages use shell + container; keep BottomNav on mobile.

**Phase 2 — Web navigation:** WebSidebar, WebTopBar; shared nav config; BottomNav only below `lg`.

**Phase 3 — Responsive layouts:** ResponsiveGrid; refactor builds, closet, conventions, packing, build detail to responsive grids/columns.

**Phase 4 — Modal/drawer:** AdaptiveModal, ResponsivePanel; refactor delete modals and TaskChecklist assign.

**Phase 5 — Density + polish:** Header padding, FAB → topbar “Add” on desktop; optional secondary nav.

**Verification each phase:** Web viewports 360, 768, 1280, 1440; Expo smoke test, no imports from web.

## Do / Don’t rules (protect Expo)

- **Do** keep types, Zod schemas, and nav config in `design-system`; both apps import from there.
- **Do** implement web layout primitives only under `web/src/components/layout/`; use only in web routes.
- **Do** use the same Convex API and same feature behavior; only change layout and density on web.
- **Don’t** let `design-system` or `mobile` import from `web/`.
- **Don’t** add web-only business logic that diverges behavior; put shared logic in shared packages.
- **Don’t** change Expo navigation structure or screens; optional refactor to consume shared nav config only.
