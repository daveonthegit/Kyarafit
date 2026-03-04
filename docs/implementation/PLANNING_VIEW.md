# Planning View (Planner)

**Purpose:** Cross-build task view with timeframe (today/week), progress summary, deadline-approaching and other tasks, each task linked to build (and optional convention day). Same on web and mobile.

**Scope:** In: Planner page/screen, Convex buildTasks and builds (and convention day plans for due-by-date). Out: React Query for Convex data (use Convex useQuery); legacy fetchBuildTasks API.

**Current state:**

- **Convex:** [convex/buildTasks.ts](convex/buildTasks.ts) — listByBuild. [convex/builds.ts](convex/builds.ts) — list, get. [convex/conventions.ts](convex/conventions.ts) — day plans (date → buildId). No dedicated "tasks in date range" query; can aggregate from list builds → listByBuild per build, or add a Convex query that returns tasks with build info.
- **Web:** [web/src/app/planner/page.tsx](web/src/app/planner/page.tsx) — Daily / Conventions toggle; Daily shows placeholder task; Conventions lists static conventions with Itinerary/Packing links. Tasks not loaded from builds.
- **Gaps:** Load real tasks (all builds or convention-scoped); group by "deadline approaching" vs "other"; progress summary (X of Y tasks); timeframe selector (Today / This week); task rows with checkbox, label, build name link, optional due date; add-task flow (navigate to build detail or modal).

**Next steps:**

1. **Data:** On planner load, fetch all builds for user (or for selected convention); for each build fetch buildTasks (or add Convex query that returns tasks with build name). Optionally add dueDate to buildTasks schema if per-task due dates needed; else derive "due" from convention day (build assigned to that date).
2. **Timeframe:** Filter tasks by due date or convention date (Today = due today; This week = due in next 7 days). If no due dates, show all tasks or tasks from "this week" convention.
3. **Sections:** "Deadline approaching" (due today or soon); "Other tasks". Each row: checkbox (maps to buildTasks.update checked), label, "Project: [build name]" (link to build detail), optional due date.
4. **Progress:** For selected timeframe, show "X of Y tasks" and progress bar (completed/total).
5. **Add task:** FAB or button → navigate to build detail to add task, or modal (pick build + label + optional due date) then call api.buildTasks.create.
6. **Mobile:** Same planner with same Convex queries and UI pattern.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Planner), [convex/buildTasks.ts](convex/buildTasks.ts), [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
