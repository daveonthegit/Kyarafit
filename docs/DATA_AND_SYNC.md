# Data Model, Local-First & Sync

_Source of truth for **data, local storage, sync, conflicts, migration, quotas, and deletion**.
Product rules live in [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md); code structure in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Requirement IDs here are `REQ-D*`._

## Implementation scope

The `REQ-D*` rules below describe the target contract, not completed rollout. Mobile personal
reads and commands now use the per-account vault; its lifecycle and isolation decision is
[ADR-0004](adr/0004-per-account-local-vault-is-authoritative.md). Web still uses cloud-first
wrappers, now with account isolation and visible persistence failures (§5.1). Mobile whole-vault
backup/restore and web's narrower online restore are implemented (§11); full web local-first
conversion and paid-sync correctness remain follow-ups tracked in the
[roadmap](ROADMAP.md#current-status).

---

## 1. Invariants (the contract everything obeys)

1. **The local store is authoritative on-device.** Reads/writes never block on network or entitlement.
2. **UI reads/writes through the personal-data boundary.** See [Architecture B1](ARCHITECTURE.md#2-layering--boundaries) for the hooks, local command boundary, and current enforcement scope.
3. **Only the sync worker talks to Convex for personal data.** It requires paid entitlement, connectivity, and remote authentication (REQ-D10); mobile additionally verifies the credential's account matches the open vault and aborts a pass if that scope changes (`mobile/src/offline/syncIdentity.ts`).
4. **Conflict resolution = per-field last-write-wins by `updatedAt`.** No CRDT.
5. **Automatic cloud retention deletion** belongs to the downgrade retention cron, gated on grace + warnings. Explicit user deletion and account deletion are separate paths; local data is never auto-deleted.
6. **Images:** local file/blob is the durable home for free; cloud copy is an additive paid cache.

- **REQ-D10** A dev/CI assertion verifies free personal-data CRUD generates **zero personal-data Convex calls**. Authentication and explicit online-only surfaces are separate boundaries; they are not prohibited by this requirement.

---

## 2. Source of truth per data class

| Data class                                                                         | Free source of truth              | Paid source of truth       | Offline    | Online-only |
| ---------------------------------------------------------------------------------- | --------------------------------- | -------------------------- | ---------- | ----------- |
| Elements, builds, build images\*, conventions, day plans, packing, tasks, settings | Local store                       | Local store + cloud mirror | ✅         | —           |
| Images (binary)                                                                    | Local file/blob (or external URL) | Local + Convex storage     | ✅ (local) | —           |
| Social (feed, follows, likes, comments, profiles)                                  | —                                 | Convex                     | —          | ✅          |
| Groups (members, shared days, collaborators)                                       | —                                 | Convex                     | —          | ✅          |
| Public shared build pages                                                          | —                                 | Convex                     | —          | ✅          |
| Subscription / billing                                                             | —                                 | Convex + RevenueCat        | —          | ✅          |

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

Offline commands commit the queue entry and entity overlays in one store transaction before
publishing success or returning a local id. Persistence failures reject and surface through
`reportWriteError`; they are not acknowledged as saved. This does **not** convert online web
CRUD to local-first: online mutations still call Convex, and free users can still make personal-data
cloud calls. The write boundary and rollback tests are in `web/src/lib/offline/commandPersistence.test.ts`
and `indexedDbCommand.test.ts`.

---

## 6. Sync worker behavior (paid + online only)

- **REQ-D60** Gate: the worker (queue drain **and** warm-up pull) starts only when `canUseCloudSync && signedIn`. A pure `shouldRunSyncWorker(tier, signedIn)` predicate is the single decision point, unit-tested.
- **REQ-D61** Drain is FIFO, single-flight, connectivity-guarded; stops on first transient failure (preserves order); retries with capped backoff; rows past the retry ceiling are marked failed and surfaced (REQ-D64), not silently dropped.
- **REQ-D62** Replay is **idempotent**: every offline-enqueued mutation carries an idempotency key deduped by the server `idempotencyLedger`. No mutation may be enqueued offline unless it is idempotent.
- **REQ-D63** Warm-up pull (`sync.listChangedSince`) seeds/updates local rows for **all** local-first entity types (not just builds/conventions — extend), using `updatedAt`/`version` deltas (not only `_creationTime` creates).
- **REQ-D64** Sync status is observable: connectivity banner, per-row pending badge, global last-synced timestamp, manual "sync now" (paid), and a surfaced actionable error state.

### 6.1 Conflict resolution

- **REQ-D65** On pull, merge cloud and local per **field** by `fieldUpdatedAt` (fallback to row `updatedAt`): each field takes the value with the greater timestamp. Tombstones (`deletedAt`) are idempotent and win over older edits.
- **REQ-D66** A pure `mergeFieldLWW(local, remote)` function is the single merge point, unit-tested for: remote-newer field wins, local-newer field wins, delete-vs-edit, equal-timestamp deterministic tiebreak (higher `version`, then `clientId`).

---

## 7. Images & files

| Mode            | Free                                | Paid           |
| --------------- | ----------------------------------- | -------------- |
| Local file/blob | ✅ durable home; in export          | ✅ cache       |
| External URL    | ✅                                  | ✅             |
| Convex storage  | ❌ (except group exception REQ-021) | ✅ backup/sync |

- **REQ-D70** `ImageRef` is a discriminated union: `{ kind: "local", uri, imageKey }` | `{ kind: "url", url }` | `{ kind: "cloud", storageId, imageKey }`. Resolver prefers local file, then cloud URL, then external URL.
- **REQ-D71** Free images never upload to Convex (except REQ-021). For paid users, upload is a sync step: on drain, upload local file → set `imageRef.kind = cloud` while keeping the local copy as cache.
- **REQ-D72** Background-removal service is **removed**; image add is pick/capture/URL only.

---

## 8. Migration (greenfield)

- **REQ-D80** Treat schema changes as greenfield: no heavy production data migration. Drop `closetItems`, `buildTasks`, `cosplayNodeLinks`, `buildCosplayLinks`, `buildNodeStates`, `buildItemLinks` and their cross-ref fields/indexes; introduce `elements`, `buildProgressUpdates`, rename `buildProcessPictures`→`buildProcessPhotos` (or keep name — implementer's call, document it).
- **REQ-D81** Any existing `cosplayNodes`/`closetItems` rows are migrated best-effort into `elements` via a one-time script **or** discarded if empty/disposable; document which in the migration commit.
- **REQ-D82** First post-cutover run for a paid user seeds the local store from cloud via `sync.listChangedSince(since=0)`.

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

- **REQ-D95 (Upgrade free→paid)** On transition to paid: enqueue all local rows (with `clientId`s) for backfill; push, then pull deltas. Multi-device: reconcile by `clientId` then content-hash to avoid duplicates. Chunked with visible progress; respects caps.
- **REQ-D96 (Downgrade paid→free)** Stop the worker immediately; local keeps working. Cloud kept intact for a **14-day grace**; then **freeze** (read-only). A retention cron purges frozen cloud data only after **~3 months** of no re-subscribe, **after** warnings + an export offer. Local data is never touched. Re-subscribe within grace resumes seamless sync.
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
a complete vault backup. Exported fields are not all accepted by the restore create mutations.

Restore requires an internet connection and an empty account vault: any existing build, element,
convention, task or packing row refuses the import before writes. The whole bundle and its
relationships are validated before the first create. Restore remaps build/element/convention ids,
workflow parents, generated tasks and attachments to their newly created destinations; it does not
merge with existing work. Merge-restore and resumable restore are deferred.

Before the first server write, an account-local restore session is persisted. Created destination
ids are recorded as calls return. Until completion or Undo, personal planner writes in this
browser's account vault are refused using persisted session state, including from other tabs;
broadcasts update the read-only notice. Completion clears the record. On interruption, Settings
shows **“Restore incomplete - undo and try again”**. Connect and choose **Undo** to delete the
recorded server and local rows, children first, then restore again. Failed Undo retains its
remaining recorded rows so Undo can be retried.

Restore and Undo take one exclusive per-account Web Lock with `ifAvailable`; another tab holding
it disables both actions and shows **“Restore in progress in another tab”**. Closing or crashing
the holding tab releases the lock so an interrupted session can be undone elsewhere. Browsers
without Web Locks retain single-tab behavior and cannot serialize concurrent restore/Undo.

Known limits: an ordinary write already in flight in another tab when restore starts is not
covered. Other devices are not locked, and Undo's server-side cascades can remove their edits.
A server create that commits just before the browser closes, before its id is recorded, is not
visible to Undo; that row leaves the vault non-empty and must be removed through normal UI.
Closing this recording window needs backend work outside the web slice. Lifecycle and cross-tab
coverage live in `web/src/lib/restoreSession.test.ts` and `web/src/app/settings/data/page.test.tsx`.

The requirements below remain the target across platforms, not claims of current web fidelity.

- **REQ-D100** CSV (one per entity), JSON-ZIP (`data.json` + `/images/<imageKey>.<ext>`, relative refs, via `fflate`), and PDF export are all free.
- **REQ-D101** Import parses zip/json, rehydrates images into the local store, remaps ids via `id_map`, merges per-field LWW (REQ-D65), respects tombstones, and is **idempotent** on re-import (no duplicates).
- **REQ-D102** Round-trip fidelity: export on device A → import on fresh device B reproduces builds + images faithfully.
