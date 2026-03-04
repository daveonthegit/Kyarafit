# Drag-and-Drop: Closet Items → Builds; Tasks → Closet Items

**Purpose:** (1) Link closet items to a build via drag-drop (or equivalent UI) on build detail / link-items page. (2) Assign a build task to a closet item (set closetItemId on task) via drag-drop or menu. Web and mobile: same capabilities where applicable.

**Scope:** In: Build detail and link-items page, Convex mutations builds.linkItems and buildTasks.update. Out: Go REST API (POST /builds/:id/items, etc.); web uses Convex only.

**Current state:**

- **Convex:** [convex/builds.ts](convex/builds.ts) — `linkItems` mutation (buildId, userId, closetItemIds). [convex/buildTasks.ts](convex/buildTasks.ts) — `update` accepts optional `closetItemId`.
- **Web build detail:** [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) — has DndContext, droppable; linked items and tasks from Convex. [web/src/app/build-detail/link-items/page.tsx](web/src/app/build-detail/link-items/page.tsx) — link closet items to build.
- **Linking:** Use `useMutation(api.builds.linkItems)` with current build id and list of closet item ids (append or replace as needed). On drop of closet item onto build (or "Link items" page), add that item id to linkItems.
- **Task assignment:** On drop of task onto closet item (or menu "Assign to [item]"), call `api.buildTasks.update` with taskId and closetItemId.

**Next steps:**

1. **Link items:** On link-items page (or build detail), ensure drag-drop or list+button adds closet item to build by calling `api.builds.linkItems` with updated list (existing ids + new id). Remove link: same mutation with id removed from list.
2. **Task → closet item:** On build detail, make tasks draggable and linked closet items drop targets (or add per-task menu "Assign to…"); on assign, call `api.buildTasks.update(buildId, taskId, { closetItemId })`. Use @dnd-kit or HTML5 DnD; keep accessibility in mind.
3. **Mobile:** Equivalent flows: link items to build (picker or list); assign task to closet item (picker or list).

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Builds, Build tasks), [convex/builds.ts](convex/builds.ts), [convex/buildTasks.ts](convex/buildTasks.ts), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
