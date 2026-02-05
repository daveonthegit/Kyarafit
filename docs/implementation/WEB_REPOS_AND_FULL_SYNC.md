# Web: IndexedDB Repos and Full Sync

Add **closetRepo**, **conventionsRepo**, and **buildTasksRepo** on web and extend the sync service to push/pull closet, conventions, and build tasks (not just builds). Do steps in order; each has a **Cursor prompt**.

**Platform scope**: This guide is **web-only** (IndexedDB and web sync service). Mobile uses its own storage repos and sync; ensure the backend returns the same entity types for both so feature parity is maintained.

---

## Goal

- **Current gap**: Web has only [buildsRepo](web/src/lib/storage/buildsRepo.ts) and [outboxRepo](web/src/lib/storage/outboxRepo.ts). Sync in [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts) only pushes/pulls builds. Backend sync pull already returns closetItems, builds, buildTasks, conventions, conventionPlans, packingListItems.
- **Target**: Web has IndexedDB repos for closet items, conventions, and build tasks; outbox supports entry types for these; sync push sends their changes and pull merges server data into IndexedDB.

---

## Prerequisites

- [web/src/lib/storage/db.ts](web/src/lib/storage/db.ts): IndexedDB schema and stores (check existing stores; add object stores for closet_items, conventions, build_tasks if not present).
- [web/src/lib/storage/buildsRepo.ts](web/src/lib/storage/buildsRepo.ts) and [web/src/lib/storage/outboxRepo.ts](web/src/lib/storage/outboxRepo.ts): Patterns for repo and outbox.
- Backend [backend/internal/sync/sync.go](backend/internal/sync/sync.go): Pull response includes closetItems, builds, buildTasks, conventions.
- [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts): Push handles build.upsert/build.delete; pull merges only builds.

---

## Step 1: Extend IndexedDB schema for closet, conventions, build tasks

**What to do**

- In [web/src/lib/storage/db.ts](web/src/lib/storage/db.ts): Add object stores (or ensure they exist) for `closet_items`, `conventions`, `build_tasks` with appropriate key paths (e.g. id). Match the shape expected by the backend sync pull (id, updatedAt, deleted flag if applicable). Document the schema version and run a version bump if needed so existing clients upgrade.

**Files to touch**

- `web/src/lib/storage/db.ts`

**Cursor prompt**

```
In web/src/lib/storage/db.ts, add IndexedDB object stores for closet_items, conventions, and build_tasks (if not already present). Use the same pattern as the existing builds store: keyPath id, and store objects that include id and updatedAt at minimum. Bump the database version if required so existing clients get the new stores. Ensure the design-system types for ClosetItem, Convention, BuildTask are used for typing. Do not add repos yet; only the schema/stores.
```

---

## Step 2: Create closetRepo.ts

**What to do**

- Create [web/src/lib/storage/closetRepo.ts](web/src/lib/storage/closetRepo.ts): Functions to get, list, upsert, and delete closet items in IndexedDB (by id; list all). Add `upsertFromSync(item)` for merging server data (last-write-wins by updatedAt). Use the same db instance and store name as in db.ts. Follow the pattern of buildsRepo (e.g. getById, list, upsertFromSync, delete).

**Files to touch**

- `web/src/lib/storage/closetRepo.ts`

**Cursor prompt**

```
Create web/src/lib/storage/closetRepo.ts following the pattern of web/src/lib/storage/buildsRepo.ts: (1) Use the closet_items store from db. (2) Export getById(id), list(), upsertFromSync(item), deleteItem(id, skipOutbox). (3) upsertFromSync accepts an object with id, updatedAt, and other closet item fields from the sync pull response; write to IndexedDB. (4) Use types from design-system for ClosetItem. Run npm run build and ensure no type errors.
```

---

## Step 3: Create conventionsRepo.ts and buildTasksRepo.ts

**What to do**

- Same idea as Step 2: create [web/src/lib/storage/conventionsRepo.ts](web/src/lib/storage/conventionsRepo.ts) and [web/src/lib/storage/buildTasksRepo.ts](web/src/lib/storage/buildTasksRepo.ts) with getById, list (or listByBuildId for tasks), upsertFromSync, delete. buildTasksRepo may need listByBuildId(buildId) for the pull merge. Match backend sync pull shapes (ConventionChange, BuildTaskChange).

**Files to touch**

- `web/src/lib/storage/conventionsRepo.ts`
- `web/src/lib/storage/buildTasksRepo.ts`

**Cursor prompt**

```
Create web/src/lib/storage/conventionsRepo.ts and buildTasksRepo.ts following the same pattern as closetRepo and buildsRepo: (1) conventionsRepo: getById, list, upsertFromSync, delete; store name conventions. (2) buildTasksRepo: getById, list or listByBuildId, upsertFromSync, delete; store name build_tasks. (3) upsertFromSync for each accepts the shape returned by backend sync pull (ConventionChange, BuildTaskChange). (4) Use design-system types where applicable. Run npm run build.
```

---

## Step 4: Extend outbox for closet, convention, build task operations

**What to do**

- In [web/src/lib/storage/outboxRepo.ts](web/src/lib/storage/outboxRepo.ts): Support entry types such as `closet.upsert`, `closet.delete`, `convention.upsert`, `convention.delete`, `buildTask.upsert`, `buildTask.delete` (or equivalent). Add functions to enqueue these (e.g. enqueueClosetUpsert, enqueueClosetDelete) or a generic enqueue(type, payload). Ensure listPending returns all entry types so the sync service can push them.

**Files to touch**

- `web/src/lib/storage/outboxRepo.ts`

**Cursor prompt**

```
In web/src/lib/storage/outboxRepo.ts, extend the outbox to support closet, convention, and build task operations: (1) Add entry types e.g. closet.upsert, closet.delete, convention.upsert, convention.delete, buildTask.upsert, buildTask.delete. (2) Add enqueue functions for each (or a generic enqueue(type, payload)) and ensure remove(id) and listPending() work for all types. (3) Payloads should contain the data needed for the backend API (e.g. for closet.upsert the closet item payload). Do not change the sync service yet; only the outbox. Run npm run build.
```

---

## Step 5: Sync push — handle closet, convention, build task entries

**What to do**

- In [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts), in the push phase (where you iterate over pending outbox entries): for each entry type, call the corresponding backend API (POST/PATCH/DELETE for closet items, conventions, build tasks). Use the same request/response pattern as builds. On success, remove the entry from the outbox; on failure, leave it for retry. Reference backend routes: POST /closet/items, PATCH /closet/items/:id, DELETE /closet/items/:id; convention and build task routes similarly.

**Files to touch**

- `web/src/lib/services/sync.ts`

**Cursor prompt**

```
In web/src/lib/services/sync.ts, extend the push phase to handle closet, convention, and build task outbox entries: (1) For closet.upsert call POST /closet/items (or PATCH if update), for closet.delete call DELETE /closet/items/:id. (2) For convention.upsert/convention.delete use the convention API routes. (3) For buildTask.upsert/buildTask.delete use the build tasks API (e.g. POST/PATCH/DELETE builds/:id/tasks). (4) Use the same request() helper and token; on success call outbox.remove(entry.id). Match backend route paths and payloads. Run npm run build.
```

---

## Step 6: Sync pull — merge closet, conventions, build tasks

**What to do**

- In [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts), in the pull phase: the backend already returns closetItems, builds, buildTasks, conventions. After merging builds, add loops to merge closetItems (using closetRepo.upsertFromSync or delete), conventions (conventionsRepo), and buildTasks (buildTasksRepo). Use last-write-wins by updatedAt; handle deleted flag if the backend sends it. Update last_sync_timestamp after all merges.

**Files to touch**

- `web/src/lib/services/sync.ts`

**Cursor prompt**

```
In web/src/lib/services/sync.ts, extend the pull phase to merge closet items, conventions, and build tasks: (1) After merging builds, iterate over data.closetItems (or data.closetItems): for each, if deleted remove from closetRepo else upsertFromSync. (2) Same for data.conventions and conventionsRepo. (3) Same for data.buildTasks and buildTasksRepo. (4) Use last-write-wins by updatedAt where applicable. (5) Update last_sync_timestamp after all merges. Ensure the pull response type includes closetItems, conventions, buildTasks. Run npm run build.
```

---

## Summary

| Step | Action                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Add IndexedDB stores for closet_items, conventions, build_tasks.                |
| 2    | Create closetRepo.ts (getById, list, upsertFromSync, delete).                   |
| 3    | Create conventionsRepo.ts and buildTasksRepo.ts.                                |
| 4    | Extend outbox with closet/convention/buildTask entry types and enqueue.         |
| 5    | Sync push: handle closet, convention, build task entries and call backend APIs. |
| 6    | Sync pull: merge closetItems, conventions, buildTasks into repos.               |

After Step 6, web can do full bidirectional sync for builds, closet, conventions, and build tasks (within backend support).
