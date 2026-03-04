# Builds: Require Image + Overview + Build Profile

**Purpose:** Optional enforcement that builds have an image; builds list as card layout with progress and status tabs; build detail (profile) page with full feature set. Same features on web and mobile where applicable.

**Scope:** In: Convex build create validation, design-system schema, web/mobile builds list and build detail. Out: Visual style of reference screens (implement features only, not copy aesthetic).

**Current state:**

- **Backend:** [convex/builds.ts](convex/builds.ts) — `create` mutation accepts optional `imageUrl`/`imageStorageId`; no validation. `list` returns builds with `tasksTotal`/`tasksChecked` (progress available).
- **Web:** [web/src/app/builds/page.tsx](web/src/app/builds/page.tsx) — list (name, status, chevron); no cards. [web/src/app/builds/new/page.tsx](web/src/app/builds/new/page.tsx) — image optional. [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) — detail with tasks, linked items, ImageUpload, TaskChecklist.
- **Design system:** [design-system/types/builds.ts](design-system/types/builds.ts) — `createBuildSchema` has `imageUrl` optional.

**Next steps:**

1. **Convex:** In `convex/builds.ts` `create` handler, require `imageUrl` or `imageStorageId` (at least one non-empty); throw error if missing.
2. **Design-system:** In `createBuildSchema`, make `imageUrl` required (e.g. `z.string().min(1)`); fix any call sites.
3. **Web builds/new:** Require image before submit; disable button until image set; send required imageUrl/imageStorageId.
4. **Web builds list:** Replace list with card layout (image, title, progress from tasksTotal/tasksChecked, status); add status tabs (e.g. Current / Archived / Planning / Completed). Use `api.builds.list` (already returns tasksTotal/tasksChecked).
5. **Build detail:** Ensure header, hero image, metrics (completion %, progress bar), task checklist, linked items, budget tracker are present; add task→closet assignment if not done (see DRAG_DROP_IMPLEMENTATION).
6. **Mobile:** Same requirements: list as cards + tabs; build detail feature set; require image on create when enforced.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Builds, Build tasks), [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md), [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
