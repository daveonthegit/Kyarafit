# Web: TaskChecklist on Build Detail

**Purpose:** Use the TaskChecklist component on the build detail page with create/update/delete wired to Convex so task completions and progress are consistent. Same capability on mobile build detail.

**Scope:** In: Build detail page, TaskChecklist component, Convex buildTasks API. Out: Go REST API, web lib/api/builds.ts (removed; web uses Convex only).

**Current state:**

- **Convex:** [convex/buildTasks.ts](convex/buildTasks.ts) — listByBuild, create, update, remove with userId/buildId ownership.
- **Web build detail:** [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) — uses `useQuery(api.buildTasks.listByBuild)`, `useMutation(api.buildTasks.update)`; renders [TaskChecklist](web/src/components/builds/TaskChecklist.tsx) with buildId and tasks. Tasks are created/updated/deleted via Convex mutations.
- **TaskChecklist:** [web/src/components/builds/TaskChecklist.tsx](web/src/components/builds/TaskChecklist.tsx) — receives tasks, buildId; has progress bar and "Mark all complete"; create/update/delete should call Convex (verify wired and no TODOs left).

**Next steps:**

1. If TaskChecklist still has TODOs for API calls: wire create to `api.buildTasks.create`, update (toggle checked, etc.) to `api.buildTasks.update`, delete to `api.buildTasks.remove`; parent passes mutations or TaskChecklist uses useMutation internally; refetch or invalidate after mutations.
2. Ensure build detail page refetches tasks after create/update/delete (Convex reactivity usually updates automatically; confirm).
3. Optional: task reordering (sortOrder), task→closet item assignment (see DRAG_DROP_IMPLEMENTATION).
4. **Mobile:** Build detail screen with task list (check/uncheck, add, delete) and progress; use Convex buildTasks from mobile app.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Build tasks), [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md), [convex/buildTasks.ts](convex/buildTasks.ts), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
