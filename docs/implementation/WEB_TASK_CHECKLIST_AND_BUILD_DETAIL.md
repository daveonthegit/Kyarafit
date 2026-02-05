# Web: TaskChecklist on Build Detail and Task API Wiring

Use the **TaskChecklist** component on the build detail page and wire its create/update/delete to the real API so task completions and progress are consistent. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) uses ChecklistRow and direct API calls (createBuildTask, updateBuildTask). [TaskChecklist](web/src/components/builds/TaskChecklist.tsx) has progress bar and "Mark all complete" but has TODOs for real API and is not used on build detail.
- **Target**: Build detail page uses TaskChecklist; TaskChecklist's create, update, and delete tasks call the real build-tasks API; progress bar reflects task completion. Optionally add task reordering or assignment UI later.

---

## Prerequisites

- [web/src/components/builds/TaskChecklist.tsx](web/src/components/builds/TaskChecklist.tsx): Exists; takes buildId, tasks, onTaskAssign; has TODOs for API calls.
- [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx): Fetches tasks via fetchBuildTasks(id), uses createBuildTask, updateBuildTask from [web/src/lib/api/builds.ts](web/src/lib/api/builds.ts); renders ChecklistRow per task.
- Build tasks API: create (POST), update (PATCH), delete (DELETE) exist in backend and web API client.

---

## Step 1: Wire TaskChecklist create/update/delete to real API

**What to do**

- In [web/src/components/builds/TaskChecklist.tsx](web/src/components/builds/TaskChecklist.tsx): Replace the TODO stubs for create, update, and delete with calls to the builds API. Import createBuildTask, updateBuildTask, deleteBuildTask from the web API (e.g. [web/src/lib/api/builds.ts](web/src/lib/api/builds.ts)). When adding a task, call createBuildTask(buildId, { label, sortOrder }); when toggling checked, call updateBuildTask(buildId, taskId, { checked }); when deleting, call deleteBuildTask(buildId, taskId). The parent (build detail page) should pass an onTasksChange callback or refetch tasks after mutations so the list updates. Prefer the parent owning the mutation and passing down handlers so TaskChecklist stays presentational where possible; or TaskChecklist can accept an onTaskCreate, onTaskUpdate, onTaskDelete that the parent implements with the API. Choose one: either TaskChecklist calls API and invokes an optional onSuccess callback to refetch, or parent passes handlers that call API and refetch.

**Files to touch**

- `web/src/components/builds/TaskChecklist.tsx`
- Optionally `web/src/lib/api/builds.ts` (ensure deleteBuildTask exists and is exported).

**Cursor prompt**

```
In web/src/components/builds/TaskChecklist.tsx, wire create/update/delete to the real API: (1) Import createBuildTask, updateBuildTask, and deleteBuildTask from web/src/lib/api/builds (add deleteBuildTask if missing). (2) Replace the TODO for "create task" with a call to createBuildTask(buildId, { label, sortOrder }); after success, call a callback (e.g. onTasksChange or onTaskCreated) so the parent can refetch tasks. (3) Replace the TODO for "update task" (toggle checked) with updateBuildTask(buildId, taskId, { checked }). (4) Replace the TODO for "delete task" with deleteBuildTask(buildId, taskId). (5) Ensure the parent build-detail page can refetch tasks when these succeed (either via callback or by TaskChecklist triggering a refetch). Run npm run build.
```

---

## Step 2: Build detail page — use TaskChecklist instead of ChecklistRow

**What to do**

- In [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx): Remove the inline task list (ChecklistRow map) and the local create/toggle mutations if they are duplicated in TaskChecklist. Import and render TaskChecklist with buildId={id}, tasks={tasks}, and onTaskAssign (optional; can be no-op or open assignment UI later). Pass a callback so that when TaskChecklist updates tasks (create/update/delete), the page refetches tasks (e.g. queryClient.invalidateQueries({ queryKey: ["build-tasks", id] })). Ensure tasks and buildId are passed correctly and the progress bar in TaskChecklist reflects the current tasks.

**Files to touch**

- `web/src/app/build-detail/page.tsx`

**Cursor prompt**

```
In web/src/app/build-detail/page.tsx, replace the inline task list (ChecklistRow and local create/toggle) with the TaskChecklist component: (1) Import TaskChecklist from @/components/builds/TaskChecklist. (2) Render TaskChecklist with buildId={id}, tasks={tasks} from the existing useQuery for build-tasks. (3) Pass a callback (e.g. onTasksChange) that invalidates the build-tasks query so the list refetches after create/update/delete. (4) Remove the duplicate "Add task" input and ChecklistRow map if TaskChecklist provides its own. (5) Keep the "Linked items" section and rest of the page unchanged. Run npm run build and verify task list and progress bar work.
```

---

## Step 3: Optional — task reordering and assignment UI

**What to do**

- If product requires reordering: add sortOrder updates when the user reorders (e.g. drag handles and PATCH build task with new sortOrder). If product requires assignment: implement onTaskAssign so that dropping a task onto a closet item (or selecting from a list) calls updateBuildTask(buildId, taskId, { closetItemId }). Can be a follow-up step; document in this guide.

**Files to touch**

- `web/src/components/builds/TaskChecklist.tsx` and/or build-detail page.

**Cursor prompt**

```
Optional: In TaskChecklist or build-detail page, add task reordering (drag to reorder, then PATCH task with new sortOrder) and/or assignment UI (onTaskAssign: when user assigns a task to a closet item, call updateBuildTask(buildId, taskId, { closetItemId })). If reordering is added, use drag handles and update sortOrder via API. If assignment is added, provide a way to pick a linked closet item and set closetItemId on the task. Document in WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md as Step 3 optional.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | TaskChecklist: wire create/update/delete to createBuildTask, updateBuildTask, deleteBuildTask; refetch via callback. |
| 2 | Build detail page: render TaskChecklist with buildId, tasks, refetch callback; remove duplicate ChecklistRow list. |
| 3 | Optional: reordering (sortOrder) and assignment (closetItemId) UI. |

After Step 2, build detail uses TaskChecklist with real API and progress bar.
