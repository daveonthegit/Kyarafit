# Homepage Dashboard Redesign

**Branch:** `design/home-dashboard-redesign`  
**Date:** 2025-03-06

## 1. Problems with the old homepage

- **Single hero + three links:** The homepage showed only the most recent build (hero) and three quick links (My Builds, Conventions, Closet). It did not answer core planning questions.
- **No event context:** Users could not see upcoming conventions or which event a build was planned for.
- **No task visibility:** Missing items and open tasks were not surfaced; users had to open Todo or each build to see what was left.
- **No closet context:** There was no wardrobe summary or quick “add item” from the home.
- **No other builds:** Only the most recent build was visible; other in-progress cosplays were not highlighted.

The page functioned as a landing strip to other sections rather than a **cosplay planning control center**.

## 2. New dashboard structure

The homepage is now a dashboard with a clear hierarchy:

1. **Hero** – Most recent cosplay build (visual centerpiece, with progress and event).
2. **Quick actions** – Add Outfit, Add Clothing Item, Plan New Cosplay (fast entry points).
3. **Upcoming events** – Next conventions with date range, days left, and outfit count; link to event detail.
4. **Current cosplay projects** – Other builds (excluding the hero) with thumbnail, progress, and link to build detail.
5. **Missing items** – Unchecked planner tasks (build + packing) with label and build name; link to build or planner.
6. **Closet overview** – Total item count, optional category breakdown, and “Add new item” CTA.

**Data flow:**

- **Hero:** `builds.getMostRecentForUser`, `conventions.getEventForBuild(buildId, userId)`.
- **Upcoming events:** `conventions.listUpcomingWithPlanCounts(userId, limit: 5)`.
- **Current projects:** `builds.list(userId)`, then exclude hero build and take first 6.
- **Missing items:** `buildTasks.listForPlanner(userId)`, filter `checked === false`, take first 8.
- **Closet:** `closetItems.list(userId)`, client-side aggregate for total and by category.

## 3. Hero section improvements

- **Progress bar:** A thin bar shows `tasksChecked / tasksTotal` (e.g. 4/7 items), with `aria-valuenow` for accessibility.
- **Event label:** When the build is linked to a convention via a day plan, the hero shows “Planned for {event name}” using the new `conventions.getEventForBuild` query.
- **CTA:** Primary CTA is “Continue editing” (same target: build detail); secondary remains “View build” / “View builds” in meta.
- **Visual:** Hero container is wrapped in **MagicCard** for a subtle border/hover effect; aspect and max-height are unchanged (e.g. 21/9 on desktop, 4/5 on mobile) to avoid excessive height.
- **Copy:** “X / Y items completed” is shown in addition to (or in place of) the previous percentage where useful.

## 4. Magic UI components used

- **MagicCard** – Used for:
  - Hero container (black-only spotlight on border and subtle inner darkening per design system).
  - Quick action cards (same treatment for consistency).
- **BlurFade** – Not used on the homepage to keep initial load simple and avoid extra motion; it remains available for section entrances elsewhere if desired.

Magic UI usage follows the existing design system: black-only gradient, `rounded-sm`, `border-kyar-borderSubtle`, and subtle opacity (e.g. `gradientOpacity` 0.12). No neon or extra accent colors.

## 5. Responsive behavior

- **Desktop (lg):** Two-column middle row (Upcoming events | Current projects); hero aspect 21/9; quick actions in 3 columns.
- **Tablet (sm):** Same sections; hero aspect 3/2; projects in 2 columns.
- **Mobile:** Single column; hero aspect 4/5; quick actions stacked; events and projects stacked; missing items and closet full width.

## 6. Future improvements

- **Inspiration / Saved looks:** When the schema supports saved looks or inspiration boards, add a small section or link from the dashboard.
- **Recent activity:** If activity or history is added (e.g. “recently edited builds”), surface it in a compact block.
- **Closet summary query:** Add `closetItems.getSummary(userId)` returning `{ total, byCategory }` to avoid loading the full closet list when only counts are needed.
- **Optional BlurFade:** Use BlurFade for section entrances (e.g. Quick actions, Upcoming events) if subtle entrance motion is desired, with short duration and `prefers-reduced-motion` respected.
- **Reusable home components:** Extract `HomeHero`, `HomeQuickActions`, `HomeUpcomingEvents`, `HomeProjects`, `HomeMissingItems`, `HomeClosetOverview` under `web/src/components/home/` for easier testing and reuse.
