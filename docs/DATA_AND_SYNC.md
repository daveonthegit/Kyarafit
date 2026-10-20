# Data Model, Local-First & Sync

_Source of truth for **data, local storage, sync, conflicts, migration, quotas, and deletion**.
Product rules live in [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md); code structure in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Requirement IDs here are `REQ-D*`._

## Implementation scope

The `REQ-D*` rules below describe the target contract, not completed rollout. Mobile personal
reads and commands now use the per-account vault; its lifecycle and isolation decision is
[ADR-0004](adr/0004-per-account-local-vault-is-authoritative.md). Mobile managed sync is the
Convex row replica (§6, [ADR-0005](adr/0005-managed-sync-is-a-convex-row-replica.md)); its
staging-deployment gate is still open. Web has no vault yet, so it shows published copies
read-only and never writes personal data (§5.1); mobile whole-vault backup/restore is implemented
and web exports only (§11). Giving web a vault remains a follow-up tracked in the
[roadmap](ROADMAP.md#current-status).

---

## 1. Invariants (the contract everything obeys)

1. **The local store is authoritative on-device.** Reads/writes never block on network or entitlement.
2. **UI reads/writes through the personal-data boundary.** See [Architecture B1](ARCHITECTURE.md#2-layering--boundaries) for the hooks, local command boundary, and current enforcement scope.
3. **Only managed sync talks to Convex for personal data.** It requires paid entitlement, connectivity, and remote authentication (REQ-D10). On mobile every replica call names the vault's account and the server refuses a session for any other account, so a switch can never push one vault into another account's replica.
4. **Conflict resolution = per field, in server-arrival order, delete wins, losing values kept** (§6.1). No CRDT.
5. **Automatic cloud retention deletion** belongs to the downgrade retention cron, gated on grace + warnings. Explicit user deletion and account deletion are separate paths; local data is never auto-deleted.
6. **Images:** local file/blob is the durable home for free; cloud copy is an additive paid cache.

- **REQ-D10** A dev/CI assertion verifies free personal-data CRUD generates **zero personal-data Convex calls**. Authentication and explicit online-only surfaces are separate boundaries; they are not prohibited by this requirement.

---

## 2. Source of truth per data class

| Data class                                                                         | Free source of truth              | Paid source of truth      | Offline    | Online-only |
| ---------------------------------------------------------------------------------- | --------------------------------- | ------------------------- | ---------- | ----------- |
| Elements, builds, build images\*, conventions, day plans, packing, tasks, settings | Local store                       | Local store + row replica | ✅         | —           |
| Images (binary)                                                                    | Local file/blob (or external URL) | Local + Convex storage    | ✅ (local) | —           |
| Published copies of builds / conventions (for collaborators and groups)            | Convex (explicit publish)         | Convex (explicit publish) | —          | ✅          |
| Social (feed, follows, likes, comments, profiles)                                  | —                                 | Convex                    | —          | ✅          |
| Groups (members, shared days, collaborators)                                       | —                                 | Convex                    | —          | ✅          |
| Public shared build pages                                                          | —                                 | Convex                    | —          | ✅          |
| Subscription / billing                                                             | —                                 | Convex + RevenueCat       | —          | ✅          |

\* Build image **metadata/references** are local-first; the binary follows the image rules (§7).

---

## 3. Canonical entities

Target model: flat, relational, `userId`-scoped, with **sync metadata** (§4) on every
local-first user-owned table. The current persistence names and compatibility tables are
listed in [Architecture](ARCHITECTURE.md#implementation-scope); §8 describes the migration
requirement, not evidence that those legacy definitions have been removed.

### 3.1 Element (replaces `closetItems` + `cosplayNodes`)

| Field                                                                    | Type          | Notes                                                 |
| ------------------------------------------------------------------------ | ------------- | ----------------------------------------------------- |
| `userId`                                                                 | string        | owner (Better Auth `externalId`)                      |
| `buildId`                                                                | id(builds)    | **owning build** (elements are build-scoped, REQ-040) |
| `parentElementId`                                                        | id(elements)? | sub-element hierarchy (REQ-041)                       |
| `name`, `category`                                                       | string        |                                                       |
| `tags`                                                                   | string[]      |                                                       |
| `notes`, `sourceUrl`                                                     | string?       |                                                       |
| `imageRef`                                                               | ImageRef?     | see §7 (local URI / external URL / cloud id)          |
| `pricingMode`, `directCostCents`, `unitCostCents`, `quantity`, `unit`    | mixed?        | cost tracking                                         |
| `purchaseStatus`, `buildStatus`, `materialStatus`, `manualOverallBucket` | string?       | status (feeds build progress, REQ-046)                |
| `sortOrder`                                                              | number        | order within parent/build                             |
| sync metadata                                                            | —             | §4                                                    |

> Drops the separate `cosplayNodeLinks` / `buildCosplayLinks` / `buildNodeStates` graph: hierarchy is a `parentElementId` tree; cross-build reuse is **duplicate-to-build** (REQ-042), not shared per-build state.

### 3.2 Build

Keep current `builds` shape (name, character, status, notes, image + focal point, budget, targetDate, manualProgressPercent, visibility, shareToken, publicViewerSettings, groupId) + sync metadata. `buildItemLinks` removed (elements own `buildId`).

### 3.3 Build media

- `buildReferenceImages` (REQ-047): `buildId`, `imageRef`, `caption?`, `sortOrder`.
- `buildProcessPhotos` (REQ-048): `buildId`, `imageRef`, `caption?`, `takenAt?`, `sortOrder`.
- **`buildProgressUpdates` (new, REQ-049):** `buildId`, `userId`, `createdAt`, `note?`, `imageRefs: ImageRef[]`, `progressPercent?`, `publishedToFeed: boolean`. Timeline-ordered.

### 3.4 Tasks (`workflowItems` + `workflowAttachments` + `workflowDependencies` + templates)

Keep the existing rich model (REQ-060). Remove `legacyBuildTaskId`. Keep `workflowAttachments` (links task → element/build/packing) and `workflowDependencies`. Add/maintain sync metadata.

### 3.5 Conventions / day plans / packing

Keep `conventions`, `conventionDayPlans`, `packingListItems` + sync metadata.

### 3.6 Online-only (Convex-only, no local mirror)

`groups`, `groupMembers`, `groupConventionDays`, `buildCollaborators`, `follows`, `buildLikes`, `buildComments`, `activities`, `broadcasts`, `userPushPreferences`, `idempotencyLedger`.

---

## 4. Sync metadata (every local-first row)

| Field                                      | Purpose                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `clientId` (string)                        | stable client-minted id for offline-created rows (`local:` prefix until mapped) |
| `version` (number)                         | monotonically bumped on each write (optimistic concurrency)                     |
| `updatedAt` (number, ms)                   | **bumped on every field write**; basis for per-field LWW                        |
| `fieldUpdatedAt` (record<string, number>)? | **per-field** timestamps for field-level LWW (REQ-D40)                          |
| `deletedAt` (number)?                      | soft-delete tombstone                                                           |

- **REQ-D40** Writes set `updatedAt` and the touched fields' `fieldUpdatedAt`; backend create/update helpers live in `convex/lib/syncMeta.ts`.
- **REQ-D41** Local id ↔ server id mapping is recorded on first successful create replay; later queued ops referencing the local id are rewritten before send.

---

## 5. Local store (per platform)

| Concern   | Mobile                                                   | Web                                                                                                       |
| --------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Engine    | SQLite (`expo-sqlite`)                                   | See the current [platform adapters](ARCHITECTURE.md#4-platform-adapters-the-only-platform-specific-glue). |
| Schema    | [`vaultSchema.ts`](../mobile/src/offline/vaultSchema.ts) | [Platform adapters](ARCHITECTURE.md#4-platform-adapters-the-only-platform-specific-glue)                  |
| Interface | `VaultStore` reader/writer and local handlers            | `LocalStore`                                                                                              |

- **REQ-D50 (target)** Shared persistence/sync contracts remain a target; current platform boundaries are documented in [Architecture §4](ARCHITECTURE.md#4-platform-adapters-the-only-platform-specific-glue).
- **REQ-D51** Mobile personal reads are synchronous vault queries, re-derived after committed writes; they never revalidate through the UI hook. Paid cloud pulls run separately in the worker. Web's cloud-first wrapper has not yet been converted.
- **REQ-D52** Mobile commands stage complete `entity_rows` documents and any enabled replication intents in one SQLite transaction; success and reactive publication occur only after commit. Multi-command edits use `runLocalMutations` for the same atomic boundary. Failed persistence throws `VaultWriteError`; no optimistic success is returned.

---

### 5.1 Current web isolation and write guarantees

The browser opens a separate `LocalStore` for each signed-in account (account-keyed OPFS database
or IndexedDB). Sign-out locks the runtime and clears its in-memory mirrors without deleting the
account's durable store. Account changes invalidate retained command callbacks and worker passes;
the paid worker waits for the matching account's vault and remote identity. Local identity versus
remote authentication is described in [Authentication](auth.md#web-local-access).

On upgrade, `legacyRecovery.ts` adopts only ownership-verifiable rows, pending operations and
associated id mappings from the old shared IndexedDB/OPFS stores. Other accounts' data remains
untouched; the legacy stores are never automatically deleted. Failed recovery is surfaced and
can be retried on a later vault open.

Web shows published copies only (ADR-0005): personal data is edited in the mobile app. Every
personal-data command (builds, elements, tasks, conventions, media, progress updates, seeding) is
refused before it reaches Convex or the local store, with a localized alert; Settings → Backup &
data carries the same notice. Social actions on published copies (groups, collaborators, likes,
comments) still call Convex online. Web build visibility and sharing settings are part of the
refused build edit until a social-settings path for published copies exists.

---

## 6. Managed sync (paid + online only)

Mobile replicates through the Convex row replica (`convex/replica.ts`, device half in
`mobile/src/vault/replica`, shared vocabulary in `design-system/domain/replicaProtocol.ts`). The
legacy replay worker, `sync.listChangedSince` and `tierTransition.backfillRows` are removed; web
has no vault and is read-only (§5.1).

- **REQ-D60** Gate: row sync runs only when `shouldRunSyncWorker(tier, signedIn)` holds for the
  vault's own account. The first confirmed paid session enables replication for the vault and
  queues every row the cloud has never seen; free vaults record nothing.
- **REQ-D61** Every vault commit (including restores) records one outbox op per changed row in the
  same SQLite transaction: a field patch or a delete, keyed by the vault's own id. A pass pushes
  the outbox oldest-first (100 ops per batch), then pulls. Passes are single flight and triggered
  by app start, foreground, reconnect, local commits (debounced) and "Sync now"; transient
  failures retry with exponential backoff and jitter. Expired sessions, lapsed plans and being
  offline pause without consuming retries or dropping ops.
- **REQ-D62** Idempotent: the server dedupes `opId` per account, so a resend after a lost
  acknowledgement is a no-op.
- **REQ-D63** Each applied op takes the next per-account `rev`. Pulls page over `by_user_rev`, so
  the cursor always acknowledges a complete prefix across all tables; rows, conflict records and
  the cursor commit in one transaction. Deletes are tombstones in the stream.
- **REQ-D64** Sync status is observable in Settings → Offline: status (synced, pending, offline,
  sign in again, paused plan, retrying), pending count, last synced, "Sync now", and the number of
  changes that didn't apply.

### 6.1 Conflict resolution

- **REQ-D65** Per field, the later arrival at the server wins. A value another device changed after
  the op's base revision is recorded as a `concurrent-field-edit` before being overwritten; a
  device's own earlier edits are never conflicts, and bookkeeping fields (`updatedAt`, `version`,
  `fieldUpdatedAt`) never are. Delete wins in both orders: an edit to a deleted row is kept as
  `edit-after-delete` (with the full row), a delete over an unseen edit as
  `delete-over-unseen-edit`. Device clocks never order changes.
- **REQ-D66** "Changes that didn't apply" lists every kept value per build (and all of them from
  Settings). Restore is a new edit: overwritten fields are written back, deleted rows come back as
  new rows when their parent still exists. Dismissal propagates to every device.

### 6.2 Cross-row integrity

- **REQ-D67a** Generated tasks ("Buy X", "Work on X", packing tasks) get deterministic row ids, so
  two offline devices generating the same task create one row. An element-generated task's id is a
  hash of its dedupe key and an incarnation counter kept on the element: a task the user deletes
  (any path) stays deleted through ordinary element edits; leaving and re-entering the generating
  status creates the next incarnation under a new id.
- **REQ-D67b** Moves and restores check for cycles by walking the actual parent links in the local
  vault at write time, never the cached `ancestorIds`; a restore that would create a cycle is
  refused and stays in the "changes that didn't apply" list.

- **REQ-D67** After each batch the server checks parent references (`REPLICA_LINK_RULES`): photos,
  progress updates, tasks and build attachments under a deleted build move to the account's
  "Recovered" build; elements and optional links are unlinked; day plans, packing items and
  subtasks under a deleted parent are removed and kept as `orphan-removed` records. The same
  repair runs when a delete orphans rows that reached the server earlier. A parent the replica has
  not seen yet is left alone (it may arrive in a later batch).

### 6.3 Retention

- **REQ-D68** Op dedupe records, tombstones and conflict records are kept 90 days, purged by a
  daily cron. Purging a tombstone raises the account's `floorRev`; a device whose cursor is older is
  told to resnapshot, pulls the full replica, and drops synced rows the replica no longer holds,
  keeping its own unsynced edits.

### 6.4 Published projections

- **REQ-D69** Convex domain tables are published projections of vault rows, never a second editable
  copy. `publications.publish` writes a build's or convention's content (free for every tier) when
  the owner invites a collaborator or adds it to a group; nothing flows back into the vault.
  Deleting a published vault row queues `publications.unpublish`, which runs once online.

## 7. Images & files

| Mode            | Free                                | Paid           |
| --------------- | ----------------------------------- | -------------- |
| Local file/blob | ✅ durable home; in export          | ✅ cache       |
| External URL    | ✅                                  | ✅             |
| Convex storage  | ❌ (except group exception REQ-021) | ✅ backup/sync |

- **REQ-D70** `ImageRef` is a discriminated union: `{ kind: "local", uri, imageKey }` | `{ kind: "url", url }` | `{ kind: "cloud", storageId, imageKey }`. Resolver prefers local file, then cloud URL, then external URL.
- **REQ-D71** Free images never upload to Convex (except REQ-021). For paid mobile vaults, upload is a sync step: each vault photo's bytes are uploaded once and registered by key in `replicaAssets` (owner-only, counted against the hosted-media cap, deleted with the account); vault rows keep their `kyarafit-image:` tokens. A device missing a referenced photo downloads it into the vault.
- **REQ-D72** Background-removal service is **removed**; image add is pick/capture/URL only.

---

## 8. Migration (greenfield)

- **REQ-D80** Treat schema changes as greenfield: no heavy production data migration. Drop `closetItems`, `buildTasks`, `cosplayNodeLinks`, `buildCosplayLinks`, `buildNodeStates`, `buildItemLinks` and their cross-ref fields/indexes; introduce `elements`, `buildProgressUpdates`, rename `buildProcessPictures`→`buildProcessPhotos` (or keep name — implementer's call, document it).
- **REQ-D81** Any existing `cosplayNodes`/`closetItems` rows are migrated best-effort into `elements` via a one-time script **or** discarded if empty/disposable; document which in the migration commit.
- **REQ-D82** A device enabling managed sync pulls the whole replica (cursor 0) and uploads every row the replica has not seen (§6, REQ-D95).

---

## 9. Storage quotas

| Tier | Local                      | Cloud                                               |
| ---- | -------------------------- | --------------------------------------------------- |
| Free | Unlimited (device-bounded) | 0 (except group allowance, REQ-021: default 100 MB) |
| Paid | Unlimited (device-bounded) | 2048 MB                                             |

- **REQ-D90** Over-cap blocks **new cloud uploads** only; never deletes existing cloud or any local data; prompts to trim or upgrade.
- **REQ-D91** Local store enforces its own maintenance caps/eviction (query_cache/tombstone pruning) fail-closed.

---

## 10. Tier transitions

- **REQ-D95 (Upgrade free→paid)** On transition to paid: enqueue all local rows for replication under their vault ids (mobile: `Replicator.enableReplication`), push, then pull. Ids are globally unique, so two upgraded vaults merge without duplicates.
- **REQ-D96 (Downgrade paid→free)** Stop sync immediately (mobile keeps recording outbox ops so a re-subscribe resumes without loss); local keeps working. Cloud kept intact for a **14-day grace**; then **freeze** (read-only). A retention cron purges frozen cloud data only after **~3 months** of no re-subscribe, **after** warnings + an export offer. Local data is never touched. Re-subscribe within grace resumes seamless sync.
- **REQ-D97** The downgrade/grace/freeze state is recorded server-side (`tierSource`, `subscriptionStatus`, downgrade timestamp); the retention cron lives in `convex/crons.ts`.

---

## 11. Export / import (free)

**Current mobile behavior:** Settings → Backup & restore writes the whole unlocked vault to one
`.kyarafit` file: every live row plus the original bytes of every referenced photo, including
cloud-only originals downloaded when online (unavailable ones are listed as missing). Save it
outside the app through the iOS share sheet or Android folder picker; the app's temporary copy is
removed afterward. Backups contain private planner data and photos without encryption, so keep
them in a trusted location.

Restore picks a `.kyarafit` file with the system file picker; the previous mobile JSON exports
are not accepted by this restore flow. Photos are copied first, then rows
merge in one SQLite transaction: missing rows are added; a strictly newer row `updatedAt` replaces
the older copy (not a per-field merge); equal or older copies preserve destination edits. Records
whose ids differ between devices are matched through `id_map`/`clientId` instead of duplicated,
and references are rewritten. Re-importing is idempotent. Source-account ownership is reassigned
to the unlocked destination account. Device-local `vaultSettings` (including focused build) are
not restored or counted as omissions; destination preferences remain unchanged. Replication queues
and id maps are not exported as planner rows, and tombstones are not included.

Unreadable export rows, unsupported import tables, unavailable or unwritable photos, and repaired
hierarchy conflicts are reported as partial results rather than complete success. Invalid archive
headers, newer archive versions, or damaged photo lengths reject the import before row changes;
row-commit failures surface as errors. The versioned archive layout is defined in
[`archive.ts`](../mobile/src/vault/archive.ts). Not yet implemented from the requirements below:
CSV, JSON-ZIP and PDF formats, per-field import merging, and tombstone-aware import.

### Current web behavior

Settings → Data exports a free JSON bundle from the signed-in account's local rows, not a fresh
cloud pull. The supported collections and versioned format are defined by
[`dataPortability.ts`](../web/src/lib/dataPortability.ts). It is not the mobile `.kyarafit` archive:
photo binaries, build media collections and convention day plans are not included, and it is not
a complete vault backup.

Web does not restore. Restoring writes personal data, which web never does (§5.1), so the page
explains that backups are restored in the mobile app. A restore session left incomplete by an
earlier web version still locks personal writes in that browser until it is cleared.

The requirements below remain the target across platforms, not claims of current web fidelity.

- **REQ-D100** CSV (one per entity), JSON-ZIP (`data.json` + `/images/<imageKey>.<ext>`, relative refs, via `fflate`), and PDF export are all free.
- **REQ-D101** Import parses zip/json, rehydrates images into the local store, remaps ids via `id_map`, merges per-field LWW (REQ-D65), respects tombstones, and is **idempotent** on re-import (no duplicates).
- **REQ-D102** Round-trip fidelity: export on device A → import on fresh device B reproduces builds + images faithfully.
