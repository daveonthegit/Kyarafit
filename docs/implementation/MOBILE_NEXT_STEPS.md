# Mobile: Next Steps (Image Upload, Task UI, Convention/Packing Pull)

Implement **image upload on mobile**, **task UI** (build detail with task checklist), and ensure **convention plans and packing list** are merged in sync pull. Do steps in order; each has a **Cursor prompt**.

**Feature parity**: These steps bring mobile in line with web for image upload, task checklist, and sync pull. For features that exist on web (convention itinerary, packing list, planner, settings, build profile), implement the same feature set on mobile per the corresponding guides: [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md), [PACKING_LIST.md](PACKING_LIST.md), [PLANNING_VIEW.md](PLANNING_VIEW.md), [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md).

---

## Goal

- **Image upload**: Mobile forms (build create, closet item, convention) should upload images via the same pipeline as web (e.g. POST /api/v1/upload/image or Supabase Storage) instead of storing only locally or data URLs.
- **Task UI**: Build detail screen on mobile with task checklist (create/update/delete tasks, progress). Optionally drag-drop or menu to assign task to closet item.
- **Sync pull**: Mobile sync already has repos; ensure pull phase merges convention plans and packing list items if the backend returns them (see [backend/internal/sync/sync.go](backend/internal/sync/sync.go)).

---

## Prerequisites

- [mobile/src/storage/](mobile/src/storage/): closetRepo, buildsRepo, buildTasksRepo, conventionsRepo, plansRepo, packingRepo exist.
- [mobile/src/services/sync.ts](mobile/src/services/sync.ts): Pull merges builds, build tasks, closet, conventions; TODOs for convention plans and packing.
- Backend sync pull returns conventionPlans and packingListItems.

---

## Step 1: Mobile — image upload in forms

**What to do**

- In the mobile build-creation flow (and closet item create, convention create if present): when the user selects a photo, upload it via the backend (e.g. multipart POST to /api/v1/upload/image with category=builds|closet|conventions) and use the returned URL in the create payload. Use Expo ImagePicker or similar to pick the file; use fetch or axios with FormData to upload. Handle auth token in the request header. If the app is offline, either queue the upload for later or show a message that image upload requires network.

**Files to touch**

- Mobile build create screen, closet item create screen, convention create screen (e.g. under mobile/); optionally a shared upload helper.

**Cursor prompt**

```
In the Kyarafit mobile app, add image upload for build and closet (and convention if present) creation: (1) When user selects a photo (Expo ImagePicker or similar), upload it via POST to the backend /api/v1/upload/image with category=builds or closet or conventions, multipart form with file and auth header. (2) Use the returned URL in the create build/closet/convention API payload. (3) Handle errors and optionally offline (queue or show message). (4) Reuse the same backend upload endpoint as web. Run the mobile app and test creating a build with a photo.
```

---

## Step 2: Mobile — build detail screen with task checklist

**What to do**

- Ensure the mobile app has a build detail screen that shows the build and its tasks. Add or refine: (1) List of tasks with check/uncheck (call updateBuildTask for checked). (2) Add task (call createBuildTask). (3) Delete task (call deleteBuildTask). (4) Optional: progress bar (checked/total). Match the patterns from web TaskChecklist where applicable. Use the existing build and build-tasks API client.

**Files to touch**

- Mobile build detail screen (e.g. mobile/app/build-detail.tsx or similar).

**Cursor prompt**

```
In the Kyarafit mobile app, implement or refine the build detail screen with task checklist: (1) Fetch build and build tasks. (2) Render task list with check/uncheck; on toggle call updateBuildTask(buildId, taskId, { checked }). (3) Add "Add task" and call createBuildTask. (4) Allow delete and call deleteBuildTask. (5) Show progress (e.g. X/Y tasks complete). Use existing API client and storage if any. Run the app and test task CRUD.
```

---

## Step 3: Mobile sync — merge convention plans and packing list in pull

**What to do**

- In [mobile/src/services/sync.ts](mobile/src/services/sync.ts), in the pull phase: the backend response includes conventionPlans and packingListItems. If plansRepo and packingRepo (or equivalent) have upsertFromSync or merge methods, call them with the pulled data. If not, add minimal merge logic: for each convention plan entry, upsert into the plans store; for each packing list item, upsert into the packing store. Use last-write-wins by updatedAt if applicable. Ensure the sync response type includes these arrays.

**Files to touch**

- mobile/src/services/sync.ts; optionally mobile/src/storage/plansRepo.ts and packingRepo if merge helpers are missing.

**Cursor prompt**

```
In mobile/src/services/sync.ts, merge convention plans and packing list items in the pull phase: (1) After merging builds, build tasks, closet, conventions, iterate over data.conventionPlans (or the key used in the pull response) and upsert each into the plans repo/store. (2) Iterate over data.packingListItems and upsert each into the packing repo/store. (3) Add upsertFromSync or equivalent to plansRepo and packingRepo if missing. (4) Use last-write-wins by updatedAt. Ensure the pull response type includes conventionPlans and packingListItems. Run the mobile app and verify sync pulls these entities.
```

---

## Step 4: Mobile — optional drag-drop or assign task to closet item

**What to do**

- If product requires assigning a task to a closet item on mobile: add a long-press or "Assign to" menu on a task that shows the build's linked closet items; on select, call updateBuildTask(buildId, taskId, { closetItemId }). Document in [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md).

**Files to touch**

- Mobile build detail / task list.

**Cursor prompt**

```
Optional: In the Kyarafit mobile app, add task-to-closet assignment: on the build detail task list, allow the user to assign a task to a linked closet item (e.g. long-press task → "Assign to" → list of linked items → call updateBuildTask with closetItemId). Document in DRAG_DROP_IMPLEMENTATION.md Step 3. Run the app and test.
```

---

## Summary

| Step | Action                                                                        |
| ---- | ----------------------------------------------------------------------------- |
| 1    | Mobile: upload image in build/closet/convention forms via backend upload API. |
| 2    | Mobile: build detail with task list, add/check/delete and progress.           |
| 3    | Mobile sync pull: merge conventionPlans and packingListItems.                 |
| 4    | Optional: assign task to closet item on mobile.                               |
