# Planning View: Feature Guide and Implementation

Build the **planning view** (Planner) so it shows tasks across builds with progress, deadline grouping, and links to conventions and builds. Do not copy the style/aesthetic of any reference screen—only implement the features below in the app’s own design.

---

## Goal

- **Current state**: [web/src/app/planner/page.tsx](web/src/app/planner/page.tsx) has a Daily / Conventions toggle; Daily shows a placeholder task; Conventions lists static conventions with Itinerary and Packing links. Tasks are not yet loaded from builds or linked to conventions.
- **Target**: Planning view implements the [feature guide](#planning-view-feature-guide) below: timeframe selector, progress summary, deadline-approaching and other-tasks sections, each task linked to a **build** (project) and optional **due date** (e.g. convention-related). Use the app’s existing design system. Connections: tasks = build tasks; due dates can align with convention dates; nav links to wardrobe (closet), planner, events (conventions).

---

## Planning view: feature guide

Use this as the **feature** target for the Planner screen. Do not copy the reference screen’s style—only implement these capabilities.

- **Header**: **Title** (e.g. "Planner"). **Sync indicator** (e.g. cloud with checkmark) when data is synced. **Timeframe selector**: switch between **Today** and **This Week** (or similar) to filter which tasks are shown.
- **Progress summary**: For the selected timeframe, show **"Today's Progress"** (or "This week's progress"): **progress bar** and **task count** (e.g. "3 of 8 tasks" = completed of total). Derive from build tasks: total = tasks in builds the user cares about (e.g. all builds, or builds linked to a chosen convention); completed = tasks where checked.
- **Deadline approaching**: Section for **urgent** tasks (e.g. due today or in the next few days). Each task row: **checkbox** (maps to build task checked), **task title** (task label), **Project:** **build name** (link to build detail), **due date** (e.g. "Due tomorrow", "Due in 2 days"). Optional: small **thumbnail** (build image or icon) per task. Tasks come from build tasks; due date can be convention date (day of convention) or a dedicated task due date if you add it to the model.
- **Other tasks**: Section for remaining tasks (same row structure: checkbox, title, **Project:** build name, optional due date, optional status/priority indicator such as a colored dot). Order by due date, then by build or sort order.
- **Task–build–convention links**: Each task is a **build task** (so it belongs to one **build**). Optionally associate a **convention** or **date** with a task (e.g. "wear this build on day D1" = convention start date). Linking: task → build; build can be assigned to convention days (convention plan); so the planner can show "Due [date]" from the convention day or from an explicit task due date.
- **Add task**: **FAB or button** (e.g. "+") to **add a new task** (to a chosen build) or to create a task and optionally set due date / convention day. Can navigate to build detail to add task there, or open a modal that picks build + label + optional due date.
- **Navigation**: Bottom nav (or equivalent) with **Wardrobe** (closet), **Planner** (current), **Events** (conventions), **Profile**. Ensures clear connection between planning, builds, and conventions.

See also [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) (build tasks), [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md) (convention plan = day → build), and [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md) (build profile).

---

## Prerequisites

- Build tasks API: fetchBuildTasks(buildId), createBuildTask, updateBuildTask (checked, etc.). Builds API: fetchBuilds.
- Convention plan: day → buildId (so each build can be “due” on a convention day). Optionally add a **due_date** or **convention_day** to build tasks if you want per-task due dates.
- [web/src/app/planner/page.tsx](web/src/app/planner/page.tsx): Exists with Daily/Conventions tabs; needs to load real tasks and group by deadline/other.

---

## Step 1: Load tasks for the planning view (all builds or convention-scoped)

**What to do**

- On the Planner page, **load tasks** that should appear in the plan: either (a) fetch all builds for the user, then fetch build tasks for each build, or (b) if “Today”/“This week” is convention-scoped, fetch the active convention’s plan (day → buildId) and then fetch tasks for those builds. Aggregate into a single list of “task + build” (task label, task id, build id, build name, checked, optional due date). Use React Query; cache by build. If the backend supports a “tasks due in range” or “tasks for convention” endpoint, use it to avoid N+1.

**Files to touch**

- `web/src/app/planner/page.tsx`; optionally backend endpoint that returns tasks with build info and optional due date.

**Cursor prompt**

```
In web/src/app/planner/page.tsx, load tasks for the planning view: (1) Fetch builds (fetchBuilds) and for each build fetch build tasks (fetchBuildTasks), or fetch a convention plan and then tasks for those builds. (2) Build a flat list of { task, buildId, buildName, buildImage?, checked } and optionally dueDate (from convention day or task field if present). (3) Use React Query; avoid N+1 (e.g. batch or backend endpoint). Run npm run build.
```

---

## Step 2: Timeframe selector and progress summary

**What to do**

- Add a **timeframe selector** (e.g. "Today" and "This week") that filters which tasks are shown (e.g. by due date or by convention day falling in that range). If there is no due date yet, "Today" can show tasks from builds that have a convention day today, and "This week" can show all tasks for builds in the current week’s convention days—or show all tasks until you add due dates. Add **progress summary**: for the filtered set, show "X of Y tasks" (checked count of total) and a **progress bar**. Use the app’s design tokens.

**Files to touch**

- `web/src/app/planner/page.tsx`

**Cursor prompt**

```
On the planner page, add: (1) Timeframe selector (Today / This week) that filters tasks (by due date or convention day in range; if no due dates, show all or by build). (2) Progress summary for the filtered list: 'X of Y tasks' and a progress bar. Use existing design. Run npm run build.
```

---

## Step 3: Deadline approaching and Other tasks sections

**What to do**

- **Split tasks** into (a) **Deadline approaching** — due today or in the next 1–2 days (or tasks whose convention day is imminent), and (b) **Other tasks** — the rest. Render two sections. Each task row: **checkbox** (toggle build task checked via updateBuildTask), **task title** (label), **Project: [build name]** (link to build detail), **due info** (e.g. "Due tomorrow" or "Due in 2 days" or convention date). Optional: small build **thumbnail**; optional **status/priority** dot. Use the app’s design—do not copy the reference aesthetic.

**Files to touch**

- `web/src/app/planner/page.tsx`

**Cursor prompt**

```
On the planner page, add two sections: (1) 'Deadline approaching' — tasks due today or in the next 1–2 days (or convention day in that range). (2) 'Other tasks' — remaining tasks. Each row: checkbox (wire to updateBuildTask), task title, 'Project: [build name]' (link to build detail), due text. Optional: build thumbnail, status dot. Use app design tokens. Run npm run build.
```

---

## Step 4: Sync indicator and add-task FAB

**What to do**

- In the header, add a **sync indicator** (e.g. cloud icon) that reflects sync status (see [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md)) or a simple "Synced" when data is fresh. Add a **FAB or button** to **add a new task**: either open a modal (pick build, enter label, optional due date) and call createBuildTask, or navigate to build detail with a hint to add a task. Use existing FAB pattern and design.

**Files to touch**

- `web/src/app/planner/page.tsx`

**Cursor prompt**

```
On the planner page: (1) Add sync indicator in the header (cloud icon or 'Synced' using existing sync status if available). (2) Add FAB or button to add a task — either modal (pick build, label, optional due date) calling createBuildTask, or link to build detail. Use app design. Run npm run build.
```

---

## Step 5: Optional — task due dates and convention-day link

**What to do**

- If the product needs **per-task due dates** or **convention-day association**: add a field to build tasks (e.g. due_date or convention_day_id) in the backend and design-system, then use it in the planner to filter "Today" / "This week" and to show "Due tomorrow". If tasks only get their “due” meaning from the **convention plan** (build assigned to a day), derive due date from that: e.g. "Build A on D1" → task’s due date = convention day 1. Document the choice in this guide.

**Files to touch**

- Backend build_tasks (migration + API); design-system types; planner page.

**Cursor prompt**

```
Optional: Add due date or convention-day link to build tasks: (1) If adding due_date to build tasks, add migration and API, then in the planner filter by it and show 'Due X'. (2) If deriving from convention plan only, compute 'due' from the day the build is assigned to and show that in the planner. Document in PLANNING_VIEW.md. Run npm run build.
```

---

## Step 6: Mobile planner — same feature set as web

**What to do**

- On **mobile**, implement the planner screen with the same features as web: load tasks (all builds or convention-scoped) with build info; timeframe selector (Today / This week); progress summary (X of Y tasks, progress bar); "Deadline approaching" and "Other tasks" sections with rows (checkbox, title, Project: build name, due); sync indicator in header; add-task FAB (modal or navigate to build). Use the same build-tasks and convention-plan APIs; ensure nav includes Wardrobe, Planner, Events, Profile.

**Files to touch**

- Mobile planner screen (e.g. Planner tab under `mobile/`).

**Cursor prompt**

```
In the Kyarafit mobile app, implement the planner with feature parity to web: (1) Load tasks from builds (or convention-scoped); build task + build name list. (2) Timeframe selector (Today / This week) and progress summary (X of Y, progress bar). (3) "Deadline approaching" and "Other tasks" sections; each row: checkbox, title, Project: [build name] (link to build), due text. (4) Sync indicator in header; add-task FAB. (5) Nav: Wardrobe, Planner, Events, Profile. Use same APIs as web. See PLANNING_VIEW.md feature guide. Run the app and verify.
```

---

## Summary

| Step | Action                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | Load tasks (all builds or convention-scoped) with build info and optional due date.             |
| 2    | Timeframe selector (Today / This week) and progress summary (X of Y, progress bar).             |
| 3    | Deadline approaching and Other tasks sections; each row: checkbox, title, Project (build), due. |
| 4    | Sync indicator in header; add-task FAB (modal or navigate to build).                            |
| 5    | Optional: task due_date or convention-day derivation for filtering and due copy.                |
| 6    | Mobile: same planner feature set (timeframe, progress, sections, sync, add-task, nav).          |

**Connections**: Tasks = build tasks. Project = build (link to build detail). Due dates can come from convention plan (day → build). Nav: Wardrobe (closet), Planner, Events (conventions), Profile.
