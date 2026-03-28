# Build tasks system

This document describes how **build tasks** (`buildTasks` in Convex) work today: data shape, APIs, authorization, and how they connect to builds, cosplay nodes, conventions/packing, progress, and clients.

## Purpose

Build tasks are checklist rows: **label**, **checked**, **sort order**, optional **due date**, and optional links to a **build** and/or a **cosplay node** (element/material). They drive:

- Per-build checklist UI and **build progress** (ratio of checked tasks).
- Per-node task lists (including node-only tasks with no `buildId`).
- **Planner / todo** views that group tasks by convention day (via `conventionDayPlans`) or packing.
- **Packing**: auto-generated “Pack: …” tasks and manual packing rows mirrored into tasks.

## Schema (`convex/schema.ts`)

`buildTasks` fields:

| Field               | Notes                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `userId`            | Owner                                                                                          |
| `buildId`           | Optional; omit for node-only tasks                                                             |
| `label`             | Display text; packing auto-tasks use `Pack: {node name}`                                       |
| `closetItemId`      | Legacy; new writes from `buildTasks` mutations set this to `undefined` and use `cosplayNodeId` |
| `cosplayNodeId`     | Optional link to a cosplay node                                                                |
| `packingListItemId` | Optional; links a task to a **manual** packing list row                                        |
| `sortOrder`         | Ordering within a list                                                                         |
| `checked`           | Completion                                                                                     |
| `dueDate`           | Optional `YYYY-MM-DD` (validated in mutations)                                                 |

Indexes: `by_buildId`, `by_userId`, `by_closetItemId`, `by_cosplayNodeId`, `by_packingListItemId`.

**Related schema:** `closetItems` still has `completionTaskId` (legacy table); primary task linkage for nodes is `cosplayNodeId` on `buildTasks`.

## Convex module (`convex/buildTasks.ts`)

### ID resolution

- `cosplayNodeId` and `closetItemId` args accept **either** `Id<"cosplayNodes">` or `Id<"closetItems">`.
- `resolveCosplayNodeId` maps a closet item id to the cosplay node with `legacyClosetItemId`, or returns the id if it is already a cosplay node.

### Queries

| Export              | Args                              | Behavior                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listByBuild`       | `buildId`                         | All tasks for that build (unordered from index; UI typically sorts).                                                                                                                                                                                                                                                                                           |
| `listByCosplayNode` | `cosplayNodeId` (legacy id union) | Tasks with resolved `cosplayNodeId`, sorted by `sortOrder`; each row includes optional `buildName` if `buildId` set.                                                                                                                                                                                                                                           |
| `listByClosetItem`  | `closetItemId` (legacy id union)  | Same as `listByCosplayNode` after resolving the node.                                                                                                                                                                                                                                                                                                          |
| `listByBuilds`      | `buildIds[]`                      | `{ buildId, tasks }[]` for itinerary-style views.                                                                                                                                                                                                                                                                                                              |
| `listForPlanner`    | `userId`                          | **Auth:** caller identity must match `userId`. Collects all user tasks by `by_userId`. Includes (1) tasks with `buildId` (build name, optional `conventionId` / effective `dueDate` from earliest `conventionDayPlans` date per build), (2) tasks with `packingListItemId` (convention name and date from packing item). Sorted by `dueDate` then `sortOrder`. |

### Mutations

**`create`** (`userId`, optional `buildId`, `label`, optional `cosplayNodeId` / `closetItemId`, optional `sortOrder`, optional `dueDate`):

- If `buildId` is set: verifies build exists and `canUserEditBuild`; default `sortOrder` is current count of tasks for that build; stores `cosplayNodeId` if resolved.
- Else: requires a resolved cosplay node; verifies node ownership; default `sortOrder` is count of tasks for that node; no `buildId`.

**`update`** (`id`, `userId`, optional fields):

- Allowed if `task.userId === userId` **or** user can edit the task’s `buildId` build.
- Patches `label`, `sortOrder`, `checked`, `dueDate` (null clears), and optional node assignment (null clears); assignment always clears `closetItemId` on the document.
- If `checked` changes and `packingListItemId` is set: patches the linked `packingListItems` row’s `checked` to match (manual packing sync).

**`remove`** (`id`, `userId`): Same authorization as `update`; deletes the task.

## How other modules use tasks

### Builds (`convex/builds.ts`)

List/detail queries load tasks per build via `by_buildId` and compute:

- `tasksTotal`, `tasksChecked`, and `progress` = round(`tasksChecked / tasksTotal * 100`) when `tasksTotal > 0`, else `0`.

### Cosplay graph / rollup (`convex/cosplayNodes.ts` + `convex/lib/cosplayGraph.ts`)

For each node, tasks considered for rollup are those with matching `cosplayNodeId`:

- With a `buildId` context: tasks come from the build’s task list filtered to that node.
- Without: tasks from `by_cosplayNodeId` for that node.

`completedTaskCount` / `taskCount` feed **overall bucket** and **progress percent** for elements and materials (together with statuses and child summaries).

### Conventions and packing (`convex/conventions.ts`)

- **`findPackTask`**: Locates the build task whose label starts with `Pack:` and whose `cosplayNodeId` or legacy `closetItemId` matches the packing item.
- **Build-linked packing items**: `checked` is read from the pack task when present; updates to packing `checked` sync back to that task.
- **Manual packing items** (`addManualPackingItem`): Inserts a `buildTasks` row with `packingListItemId`, label `Pack: {label}`, optional `dueDate`; no `buildId`. Deleting the packing item deletes the linked task.
- **`regeneratePacking`**: For each build/day plan link, creates packing rows and ensures a per-node `Pack:` task on the build (deduped by node + `Pack:` prefix).

### Legacy closet (`convex/closetItems.ts`)

Deleting or unlinking a cosplay node clears `cosplayNodeId` on its tasks (or removes assignment) so tasks are not orphaned with invalid node refs.

## Client surfaces

| Area                | Mechanism                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Web build detail    | `api.buildTasks.listByBuild`, `update`; `TaskChecklist`, drag-reorder, assign to node, due dates                                        |
| Web closet detail   | `listByClosetItem`, `create` / `update` / `remove`                                                                                      |
| Web planner         | `listForPlanner`, `update` (toggle); groups by convention / build                                                                       |
| Mobile build detail | Convex queries/mutations; local `buildTasksRepo` + outbox for offline `buildTask.upsert` / `buildTask.delete` synced in `convexSync.ts` |
| Mobile planner      | Same as web planner API                                                                                                                 |
| Mobile itinerary    | `listByBuilds` + local task list                                                                                                        |

## Design-system types (`design-system/types/builds.ts`)

`buildTaskSchema` / `BuildTask` are UUID-oriented client shapes; Convex uses Convex `Id` types and optional fields such as `dueDate` and `packingListItemId` that may not appear in every Zod schema.

## Product spec cross-reference

High-level acceptance criteria and roadmap notes live in [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (section “Build tasks”). Web wiring notes: [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md).
