# Drag-and-Drop: Closet Items into Builds; Tasks into Closet Items

Implement **drag closet items onto builds** to link them, and **drag tasks onto closet items** in a build to assign the task to that item. Do steps in order; each has a **Cursor prompt**.

**Feature parity**: Same behavior on **web and mobile**: link closet items to a build, assign tasks to closet items. Web uses drag-and-drop; mobile uses long-press + tap or menu (Step 3). Same backend APIs for both.

---

## Goal

- **Closet → Build**: User drags a closet item and drops it onto a build (card or row) to add that item to the build's linked items. Backend: `POST /builds/:id/items` with `{ closetItemIds }` or equivalent.
- **Task → Closet**: In a build's profile, user drags a task and drops it onto a linked closet item to set the task's `closetItemId`. Backend: `PATCH /builds/:id/tasks/:taskId` with `{ closetItemId }`.

---

## Prerequisites

- Build detail and link-items pages: [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx), [web/src/app/build-detail/link-items/page.tsx](web/src/app/build-detail/link-items/page.tsx).
- API: link items `POST /builds/:id/items` (body: closetItemIds); update task `PATCH` with closetItemId. See [backend](backend) and [web/src/lib/api/builds.ts](web/src/lib/api/builds.ts).
- Design-system: BuildTask has closetItemId; backend supports it.

---

## Step 1: Web — drag closet items onto build (link-items or build detail)

**What to do**

- On the link-items page (or build detail), implement drag-and-drop: (1) Closet items list is draggable (use HTML5 DnD or a library like @dnd-kit/core). (2) The build (or a "drop zone" representing the build) is a drop target. (3) On drop, add the dropped closet item ID to the build's linked items by calling the link-items API (e.g. fetch current linked IDs, append the new ID, call POST with the full list). (4) Refetch build items and closet list after success. If using a library, follow its patterns for draggable and droppable IDs and payload.

**Files to touch**

- [web/src/app/build-detail/link-items/page.tsx](web/src/app/build-detail/link-items/page.tsx) (or build-detail page if combining). Optionally add a shared DnD context/hook.

**Cursor prompt**

```
In the Kyarafit web app, implement drag-and-drop to link closet items to a build: (1) On the build-detail link-items page (or build detail), make closet items draggable. (2) Add a drop zone for the build (e.g. the build card or a "Drop here to link" area). (3) On drop, get the dropped closet item ID and call the API to add it to the build's linked items (e.g. GET current linked IDs, append new ID, POST /builds/:id/items with { closetItemIds }). (4) Refetch build items and update UI. Use HTML5 drag-and-drop or @dnd-kit/core; keep accessibility in mind. Run npm run build and test dragging a closet item onto the build.
```

---

## Step 2: Web — drag tasks onto linked closet items (assign task)

**What to do**

- On the build detail page, in the section that shows tasks and linked items: (1) Make tasks draggable (or task rows). (2) Make each linked closet item a drop target. (3) On drop (task onto closet item), call updateBuildTask(buildId, taskId, { closetItemId: closetItem.id }). (4) Refetch tasks so the task shows as assigned (e.g. label "(linked)" or the item name). Handle the case where the task already had a closetItemId (overwrite or show confirm).

**Files to touch**

- [web/src/app/build-detail/page.tsx](web/src/app/build-detail/page.tsx) and/or [web/src/components/builds/TaskChecklist.tsx](web/src/components/builds/TaskChecklist.tsx). May need to pass linked items and onAssign into TaskChecklist.

**Cursor prompt**

```
In the Kyarafit web app, implement drag-and-drop to assign a task to a closet item: (1) On build detail, make each task row (or task in TaskChecklist) draggable. (2) Make each linked closet item a drop target. (3) On drop of a task onto a closet item, call updateBuildTask(buildId, taskId, { closetItemId: closetItem.id }) from web/src/lib/api/builds. (4) Refetch build tasks so the UI shows the assignment. Ensure TaskChecklist or build-detail has access to linked items and the update API. Use the same DnD approach as closet→build (e.g. @dnd-kit). Run npm run build.
```

---

## Step 3: Mobile — equivalent gestures (optional)

**What to do**

- On mobile, implement equivalent behavior: long-press on a closet item to "pick up", then tap a build to link; or long-press task and tap a closet item to assign. Use React Native gesture APIs or a library. Document in this guide.

**Files to touch**

- Mobile build detail and link-items screens (e.g. under `mobile/`).

**Cursor prompt**

```
In the Kyarafit mobile app, add the equivalent of web drag-drop for linking and assignment: (1) Link closet item to build: e.g. long-press closet item then tap build, or "Add to build" menu that shows build list. (2) Assign task to closet item: long-press task then tap linked item, or task menu "Assign to" with linked items. Call the same backend APIs (link items, update task closetItemId). Document in DRAG_DROP_IMPLEMENTATION.md as Step 3.
```

---

## Summary

| Step | Action                                                                                              | Status      |
| ---- | --------------------------------------------------------------------------------------------------- | ----------- |
| 1    | Web: draggable closet items, drop zone on build; on drop call link-items API.                       | ✅ Complete |
| 2    | Web: draggable tasks, drop targets on linked items; on drop call updateBuildTask with closetItemId. | ✅ Complete |
| 3    | Mobile: long-press + tap or menu to link and to assign (optional).                                  | 🔜 Pending  |

## Implementation Notes

### Step 1: Closet Items → Build (Web) ✅

**Completed:** February 5, 2026

**Implementation Details:**

- Added drag-and-drop functionality to `web/src/app/build-detail/link-items/page.tsx`
- Uses `@dnd-kit/core` library (v6.3.1)
- Created `DraggableClosetItem` component for draggable closet items
- Created `DroppableBuildZone` component for the drop target
- Visual feedback: drop zone highlights when hovering with dragged item
- Maintains backward compatibility: users can still use checkboxes to select items
- On drop, items are automatically added to the selected items set

**User Experience:**

- Users can now drag closet items from the list onto a drop zone to quickly add them to a build
- Drop zone shows visual feedback (highlight and scale effect) when hovering
- Selected items count updates in real-time
- Traditional checkbox selection still works alongside drag-and-drop

### Step 2: Tasks → Closet Items (Web) ✅

**Already Implemented:** Prior to this session

**Implementation Details:**

- Located in `web/src/app/build-detail/page.tsx`
- Uses `@dnd-kit/core` library
- `DraggableTask` component makes tasks draggable
- `DroppableClosetItem` component makes closet items droppable
- On drop, calls `updateBuildTask` with the `closetItemId`
- Tasks show "(linked)" indicator when assigned to a closet item

**User Experience:**

- Users can drag tasks onto closet items to assign them
- Visual feedback shows which closet item is being hovered
- Tasks display their linked status in the UI
