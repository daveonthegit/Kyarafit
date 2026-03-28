# Cosplay Workflow System

## Purpose
- Replace the old flat `buildTasks` checklist model with a centralized workflow system that can drive build detail, element/material detail, planner, packing, progress rollups, and mobile/offline sync.

## Core Tables
- `workflowItems`
  - Canonical work records for tasks, milestones, and groups.
  - Supports hierarchy with `parentId` + `ancestorIds`, richer statuses, weighted progress, ownership fields, dates, time/cost estimates, templates, and provenance (`legacyBuildTaskId`).
- `workflowAttachments`
  - Normalized multi-entity links between a workflow item and builds, cosplay nodes, conventions, packing items, or planner buckets.
  - `role` differentiates primary ownership, context, progress-source links, packing entries, and completion anchors.
- `workflowDependencies`
  - Encodes `prerequisite`, `blocks`, and `related` relationships between workflow items.
- `workflowTemplates` / `workflowTemplateItems`
  - Reusable workflow blueprints. Built-in templates seed common cosplay flows such as wig styling, prop building, convention essentials, and makeup tests.

## Migration
- Legacy `buildTasks` rows are kept as a migration source during rollout.
- `convex/migrations.ts` backfills:
  - `buildTasks.checked=true` -> `workflowItems.status="done"`
  - `buildTasks.checked=false` -> `workflowItems.status="not_started"`
  - build, node, and packing links into `workflowAttachments`
  - legacy completion-task references into `completion_anchor` attachments
- Mobile SQLite performs a local compatibility migration from `build_tasks` into `workflow_items` / `workflow_attachments` on startup.

## Progress Model
- `convex/lib/workflowProgress.ts` centralizes all workflow progress math.
- Leaf workflow items use:
  - `manualProgressPercent` when present
  - otherwise status-derived progress
- Group and milestone items use weighted child progress plus attached external progress sources.
- Build progress blends:
  - 50% workflow progress
  - 35% linked node/material progress
  - 15% packing readiness
- Missing sources are renormalized instead of treated as hard zeroes.
- Manual build progress override still wins when present.

## Shared vs Build-Specific Work
- Shared workflow belongs to reusable nodes/materials and persists across builds.
- Build-specific workflow is attached to both the node and the build context for one-off prep, modification, packing, or convention work.
- Node detail surfaces now support a shared/build-specific split instead of one flat task bucket.

## Packing Integration
- Packing no longer depends on `Pack:` label prefixes.
- `packingListItems.workflowItemId` links packing entries to real workflow items.
- Server packing mutations keep workflow item status in sync.
- Mobile local packing rows now preserve `workflow_item_id` and update linked workflow status when toggled.

## Planner Model
- Planner views now consume `api.workflow.listPlanner`.
- The feed can mix:
  - build work
  - shared item work
  - packing work
  - event-bound prep
- UI uses workflow status, blocked dependency counts, overdue state, and progress instead of only `checked`.

## Mobile / Offline
- Local storage now includes:
  - `workflow_items`
  - `workflow_attachments`
  - `workflow_dependencies`
  - `packing_list_items.workflow_item_id`
- Existing mobile task repos keep their function names for compatibility, but now read/write workflow-backed records.
- Outbox events were renamed from `buildTask.*` to `workflowItem.*`.
- Convex sync still uses compatibility mutations for some legacy ID flows, especially where local closet-item IDs must be resolved safely.

## Current Limitations
- Mobile UI does not yet expose full dependency editing or template application flows.
- Some web/mobile compatibility surfaces still consume the thin `buildTasks` wrapper while the migration window remains open.
- Notification delivery for reminders is not implemented yet; reminder data is stored for planner use and future delivery work.
