## Planner (Feature 8) — Real Tasks

Implements the Planner feature per FEATURES_CANONICAL §8 and the implementation plan.

### Summary

- **Backend:** New Convex query `buildTasks.listForPlanner(userId)` returns all build tasks for the user with `buildName` and optional `dueDate` (derived from convention day plans). Auth enforced.
- **Frontend:** Planner page wired to real data:
  - **Daily view:** Tasks from `listForPlanner`, timeframe filter (All / Today / This week), progress summary (X of Y tasks + bar), "Deadline approaching" and "Other" sections, task rows with checkbox (→ `buildTasks.update`), build name link to build detail, optional due date; "Add task" link to /builds.
  - **Conventions view:** Real conventions from `conventions.list` with Itinerary and Packing List links per convention.
- **Tests:** `web/src/app/planner/page.test.tsx` — tabs, progress, deadline section, task labels and build links, Add task link, Conventions tab with convention list and links.
- **Docs:** FEATURE_STATUS (Planner → IMPLEMENTED), GAP_ANALYSIS (Planner gap done), COMMIT_PLAN (2.2 done).

### Verification

- [x] `npm run validate` passes (format, lint, typecheck, build:web).
- [x] No new lint or type errors.
- [x] Manual test: sign in → Planner → Daily shows tasks/progress/sections/checkbox/build link; Conventions shows real conventions and Itinerary/Packing links.
- [x] Docs updated (FEATURE_STATUS, GAP_ANALYSIS, COMMIT_PLAN).

### Commits

1. feat(convex): add buildTasks.listForPlanner
2. feat(web): wire Planner to real tasks and conventions
3. test(web): add Planner page tests
4. docs: update FEATURE_STATUS, GAP_ANALYSIS, COMMIT_PLAN for Planner
