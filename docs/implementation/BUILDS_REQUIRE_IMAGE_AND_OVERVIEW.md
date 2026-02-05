# Builds: Require Image + Overview Like Example Screen

Implement **required image for builds** and **builds list as card layout** matching [example screens/builds_overview](example screens/builds_overview). Do steps in order; each step has a **Cursor prompt**.

---

## Goal

- **Require image**: New/updated builds must have a non-empty `imageUrl` (backend validation, design-system schema, web form).
- **Builds list**: Replace the current row list with full-width **cards**: large image, title, project number, construction progress (from tasks), tags/descriptor, "View Details". Add status tabs (Current / Archived / Planning / Completed). Progress data must be available (backend or batch fetch).

---

## Prerequisites

- [web/src/app/builds/page.tsx](web/src/app/builds/page.tsx): Simple list (name, status, chevron); no images.
- [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx): Image optional; submit allowed without image.
- Backend build create: no validation that `image_url` is present.
- [design-system/types/builds.ts](design-system/types/builds.ts): `createBuildSchema` has `imageUrl` optional.

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

## Step 7: Mobile build create — require image (when implemented)

**What to do**

- When the mobile app has a build-creation screen, add the same requirement: image required, validation before submit, and pass non-empty imageUrl to the API. Reference the web and backend behavior.

**Files to touch**

- Mobile build create screen (e.g. in `mobile/`).

**Cursor prompt**

```
When implementing or updating mobile build creation in the Kyarafit app: require an image (same as web and backend). Validate that imageUrl is set before allowing submit; pass it as required to the create-build API. Show a clear label that image is required and block submit until an image is selected or uploaded.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Backend: validate imageUrl on build create; return 400 if missing. |
| 2 | Design-system: createBuildSchema imageUrl required (z.string().min(1)). |
| 3 | Web new build: label "IMAGE (REQUIRED)", disable submit until image set, send required imageUrl. |
| 4 | Backend: add tasksChecked/tasksTotal (or progress) to builds list response. |
| 5 | Web builds page: card layout with image, title, project number, progress bar, "View Details". |
| 6 | Web builds page: status tabs and filter by tab. |
| 7 | Mobile: require image on build create when that screen exists. |
