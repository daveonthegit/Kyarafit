# Convention Itinerary: Convention Tasks + Build Tasks

Build the **convention itinerary** view so it shows convention-level tasks plus tasks from the builds assigned to each day in the convention plan. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: [web/src/app/itinerary/page.tsx](web/src/app/itinerary/page.tsx) is a stub ("Assign a build from your convention plan"). Backend has convention plan (day → buildId) and build tasks; convention-level "tasks" may need to be defined (or use packing list / a new table).
- **Target**: Itinerary page shows a chosen convention (or current), loads the convention plan (day → build), loads convention-level tasks (if any), loads tasks for each planned build, and displays one view by day: convention tasks + that day's build tasks. Packing list stays separate (items to pack).

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

## Step 4: Itinerary page — styling and "current plan" (optional)

**What to do**

- Style the itinerary to match the app (e.g. serif headings, meta-label, spacing). Optionally add a way to pick the "current" convention (e.g. default to first convention or last viewed) and optionally highlight a "current plan" build if the product defines it.

**Files to touch**

- `web/src/app/itinerary/page.tsx`

**Cursor prompt**

```
In web/src/app/itinerary/page.tsx, polish the itinerary: (1) Apply existing design tokens (serif titles, meta-label, spacing). (2) Optional: allow selecting convention from a dropdown if multiple, or default to first/last. (3) Optional: show "current plan" build for the convention if that concept exists. Ensure the page is usable and matches the rest of the app. Run npm run build.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Optional: add convention-level tasks (table + API) or document use of packing list. |
| 2 | Itinerary: load convention and plan; show dates and build per day. |
| 3 | Itinerary: fetch and show build tasks per day; add convention tasks if any. |
| 4 | Styling and optional current-convention/current-plan UI. |
