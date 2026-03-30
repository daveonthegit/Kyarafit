# Cosplay Elements Graph Migration

## Overview

Kyarafit now treats the old `closet items` domain as a compatibility layer over a new graph-based cosplay inventory model.

The new source of truth is:

- `cosplayNodes`
- `cosplayNodeLinks`
- `buildCosplayLinks`
- `buildNodeStates`

Legacy `closet` names still exist temporarily in a few APIs and UI surfaces so existing web/mobile flows keep working during migration, but new backend behavior should be implemented against the cosplay graph.

## Domain Model

- `cosplayNodes` stores both `element` and `material` nodes.
- Shared fields include naming, notes, image/source metadata, tags, cost data, quantity/unit data, and state fields.
- Elements can contain child elements.
- Materials can contain child materials or child elements.
- Elements cannot contain materials.
- `cosplayNodeLinks` stores reusable hierarchy edges with `linkMode` and `sortOrder`.
- `buildCosplayLinks` stores root-level build membership for either elements or materials.
- `buildNodeStates` stores build-specific overlays for status, completion override, cost overrides, quantity overrides, and milestone dates.

## Status And Progress

- Elements use `purchaseStatus` plus `buildStatus`.
- Materials use `materialStatus`.
- UI-facing overall state is derived into `incomplete`, `in_progress`, or `complete`.
- Progress is derived from completed child nodes plus completed linked tasks.
- Manual completion override is supported through `manualOverallBucket`.

## Cost Rules

- Direct cost is stored on each node or build-state override.
- Materials can use either total-cost or per-unit pricing.
- Rollups include descendants recursively.
- Rollups dedupe already-visited descendants so reused subgraphs are not double-counted.

## Integrity Rules

- Allowed edges:
  - `element -> element`
  - `material -> material`
  - `material -> element`
  - `element -> material` is rejected
- Cycle creation is blocked before link insertion.
- Child order is persisted on the link record.
- Deletion defaults to unlink behavior; reusable descendants are preserved unless an explicit cascade path is used.

## Migration

Kyarafit now uses Convex's `@convex-dev/migrations` component for the data backfill.

Component setup:

- [convex.config.ts](C:\Users\darkf\Documents\Kyarafit\convex\convex.config.ts) registers `@convex-dev/migrations`
- [migrations.ts](C:\Users\darkf\Documents\Kyarafit\convex\migrations.ts) defines the serial migration chain
- [cosplayMigration.ts](C:\Users\darkf\Documents\Kyarafit\convex\cosplayMigration.ts) exposes an authenticated app-side trigger/status wrapper

The migration sequence is:

- `backfillCosplayNodesFromClosetItems`
- `backfillCosplayNodeLinksFromClosetItems`
- `backfillBuildCosplayLinksFromBuildItemLinks`
- `backfillBuildTaskCosplayRefs`
- `backfillPackingListCosplayRefs`

You can run it either through the authenticated wrapper mutation or directly via Convex migrations tooling.

What it does:

- Migrates each legacy `closetItems` row into `cosplayNodes`
- Converts legacy `closetItems.parentItemId` into `cosplayNodeLinks` where the relationship is valid
- Preserves the original reference in `legacyClosetItemId`
- Converts `buildItemLinks` into `buildCosplayLinks`
- Rewrites `buildTasks.closetItemId` into `buildTasks.cosplayNodeId`
- Rewrites `packingListItems.closetItemId` into `packingListItems.cosplayNodeId`
- Seeds conservative `buildNodeStates` overlays based on legacy status values

The Convex migration chain is idempotent:

- Existing migrated nodes are reused by `legacyClosetItemId`
- Existing build links and build-state rows are not duplicated
- Existing hierarchy links are not duplicated

Example CLI invocation:

```bash
npx convex run migrations:run '{"fn":"backfillCosplayNodesFromClosetItems","next":["backfillCosplayNodeLinksFromClosetItems","backfillBuildCosplayLinksFromBuildItemLinks","backfillBuildTaskCosplayRefs","backfillPackingListCosplayRefs"]}'
```

## Compatibility Notes

- `convex/closetItems.ts` is now a migration-safe facade over `cosplayNodes`.
- `convex/buildTasks.ts` accepts both `closetItemId` and `cosplayNodeId` temporarily.
- Convention packing logic now prefers `cosplayNodeId` but still tolerates legacy `closetItemId` rows while migration is in progress.
- Mobile sync accepts `linkedNodeIds` while still supporting the older `linkedItemIds` shape.

## Follow-Up

- Rename remaining `/closet` routes and UI copy to `/elements`
- Replace legacy `closetItems` and `buildItemLinks` consumers once migration rollout is complete
- Add richer hierarchy editing UI for node reuse, child reordering, and type conversion
