# Web vs Mobile Parity Review

This document summarizes feature parity between the **web** app and the **mobile** (Expo/React Native) app, with focus on drag-and-drop and related flows. **Stack:** Convex + Better Auth. Last reviewed: March 2026.

---

## Implementation status

| #    | Item                                                    | Status                          |
| ---- | ------------------------------------------------------- | ------------------------------- |
| §4   | Convention detail & itinerary use Convex when signed in | Done                            |
| §3   | Mobile build edit (inline on build detail)              | Done                            |
| §5   | Add-item: Convex when signed in (or confirm sync)       | To confirm                      |
| §6   | Settings: storage/tier on mobile                        | Deferred (web-only for now)     |
| §1–2 | Drag-and-drop on mobile (task→item, item→build)         | Option B/C (hints or tap-based) |

---

## Summary: Web-only features

| Feature                                              | Web                  | Mobile                      |
| ---------------------------------------------------- | -------------------- | --------------------------- |
| **Drag tasks onto closet items** (build detail)      | ✅ DnD + link button | ❌ Link button / modal only |
| **Drag closet items onto build** (link-items screen) | ✅ DnD + checkboxes  | ❌ Checkboxes only          |

Both flows are **possible** on mobile via the existing non-drag UI (task-assign modal, checkbox selection). The gap is **convenience and UX**: web offers drag-and-drop in addition to those.

---

## 1. Task → Closet item assignment (Build detail)

### Web (`web/src/app/build-detail/page.tsx` + `TaskChecklist.tsx`)

- **Drag and drop:** Tasks are draggable; dropping a task on a closet item card assigns that task to the item (`buildTasks.update` with `closetItemId`).
- **Fallback:** "Assign to item" link button on each task opens a modal to pick a linked item (or unassign).
- **Libraries:** `@dnd-kit/core` (`DndContext`, `useDraggable`, `useDroppable`).

### Mobile (`mobile/app/build-detail.tsx`)

- **No drag and drop.** Closet item cards are not drop targets; tasks are not draggable.
- **Same outcome via modal:** Long-press (or tap) the link icon on a task → "Assign Task to Item" modal → choose item or "Unassign". Same `updateTask(..., { closetItemId })` behavior.

**Gap:** Mobile cannot drag a task onto a closet item; assignment is modal-only.

---

## 2. Closet item → Build assignment (Link items screen)

### Web (`web/src/app/build-detail/link-items/page.tsx`)

- **Drag and drop:** Closet items are draggable; a "Drop items here to add to build" zone adds the dropped item to the build’s selection (updates local `selectedIds`, then Save).
- **Fallback:** Checkbox on each row to toggle selection. Save persists `selectedIds` via `builds.linkItems`.

### Mobile (`mobile/app/build-link-items.tsx`)

- **No drag and drop.** No drop zone; no draggable items.
- **Same outcome via checkboxes:** Tap row to toggle selection; Save calls `linkBuildItems(buildId, Array.from(selectedIds))`.

**Gap:** Mobile cannot drag a closet item into a "add to build" zone; selection is checkbox-only.

---

## Implementation options for mobile

### Option A: Add a drag-and-drop library (React Native)

- Use a library that supports drag-and-drop on RN (e.g. **react-native-draggable-flatlist**, **react-native-gesture-handler** + **react-native-reanimated** for custom DnD, or **@dnd-kit** if used with react-native-web only).
- **Pros:** Closer parity with web; familiar drag metaphor.
- **Cons:** RN DnD is more involved; possible performance and gesture conflicts; need to define drop targets (e.g. closet item cards, build drop zone) and hit-testing.

### Option B: Keep current UX, improve discoverability

- Keep modal (task → item) and checkboxes (item → build).
- Add short hints: e.g. "Long-press the link icon to assign a task to an item" and "Tap items to add them to this build."
- **Pros:** No new dependencies; quick to ship.
- **Cons:** No drag-and-drop parity.

### Option C: Tap-based “drop zone” (no real drag)

- **Link-items screen:** Add a prominent "Add to build" area at top; tapping an item could "add" it to that zone (e.g. move it into a "selected" list above), or keep current checkbox list and add a "Tap item to add to build" hint.
- **Build detail:** Keep task list and closet grid; add "Tap a task, then tap an item to assign" (tap-to-select task, then tap closet item to assign).
- **Pros:** No DnD library; works well on touch.
- **Cons:** Two-tap flow is not the same as drag-and-drop.

---

## Recommendation

- **Short term:** Option B (hints) to clarify existing flows; optionally Option C for a two-tap "assign task → item" on build detail.
- **Medium term:** If product prioritizes parity and RN stack is stable, evaluate Option A with a single RN DnD library and implement:
  1. Build detail: draggable task rows + droppable closet item cards.
  2. Link-items: draggable closet rows + droppable "add to build" zone.

---

## Files reference

| Area                                | Web                                                                                | Mobile                               |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| Build detail (tasks + closet items) | `web/src/app/build-detail/page.tsx`, `web/src/components/builds/TaskChecklist.tsx` | `mobile/app/build-detail.tsx`        |
| Link items to build                 | `web/src/app/build-detail/link-items/page.tsx`                                     | `mobile/app/build-link-items.tsx`    |
| DnD dependency                      | `@dnd-kit/core`, `@dnd-kit/utilities` in `web/package.json`                        | Not present in `mobile/package.json` |

---

## Additional parity concerns

### 3. Edit build (web: on detail; mobile: on detail)

- **Web:** Build **detail** page has inline editing: tap the edit icon to toggle edit mode and change name, character, status, image, budget, and deadline on the same page (no separate edit route).
- **Mobile:** Build **detail** page has inline editing: tap the pencil icon to toggle edit mode and change name, character, status, budget, and deadline (image edit not in scope). Uses Convex `builds.update` when signed in, local `updateBuild` when anonymous.
- **Status:** Parity achieved for editable fields (name, character, status, budget, deadline).

### 4. Convention detail & itinerary: mobile uses Convex when signed in

- **Web:** Convention detail (`/conventions/[id]`) and itinerary (`/itinerary`) use **Convex only** (`api.conventions.get`, `getPlan`, `getPacking`, etc.).
- **Mobile:** `convention-detail.tsx` and `itinerary.tsx` now use **Convex when signed in** (`useQuery(api.conventions.get)`, `getPlan`, `replacePlan`, `regeneratePacking`, `api.builds.list`; itinerary also uses `api.buildTasks.listByBuilds`). When anonymous, they fall back to local storage. Build detail (`build-detail.tsx`) also uses Convex when signed in and supports inline edit.
- **Status:** Implemented. Signed-in users see Convex data on convention detail, itinerary, and build detail.

### 5. Add-item (closet): mobile writes local only

- **Web:** Add-item redirects to `/closet/new`; new items are created via `api.closetItems.create` (Convex).
- **Mobile:** `add-item.tsx` calls `upsertItem(item)` from `closetRepo` (SQLite only). New items are stored locally; they may be synced to Convex later by `useConvexSync` if that flow covers closet items.
- **Recommendation:** Confirm whether Convex sync pushes local closet items to the cloud. If not, add-item should call Convex create when signed in (and optionally write to SQLite for offline cache).

### 6. Settings: storage / subscription (web only)

- **Web:** Settings page uses `useTier()` and shows **storage usage** (e.g. `currentUsageMb / storageLimitMb`) and subscription/upgrade copy.
- **Mobile:** Settings shows sign-in prompt when not signed in and "Upgrade for backup and export" when signed in; **no tier API, no storage stats**.
- **Recommendation:** If tier/storage is product-relevant on mobile, add the same API (or a mobile-friendly endpoint) and show storage in mobile settings; otherwise document as web-only for now.

### 7. Auth flows (minor)

- **Web:** Separate routes for sign-in, sign-up, reset-password, and verify-email inbox (check-your-inbox page).
- **Mobile:** Single `AuthScreen` with mode switch (signin / signup / forgot). Resend verification and “check your inbox” messaging live in-context; reset link redirects to **web** `/auth/reset-password` (by design).
- **Verdict:** Parity is acceptable; mobile doesn’t need a dedicated verify-email inbox route if in-context messaging is clear.

### 8. Planner vs Plan tab

- **Web:** `/planner` exists but uses **hardcoded mock data** (fake conventions, "October 24", etc.). The **Plan** tab in the nav points to `/conventions`, which is the real Convex-backed conventions list.
- **Mobile:** Plan tab is real Convex + SQLite conventions list; no stub.
- **Verdict:** Web planner is a stub; no mobile parity issue. Consider removing or implementing `/planner` on web so it matches conventions/plan behavior.

### 9. Edit / delete convention

- **Web:** Convention detail has no visible edit or delete convention action in the reviewed files; Convex has `api.conventions.update` and `api.conventions.remove`.
- **Mobile:** Convention detail and convention-new are local-only; no Convex update/remove in the UI.
- **Recommendation:** If product requires editing or deleting conventions, add the same actions on both web and mobile and wire to Convex.

---

## Route / screen mapping (quick reference)

| Area               | Web route(s)                                               | Mobile route(s)                 |
| ------------------ | ---------------------------------------------------------- | ------------------------------- |
| Home               | `/`, `/home`                                               | `(tabs)/index`                  |
| Builds list        | `/builds`                                                  | `(tabs)/builds`                 |
| Build detail       | `/build-detail?id=`                                        | `/build-detail?id=`             |
| Build edit         | Inline on build detail (no separate route)                 | —                               |
| New build          | `/builds/new`                                              | `/build-new`                    |
| Link items         | `/build-detail/link-items?id=`                             | `/build-link-items` (params)    |
| Closet             | `/closet`                                                  | `/closet`                       |
| New closet item    | `/closet/new`, `/add-item` → redirect                      | `/add-item`                     |
| Conventions        | `/conventions`                                             | `(tabs)/plan`                   |
| Convention detail  | `/conventions/[id]`                                        | `/convention-detail` (params)   |
| Convention packing | `/conventions/[id]/packing`                                | `(tabs)/packing` (conventionId) |
| Packing list       | `/packing` (convention picker)                             | `(tabs)/packing`                |
| Itinerary          | `/itinerary`                                               | `/itinerary`                    |
| Planner (stub)     | `/planner` (mock data)                                     | —                               |
| Settings           | `/settings`                                                | `/settings`                     |
| Auth               | `/auth/signin`, signup, reset-password, verify-email/inbox | `/auth` (AuthScreen)            |
