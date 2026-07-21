# Kyarafit — Domain Context

Ubiquitous language for the Kyarafit domain. Use these exact terms in code, tests, issues, and
docs. This file is grown lazily as terms get resolved (see `docs/agents/domain.md`); it is not
exhaustive. Seeded during the architecture-deepening session on the builds/closet slice.

## Core nouns

- **Build** — a cosplay project owned by a user (`builds` table). The central aggregate; most other
  entities hang off a build.
- **Element** — a component of a build (`elements` table). Replaces the legacy `cosplayNodes`.
- **Closet item** — a wardrobe-inventory item a user owns, linkable to a build (`closetItems` table).
- **Convention** — a convention event a user plans around (`conventions` table).
- **Progress update** — a dated entry on a build recording progress (`buildProgressUpdates` table).
  Keeping a private timeline entry is always local and free. **Publishing** an update to the social
  feed is free for every tier but **rate-limited**; its images count against the publisher's
  [[hosted-media-cap]].
- **Workflow item / task** — a to-do or workflow step on a build (`buildTasks` / `workflowItems`).

## Builds list (local-first slice)

The builds list is local-first: rows load from the local store (through the offline bridge), and
**filtering and sorting happen locally**, not via server query arguments. The canonical pure helper
is **`filterAndSortBuilds(builds, view)`** in `@kyarafit/design-system/domain/buildsList`
(PRODUCT_SPEC §4.3). It replaces the old `buildsListArgs` server-arg builder, which is legacy and
being removed.

- **Build tab** — a status-filter view over builds. The canonical ordered set is
  **`BUILD_TABS`** = `all · current · planning · completed · archived`. Tab → status mapping
  (`TAB_STATUS`): `current → wip`, `planning → idea`, `completed → ready`, `archived → archived`;
  `all` applies no status filter. Tab **labels** are presentation and live on the platform side, not
  in the shared domain.

## Shared pure helpers (design-system/domain)

Domain logic shared across web + mobile is pure and lives in `@kyarafit/design-system/domain`,
unit-tested from the web workspace's vitest. Terms pinned in this slice:

- **`filterAndSortClosetItems(items, view)`** (`domain/closetItems`) — filter + sort a closet-item
  list locally: category filter, search across name/category/tags (case-insensitive, trimmed), sort
  by `name | recent | selectedFirst` (the last parameterized by the current selection). Structural
  twin of `filterAndSortBuilds`.
- **`sortProgressUpdates`**, **`parseProgressPercent`**, **`formatProgressUpdateDate(epochMs, locale?)`**
  (`domain/mediaGallery`) — ordering, input parsing, and display formatting for progress updates.
- **`progressRingGeometry(percent, radius)`** (`domain/progressRing`) — the correct, clamped
  circumference geometry (`{ dashArray, dashOffset }`) for a progress ring. Single source of truth so
  web and mobile render identical rings.
- **`cloudStorageCapMb`**, **`formatStorageMb`** (`domain/cloudStoragePolicy`) — cloud-storage caps
  and how storage sizes are rendered.

## Tiers & entitlements

- **Tier** — a user's subscription level: **free** or **supporter** (the only paid tier; a
  pay-what-you-want subscription with several fixed price points, $5/mo minimum, all granting the
  same entitlements — the legacy `pro` tier collapses into supporter). Resolved server-side from the
  `users` row; missing rows default to free.
- **Hosted media** — media files Kyarafit itself stores and serves to other users (published
  feed/group images, publicly shared build pages, collab-shared build media, avatars, group covers;
  for supporters, also managed-sync personal media). Any feature that requires Kyarafit to serve a
  file to someone other than its owner makes that file hosted media and meters it against the
  owner's [[hosted-media-cap]]. Personal media on a free account is local/BYO-synced and is never
  hosted media.
- **Hosted-media cap** — the per-user byte limit on hosted media, the single storage lever between
  tiers: free 100 MB, supporter 5 GB. Meters bytes only (no count-based limits); over-cap blocks new
  uploads, never deletes. Replaces the old free group-cosplay exception.
- **BYO sync** — free-tier multi-device sync of personal data through storage the user owns
  (Google Drive first), merging snapshots by per-record last-writer-wins. Contrast with
  **managed sync** (supporter): Kyarafit syncs personal data through its own backend.
- **Sync method** — the single authoritative remote for a user's personal data, chosen explicitly
  in Settings: **Off**, **Google Drive** (BYO), or **Kyarafit Cloud** (managed, supporter-only —
  this is exactly what the `cloud_sync` entitlement grants). Never more than one at a time;
  switching merges-and-pushes through the old method once, then the new one is authoritative.
- **Entitlement / feature** — a gated capability. The single source of truth is the feature matrix in
  `@kyarafit/design-system/domain/entitlements` (`can(tier, feature)`), shared by web, mobile, and
  Convex. Server-side enforcement is **`requireFeature`** (`convex/lib/entitlements`).
