# Convention Itinerary: Convention Tasks + Build Tasks

Build the **convention itinerary** view so it shows convention-level tasks plus tasks from the builds assigned to each day in the convention plan. Do steps in order; each has a **Cursor prompt**. Do not copy the style/aesthetic of any reference screen—only implement the features below in the app’s own design.

---

**Feature parity**: Implement the same itinerary features on web and mobile: header, sync/offline status, countdown, cosplay timeline (per-day build cards, status), logistics. Web steps reference web paths; mobile should provide the same itinerary screen for a chosen convention.

## Goal

- **Current gap**: [web/src/app/itinerary/page.tsx](web/src/app/itinerary/page.tsx) is a stub ("Assign a build from your convention plan"). Backend has convention plan (day → buildId) and build tasks; convention-level "tasks" may need to be defined (or use packing list / a new table).
- **Target**: Itinerary page shows a chosen convention and implements the [feature guide](#convention-itinerary-feature-guide) below: header, status/sync, overview cards, day-by-day cosplay timeline with build cards and status, and logistics. **Web and mobile**: same feature set on the convention itinerary screen. Use the app’s existing design system.

---

## Convention itinerary: feature guide

Use this as the **feature** target for the convention itinerary screen. Do not copy the reference screen’s style—only implement these capabilities.

- **Header**: **Back** navigation; **convention/event title** (e.g. "Anime Expo 2024") prominent; **calendar or schedule** action (e.g. icon to open full schedule or settings).
- **Mode / sync status**: **Offline indicator** when the app is offline or using local storage (e.g. "Offline mode active" or "Local storage"); **last synced** (e.g. "Last synced: 2m ago") when relevant. Optionally show sync/offline icon (e.g. cloud with strikethrough when offline).
- **Event overview cards**: At least one **countdown** card (e.g. "Starts in X days" from convention start date). Optional: **weather** card (temperature, icon) if you integrate weather; otherwise skip.
- **Cosplay timeline**: Section title (e.g. "Cosplay timeline"); **Edit plan** action (navigate to day-by-day plan editing, e.g. convention plan page). **Per-day entries**: For each day (D1, D2, D3, …) show:
  - **Day label** (e.g. D1, D2) and **date** (e.g. "Friday, July 1st").
  - **Build/cosplay card** for that day: **thumbnail image** (build image), **build name**, **date**, and **status/details** such as:
    - **Ready to pack** (e.g. "Ready to pack (12 items)") with item count from packing list or linked items.
    - **Missing items** (e.g. "Missing: Web Shooters") when required items are not linked or not packed.
    - **Pending** (e.g. "Logistics pending") when the build or day is not fully set up.
  - Visual timeline (e.g. vertical line or list) connecting days.
- **Logistics section**: **Accommodation** (e.g. venue/hotel name, room, check-in) if the product stores it; **badge/ticket** info (e.g. "Badge QR code", "Available offline") if applicable. Optional: **quick action** (e.g. "Repair kit" or essential link). Use existing convention or user fields; add backend fields only if needed.
- **Reliability / sync copy**: Short line such as "Last synced: X ago" or "Available offline" where it fits (e.g. below logistics or in header area).

See also [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md) for sync/offline messaging and [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md) for sync status UI patterns.

---

## Prerequisites

- Convention plan API: [web/src/app/conventions/[id]/page.tsx](web/src/app/conventions/[id]/page.tsx) uses fetchPlan(id) (day → buildId). Build tasks: fetchBuildTasks(buildId).
- [design-system/types/convention.ts](design-system/types/convention.ts): DayPlanEntry has date, buildId, notes.
- Backend: convention_plans or equivalent; build_tasks per build. Convention-level tasks: may not exist yet (see Step 1).

---

## Step 1: Convention-level tasks (optional)

**What to do**

- If the product needs **convention-level tasks** (to-dos for the event itself, not tied to a build): add a backend table and API (e.g. convention_tasks: id, convention_id, label, sort_order, checked, date optional). If convention tasks are represented by the packing list or a simple list elsewhere, skip and use that. Document the choice in this guide.

**Files to touch**

- Backend: migration and handler for convention tasks (if new table). Web: API client and types.

**Cursor prompt**

```
Optional: Add convention-level tasks for the itinerary. If the product spec requires a separate list of convention to-dos (not build tasks), add a backend table convention_tasks (convention_id, label, sort_order, checked, optional date) and CRUD API. If convention tasks are already represented (e.g. packing list or manual items), skip and document that in CONVENTION_ITINERARY.md. Otherwise implement minimal create/list/update and wire types in design-system.
```

---

## Step 2: Itinerary page — load convention and plan

**What to do**

- In [web/src/app/itinerary/page.tsx](web/src/app/itinerary/page.tsx): (1) Accept a convention id (query param or route, e.g. /itinerary?conventionId=... or /conventions/[id]/itinerary). (2) Fetch the convention and its plan (fetchConvention, fetchPlan). (3) Compute the list of dates from convention startDate/endDate. (4) For each date, get the assigned buildId from the plan. Render a skeleton or "Loading" until data is ready.

**Files to touch**

- `web/src/app/itinerary/page.tsx`. Consider route: /itinerary?conventionId= or /conventions/[id]/itinerary.

**Cursor prompt**

```
In web/src/app/itinerary/page.tsx, load convention and plan: (1) Read conventionId from query (e.g. ?conventionId=) or from route if you use /conventions/[id]/itinerary. (2) Fetch convention (fetchConvention) and plan (fetchPlan) from web/src/lib/api/conventions. (3) Compute date range from convention.startDate to convention.endDate. (4) Build a map date → buildId from the plan. (5) Render a loading state until data is ready; then show a section per day with the day label and the build name for that day (if any). Run npm run build.
```

---

## Step 3: Itinerary page — load and show build tasks per day

**What to do**

- For each date that has a buildId in the plan, fetch that build's tasks (fetchBuildTasks(buildId)). Display them under that day (e.g. "Day 1 – Build Name" and a list of task labels with optional checked state). Use React Query so each build's tasks are cached. If multiple days share the same build, fetch once and reuse. Aggregate: for each day, show convention-level tasks (if Step 1 added them) plus the tasks of the build assigned to that day.

**Files to touch**

- `web/src/app/itinerary/page.tsx`

**Cursor prompt**

```
In web/src/app/itinerary/page.tsx, load and show build tasks per day: (1) For each date in the plan with a buildId, fetch build tasks via fetchBuildTasks(buildId) (use useQuery keyed by buildId so same build is not refetched). (2) For each day, render the build name and its tasks (label, checked). (3) If convention-level tasks exist, fetch them and show a "Convention" section per day or at top. (4) Structure: Day 1 (date) – Build A → list of Build A's tasks; Day 2 – Build B → Build B's tasks; etc. Run npm run build.
```

---

## Step 4: Itinerary page — header, countdown, and sync/offline status

**What to do**

- **Header**: Back navigation, convention name as title (e.g. "Anime Expo 2024"), and a **calendar or schedule** action (icon or link to full schedule or to the convention plan edit). **Countdown**: Add an overview card "Starts in X days" (or "Ends in X days") from convention startDate (or endDate). **Sync/offline**: Show **offline indicator** when the app is offline or using local data only (e.g. "Offline mode active" / "Local storage"); show **last synced** (e.g. "Last synced: 2m ago") when online and sync is available. Use existing sync status if wired (see [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md)); otherwise a simple text line. Match the app’s design—do not copy the reference aesthetic.

**Files to touch**

- `web/src/app/itinerary/page.tsx` (or convention itinerary route).

**Cursor prompt**

```
In the convention itinerary page, add: (1) Header with back, convention title, and calendar/schedule action (link to plan or schedule). (2) A countdown card "Starts in X days" from convention startDate. (3) Offline indicator when offline ("Offline mode active" or "Local storage") and "Last synced: X ago" when sync is available. Use the app's design tokens; do not copy another screen's style. Run npm run build.
```

---

## Step 5: Itinerary page — cosplay timeline with Edit plan and per-day build cards

**What to do**

- **Cosplay timeline** section: Title (e.g. "Cosplay timeline"); **Edit plan** button or link that navigates to the convention plan edit (day-by-day build assignment). For each day in the date range, show a **day label** (e.g. D1, D2) and **date** (e.g. "Friday, July 1st"), then a **build card** for the build assigned to that day: **thumbnail** (build image), **build name**, and **status** derived from data, e.g.:
  - **Ready to pack** — e.g. "Ready to pack (N items)" using packing list count or linked closet items count.
  - **Missing** — e.g. "Missing: [item names]" when required tasks or linked items are incomplete (define heuristics or use task/build completion).
  - **Pending** — e.g. "Logistics pending" when no build is assigned or build has no tasks. Use a simple vertical timeline or list layout. Style with the app’s design system.

**Files to touch**

- `web/src/app/itinerary/page.tsx`; optionally packing API to get item count per build/day.

**Cursor prompt**

```
On the convention itinerary page, add the cosplay timeline: (1) Section title "Cosplay timeline" and "Edit plan" button linking to the convention plan edit (day → build assignment). (2) For each day (D1, D2, …), show day label, date, and a card for the build assigned that day: thumbnail (build image), build name, and status. (3) Derive status: "Ready to pack (N items)" from packing/list count, "Missing: X" when tasks or items are incomplete, "Logistics pending" when no build or incomplete. Use app design tokens. Run npm run build.
```

---

## Step 6: Itinerary page — logistics section and optional weather

**What to do**

- **Logistics** section: Title "Logistics". Show **accommodation** (venue/hotel name, room, check-in) if the convention or user has that data (add fields to convention or user if needed). Show **badge/ticket** info (e.g. "Badge QR code", "Available offline") if the product supports it. Optional: **weather** card (e.g. "75°F" + icon) if you integrate a weather API; otherwise skip. Optional: quick action (e.g. "Repair kit" or link). Add a short **reliability/sync** line (e.g. "Last synced: X ago" or "Available offline") if not already in header. Use existing design; do not copy reference style.

**Files to touch**

- `web/src/app/itinerary/page.tsx`; backend/convention types if adding accommodation or badge fields.

**Cursor prompt**

```
On the convention itinerary page, add a Logistics section: (1) Title "Logistics". (2) Accommodation row (venue/hotel, room, check-in) if convention or user model has these fields; otherwise placeholder or skip. (3) Badge/ticket row (e.g. "Badge QR code", "Available offline") if supported. (4) Optional weather card if you add a weather API; otherwise omit. (5) Optional quick action button. Use app design. Run npm run build.
```

---

## Step 7: Itinerary page — styling and "current plan" (optional)

**What to do**

- Style the full itinerary to match the app (serif headings, meta-label, spacing). Optionally allow selecting convention from a dropdown if multiple, or default to first/last. Optionally highlight a "current plan" build. Ensure the page is usable and consistent with the rest of the app.

**Files to touch**

- `web/src/app/itinerary/page.tsx`

**Cursor prompt**

```
In web/src/app/itinerary/page.tsx, polish the itinerary: (1) Apply existing design tokens (serif titles, meta-label, spacing). (2) Optional: allow selecting convention from a dropdown if multiple, or default to first/last. (3) Optional: show "current plan" build for the convention if that concept exists. Ensure the page is usable and matches the rest of the app. Run npm run build.
```

---

## Step 8: Mobile convention itinerary — same feature set as web

**What to do**

- On **mobile**, implement a convention itinerary screen with the same features as web: load convention and plan by convention id; header (back, convention title, calendar action); countdown card; offline/sync status; cosplay timeline with Edit plan and per-day build cards (thumbnail, name, status); logistics section (accommodation, badge/ticket). Use the same APIs (fetchConvention, fetchPlan, fetchBuildTasks); navigate from convention list or convention detail to itinerary.

**Files to touch**

- Mobile convention itinerary screen (e.g. under `mobile/`).

**Cursor prompt**

```
In the Kyarafit mobile app, implement the convention itinerary with feature parity to web: (1) Screen that accepts a convention id and loads convention + plan. (2) Header with back, convention title, calendar/schedule action. (3) Countdown card; offline/sync status. (4) Cosplay timeline: Edit plan link, per-day build cards (thumbnail, name, status: ready to pack / missing / pending). (5) Logistics section (accommodation, badge/ticket). Use same APIs as web. See CONVENTION_ITINERARY.md feature guide. Run the app and verify.
```

---

## Summary

| Step | Action                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 1    | Optional: add convention-level tasks (table + API) or document use of packing list.                                      |
| 2    | Itinerary: load convention and plan; show dates and build per day.                                                       |
| 3    | Itinerary: fetch and show build tasks per day; add convention tasks if any.                                              |
| 4    | Header (back, title, calendar action), countdown card, offline/sync status.                                              |
| 5    | Cosplay timeline: Edit plan, per-day build cards with thumbnail, name, date, status (ready to pack / missing / pending). |
| 6    | Logistics section: accommodation, badge/ticket, optional weather; sync/reliability line.                                 |
| 7    | Styling and optional current-convention/current-plan UI.                                                                 |
| 8    | Mobile: same itinerary feature set (convention + plan, header, countdown, timeline, logistics).                          |
