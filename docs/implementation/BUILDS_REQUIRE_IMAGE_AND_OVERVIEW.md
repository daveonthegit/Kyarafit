# Builds: Require Image + Overview + Build Profile Features

Implement **required image for builds**, **builds list as card layout** matching [example screens/builds_overview](example screens/builds_overview), and **build profile (detail) page** with the feature set below. Do steps in order; each step has a **Cursor prompt**. Do not copy the style/aesthetic of reference screens—only the features.

**Feature parity**: Implement the same features on **web and mobile**: required image, builds list (cards + status tabs), and build profile (detail) with the feature guide below. Web steps reference web paths; mobile should provide the same capabilities in the mobile app (builds list screen, build detail screen).

---

## Goal

- **Require image**: New/updated builds must have a non-empty `imageUrl` (backend validation, design-system schema, web and mobile forms).
- **Builds list**: Replace the current row list with full-width **cards**: large image, title, project number, construction progress (from tasks), tags/descriptor, "View Details". Add status tabs (Current / Archived / Planning / Completed). Progress data must be available (backend or batch fetch). **Web and mobile**: same card layout and tabs on both.
- **Build profile (detail) page**: The screen at build-detail (single build) should include the features listed in [Build profile page: feature guide](#build-profile-page-feature-guide) below (reference was a build-details screen; treat as feature guide only, not style). **Web and mobile**: same feature set on build detail (header, hero, metrics, task checklist, associated items, budget, optional progress photos).

---

## Prerequisites

- [web/src/app/builds/page.tsx](web/src/app/builds/page.tsx): Simple list (name, status, chevron); no images.
- [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx): Image optional; submit allowed without image.
- Backend build create: no validation that `image_url` is present.
- [design-system/types/builds.ts](design-system/types/builds.ts): `createBuildSchema` has `imageUrl` optional.
- [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx): Existing build detail; has tasks and linked items.

---

## Build profile page: feature guide

Use this as the **feature** target for the build detail (build profile) screen. Do not copy the reference screen’s style—only implement these capabilities in the app’s own aesthetic.

- **Header**: Back navigation; page title (e.g. “Build Details” or build name); **sync / current-plan indicator** (e.g. icon showing sync status or “current plan” when assigned); **edit** action (pencil) to edit the build.
- **Project overview**: **Hero image** (build image); optional label (e.g. “Current project” or status); **project name**; optional **subtitle** (e.g. character, source, or notes).
- **Metrics / summary**: **Completion** — task completion % (e.g. 72%), optional recent delta; **Deadline** (optional) — days remaining and/or date; **Overall build progress** — horizontal progress bar matching completion %.
- **Task checklist**: List of tasks with checkboxes; per-task **category/label** (e.g. “PROPS • COMPLETED”, “STYLING • IN PROGRESS”); **Add task** button; support for **assigning tasks to closet items** (drag-drop or menu).
- **Associated closet items**: Section showing **linked items** as a gallery/carousel: thumbnail + label per item; way to add/remove links (e.g. “Link items”).
- **Budget tracker**: **Spent vs limit** (e.g. from build budget and linked item costs); progress bar; **View expenses** (drill-down or list); optional: add receipts/photos for expenses.
- **Progress photos** (optional): Section “Progress photos” — grid or list of photos with **date and description**; optional add photo and view toggle.

See also [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) and [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md) for task and linking implementation.

---

## Step 1: Backend — require image on build create

**What to do**

- In the backend handler that creates builds (e.g. [backend/handlers/builds.go](backend/handlers/builds.go) or the handler used by `POST /builds`), after parsing the request body, validate that `imageUrl` (or `image_url`) is present and non-empty. If missing or empty, return `400` with a clear error (e.g. `"imageUrl is required"`).
- Optionally: on build **update**, forbid clearing the image (reject if the payload sets image to null/empty). If not needed for MVP, skip update validation.

**Files to touch**

- Backend build create handler (e.g. `handlers/builds.go` or `internal/builds/handler.go`).

**Cursor prompt**

```
In the Kyarafit backend, require image for new builds: in the handler for POST /builds (create build), after parsing the request, validate that imageUrl (or image_url) is present and non-empty. If missing or empty, return 400 with error message "imageUrl is required". Do not change the database schema. Locate the create-build handler (e.g. backend/handlers/builds.go or backend/internal/builds/handler.go) and add this validation. Run go build ./... to verify.
```

---

## Step 2: Design-system — make imageUrl required in createBuildSchema

**What to do**

- In [design-system/types/builds.ts](design-system/types/builds.ts), in `createBuildSchema`, change `imageUrl: z.string().optional()` to `imageUrl: z.string().min(1)` (required, non-empty string). Keep `updateBuildSchema` as-is or add `.refine()` to forbid clearing image if product requires it.

**Files to touch**

- `design-system/types/builds.ts`

**Cursor prompt**

```
In design-system/types/builds.ts, make imageUrl required for create: in createBuildSchema change imageUrl from z.string().optional() to z.string().min(1). Export type is inferred; no other changes needed. Run a quick typecheck (e.g. npm run build in web or design-system if available) to ensure no call sites break; fix any that were passing undefined imageUrl for create.
```

---

## Step 3: Web new-build form — require image and disable submit until set

**What to do**

- In [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx): Change the image label from "IMAGE (OPTIONAL)" to "IMAGE (REQUIRED)". Disable the submit button unless `imageUrl` is non-empty (e.g. `disabled={create.isPending || !name.trim() || !imageUrl.trim()}`). Ensure the form always sends `imageUrl` when calling `createBuild` (no `imageUrl: imageUrl.trim() || undefined` for create; send the required value). Show a short validation message if user tries to submit without image (optional but recommended).

**Files to touch**

- `web/src/app/builds/new/page.tsx`

**Cursor prompt**

```
In web/src/app/builds/new/page.tsx: (1) Change the image field label to "IMAGE (REQUIRED)". (2) Disable the submit button when imageUrl is empty: add !imageUrl.trim() to the disabled condition. (3) When calling createBuild, pass imageUrl as required (no || undefined so that create always receives a non-empty string when submit is allowed). (4) Optionally show a short validation message if the user attempts submit without an image. Run npm run build in web to verify.
```

---

## Step 4: Backend — add progress to builds list (or document batch fetch)

**What to do**

- **Option A**: In the backend endpoint that returns the list of builds (e.g. `GET /builds`), extend the response so each build includes a progress object, e.g. `tasksChecked` and `tasksTotal` (or `progress: { checked, total }`). Implement by joining or querying `build_tasks` for each build and counting checked vs total. Prefer a single query or batch to avoid N+1.
- **Option B**: Keep list endpoint as-is and document that the frontend will fetch tasks per build (or in batch) to compute progress. If choosing B, skip this step and in Step 5 the frontend will use existing `fetchBuildTasks` per build or a new batch endpoint.

**Files to touch**

- Backend builds list handler and possibly repository (e.g. `backend/internal/builds/repository.go` or handler).

**Cursor prompt**

```
In the Kyarafit backend, add construction progress to the builds list response: for each build returned by GET /builds (or the equivalent list endpoint), include tasksChecked and tasksTotal (or progress: { checked, total }) by querying build_tasks for that build. Use a single efficient query (e.g. GROUP BY build_id with COUNT and SUM(checked)) to avoid N+1. If the list endpoint is in backend/handlers/builds.go or backend/internal/builds, add this there. Run go build ./... and test GET /builds to verify the response shape.
```

---

## Step 5: Web builds page — card layout, image, progress, project number, "View Details"

**What to do**

- In [web/src/app/builds/page.tsx](web/src/app/builds/page.tsx): Replace the current list with full-width cards. For each build:
  - **Image**: Top of card, aspect ratio e.g. `aspect-[2/3]` (see [example screens/builds_overview/code.html](example screens/builds_overview/code.html)), use `build.imageUrl`; no placeholder needed once image is required.
  - **Title**: Serif, prominent (e.g. build name).
  - **Project number**: e.g. "PROJECT 012" from index (1-based, zero-padded) or display order.
  - **Construction progress**: Label "CONSTRUCTION PROGRESS", percentage (from backend progress or from fetched tasks), and a progress bar. If no tasks, show 0% or "—".
  - **Tags/descriptor**: One line (e.g. status, character) in small caps.
  - **"View Details"**: Link to `build-detail?id={build.id}`.
- Use the builds list API; if Step 4 added progress, use it; otherwise fetch tasks per build or implement a small batch and compute progress client-side.
- Keep header "Portfolio" / "My Builds", FAB, and bottom nav as-is.

**Files to touch**

- `web/src/app/builds/page.tsx`

**Cursor prompt**

```
In web/src/app/builds/page.tsx, replace the current builds list with a card layout matching the example screens/builds_overview: (1) Full-width card per build with large image at top (aspect-[2/3], build.imageUrl). (2) Title (serif) and project number (e.g. "PROJECT 012" from index, 1-based zero-padded). (3) "CONSTRUCTION PROGRESS" label with percentage and progress bar; use progress from API if available, else 0% or "—". (4) One line of tags/descriptor (e.g. status). (5) "View Details" link to build-detail?id={build.id}. Keep existing header, FAB, and bottom nav. Use the existing fetchBuilds (and progress/tasks data from list or separate fetch). Run npm run build and verify the page renders.
```

---

## Step 6: Web builds page — status tabs (Current, Archived, Planning, Completed)

**What to do**

- Add a sticky nav below the header with tabs: **Current**, **Archived**, **Planning**, **Completed**.
- Map backend status to tabs: e.g. `idea` → Planning, `wip` → Current, `ready` → Completed. If there is no "archived" status, either add one to the backend or treat one existing status as archived; otherwise show an empty state for Archived.
- Filter the list by the selected tab (client-side filter by `build.status`).
- Style the active tab (e.g. underline, bold) like the example.

**Files to touch**

- `web/src/app/builds/page.tsx`

**Cursor prompt**

```
In web/src/app/builds/page.tsx, add status tabs below the header: Current, Archived, Planning, Completed. Map build.status: idea → Planning, wip → Current, ready → Completed. If there is no archived status in the API, use a placeholder or empty state for Archived. Filter the displayed builds by the selected tab. Style active tab (e.g. underline) like example screens/builds_overview. Keep cards and rest of layout unchanged.
```

---

## Step 7: Mobile — build create and builds list parity

**What to do**

- **Build create**: When the mobile app has a build-creation screen, add the same requirement: image required, validation before submit, and pass non-empty imageUrl to the API. Reference the web and backend behavior.
- **Builds list**: On mobile, provide the same feature set as web: card layout (image, title, project number, construction progress, tags, "View Details"), and status tabs (Current / Archived / Planning / Completed) filtering the list. Use the same backend progress data.

**Files to touch**

- Mobile build create screen (e.g. in `mobile/`).

**Cursor prompt**

```
When implementing or updating mobile build creation in the Kyarafit app: require an image (same as web and backend). Validate that imageUrl is set before allowing submit; pass it as required to the create-build API. Show a clear label that image is required and block submit until an image is selected or uploaded.
```

---

## Step 8: Build profile — header, hero image, project overview

**What to do**

- In [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx): Ensure **header** has back navigation, title (e.g. “Build Details” or build name), and **edit** action (link or button to edit build, e.g. query param or route). Optionally add **sync or current-plan indicator** (icon/label) when sync status or “current plan” is available. **Project overview**: Hero image (build.imageUrl) at top; build name; optional subtitle (character or notes). Use the app’s existing design tokens—do not copy the reference screen’s visual style.

**Files to touch**

- `web/src/app/build-detail/page.tsx`

**Cursor prompt**

```
In web/src/app/build-detail/page.tsx, ensure the build profile has: (1) Header with back, title (e.g. build name or "Build Details"), and edit action (navigate to edit or open edit mode). (2) Optionally sync status or "current plan" indicator in the header if we have that data. (3) Hero image (build.imageUrl) at top, then build name and optional subtitle (character or notes). Use the app's existing design system; do not copy another screen's aesthetic. Run npm run build.
```

---

## Step 9: Build profile — completion %, deadline, overall progress bar

**What to do**

- On the build detail page, add **metrics/summary**: (1) **Completion** — compute task completion % (checked/total); optional “recent” delta if you track previous value. (2) **Deadline** (optional) — if builds have a deadline field (add to backend/design-system if needed), show days remaining or date with a calendar icon. (3) **Overall build progress** — horizontal progress bar matching the completion %. Use existing typography and spacing.

**Files to touch**

- `web/src/app/build-detail/page.tsx`; backend/design-system if adding deadline field.

**Cursor prompt**

```
In web/src/app/build-detail/page.tsx, add metrics: (1) Completion % (tasks checked / total) with optional delta. (2) Optional deadline (days left or date); if the build model has no deadline, skip or add a placeholder. (3) Overall build progress bar (same % as completion). Use existing design tokens. Run npm run build.
```

---

## Step 10: Build profile — task checklist with labels and Add task

**What to do**

- Ensure the **task checklist** shows each task with checkbox, and support **per-task category/label** (e.g. “PROPS • COMPLETED”) if the backend or design-system supports a category or status on build tasks. If not, use task label only or derive from closet item category when assigned. Add a clear **Add task** button. Prefer using TaskChecklist component (see [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md)).

**Files to touch**

- `web/src/app/build-detail/page.tsx` and/or `web/src/components/builds/TaskChecklist.tsx`; backend/database if adding task category.

**Cursor prompt**

```
On the build detail page, ensure the task checklist has: (1) Each task with checkbox and label. (2) Optional per-task category/status (e.g. PROPS • COMPLETED) if the API supports it; otherwise show label only. (3) Prominent "Add task" button. Use TaskChecklist if already integrated, or add these elements. See WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md. Run npm run build.
```

---

## Step 11: Build profile — associated closet items gallery

**What to do**

- Add or refine the **Associated closet items** section: show linked items as a **gallery or horizontal list** with **thumbnail image and label** per item. Reuse existing “Link items” (or equivalent) to add/remove links. Use build’s linked item IDs and fetch closet items for display; match the app’s layout (no style copy from reference).

**Files to touch**

- `web/src/app/build-detail/page.tsx` (and optionally link-items page).

**Cursor prompt**

```
On the build detail page, implement the Associated closet items section: (1) Show linked items as a gallery or horizontal list. (2) Each item: thumbnail (imageUrl) and label (name). (3) Keep or add "Link items" (or similar) to add/remove links. Use existing API (build items + closet list). Use the app's design system. Run npm run build.
```

---

## Step 12: Build profile — budget tracker and view expenses

**What to do**

- Add a **Budget tracker** section: show **spent vs limit** (build.budgetCents as limit; spent can be sum of linked closet items’ costCents, or from a dedicated expenses API if you add one). Progress bar for used/limit. **View expenses** link or button: navigate to a simple expense list or modal (e.g. list of linked items with costs, or a future expenses table). Optional: add receipts/photos for expenses (can be a later step).

**Files to touch**

- `web/src/app/build-detail/page.tsx`; optionally new route or modal for expense list.

**Cursor prompt**

```
On the build detail page, add a Budget tracker section: (1) Show spent vs limit (limit from build.budgetCents; spent from sum of linked closet items' costCents, or from expenses API if present). (2) Progress bar for used/limit. (3) "View expenses" button that navigates to an expense breakdown (e.g. list of linked items with costs, or dedicated expenses page). Use existing design tokens. Run npm run build.
```

---

## Step 13: Build profile — progress photos (optional)

**What to do**

- If the product includes **progress photos** for a build: add a section “Progress photos” with a grid or list of photos, each with **date and description**. This may require a new backend entity (e.g. build_progress_photos) and API; if not in scope yet, add a placeholder section or skip and document in this guide.

**Files to touch**

- `web/src/app/build-detail/page.tsx`; backend if adding progress-photos entity.

**Cursor prompt**

```
Optional: On the build detail page, add a Progress photos section: grid or list of photos with date and description per photo. If the backend has no progress-photos API yet, add a placeholder or a note that it is TODO; otherwise implement the API and wire the section. Use existing design. Run npm run build.
```

---

## Step 14: Mobile build profile — same feature set as web

**What to do**

- On the **mobile build detail** screen, implement the same features as the web build profile (Steps 8–13): header (back, title, edit, optional sync/current-plan), hero image and project overview, completion % and progress bar, task checklist (with add/check/delete), associated closet items gallery, budget tracker (spent vs limit, view expenses), and optional progress photos. Use mobile navigation and components; same APIs and design-system types. See [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md) Step 2 for task checklist wiring.

**Files to touch**

- Mobile build detail screen (e.g. under `mobile/`).

**Cursor prompt**

```
On the Kyarafit mobile build detail screen, implement the same feature set as the web build profile: (1) Header with back, title, edit action, optional sync/current-plan indicator. (2) Hero image and project name/subtitle. (3) Completion %, optional deadline, overall progress bar. (4) Task checklist with add/check/delete; see MOBILE_NEXT_STEPS Step 2. (5) Associated closet items gallery (thumbnail + label, link items). (6) Budget tracker (spent vs limit, view expenses). (7) Optional progress photos if backend supports. Use same APIs and design-system types as web. Run the app and verify.
```

---

## Summary

| Step | Action                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 1    | Backend: validate imageUrl on build create; return 400 if missing.                                     |
| 2    | Design-system: createBuildSchema imageUrl required (z.string().min(1)).                                |
| 3    | Web new build: label "IMAGE (REQUIRED)", disable submit until image set, send required imageUrl.       |
| 4    | Backend: add tasksChecked/tasksTotal (or progress) to builds list response.                            |
| 5    | Web builds page: card layout with image, title, project number, progress bar, "View Details".          |
| 6    | Web builds page: status tabs and filter by tab.                                                        |
| 7    | Mobile: build create (require image); builds list (cards + status tabs).                               |
| 8    | Build profile: header (back, title, edit, optional sync/current-plan), hero image, project overview.   |
| 9    | Build profile: completion %, optional deadline, overall progress bar.                                  |
| 10   | Build profile: task checklist with labels and Add task.                                                |
| 11   | Build profile: associated closet items gallery (thumbnail + label).                                    |
| 12   | Build profile: budget tracker (spent vs limit, progress bar, view expenses).                           |
| 13   | Build profile: progress photos section (optional; backend may be needed).                              |
| 14   | Mobile build profile: same feature set (header, hero, metrics, tasks, items, budget, optional photos). |
