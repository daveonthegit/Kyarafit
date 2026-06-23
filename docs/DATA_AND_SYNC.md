# Data Model, Local-First & Sync

_Source of truth for **data, local storage, sync, conflicts, migration, quotas, and deletion**.
Product rules live in [`PRODUCT_SPEC.md`](PRODUCT_SPEC.md); code structure in
[`ARCHITECTURE.md`](ARCHITECTURE.md). Requirement IDs here are `REQ-D*`._

---

## 1. Invariants (the contract everything obeys)

1. **The local store is authoritative on-device.** Reads/writes never block on network or entitlement.
2. **UI reads/writes only through `useOfflineQuery` / `useOfflineMutation`.** Direct Convex hooks for local-first data are banned (ESLint-enforced on both platforms).
3. **The sync worker is the only code that talks to Convex for personal data, and it runs iff `canUseCloudSync && signedIn`.** Free → worker never starts (REQ-D10).
4. **Conflict resolution = per-field last-write-wins by `updatedAt`.** No CRDT.
5. **Cloud data is deleted in exactly one place:** the downgrade retention cron, gated on grace + warnings. Nothing else deletes server data; local data is never auto-deleted.
6. **Images:** local file/blob is the durable home for free; cloud copy is an additive paid cache.

- **REQ-D10** A dev/CI assertion verifies a free, signed-in user generates **zero** Convex data-function calls (auth-only traffic).

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

Flat, relational, `userId`-scoped. Every local-first user-owned table carries **sync metadata**
(§4). Legacy tables `closetItems` and `buildTasks` are **removed** (greenfield migration §8).

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

- **REQ-D40** Writes set `updatedAt` and the touched fields' `fieldUpdatedAt`. (Current code does **not** maintain these — implement.)
- **REQ-D41** Local id ↔ server id mapping is recorded on first successful create replay; later queued ops referencing the local id are rewritten before send.

---

## 5. Local store (per platform)

| Concern   | Mobile                                                               | Web                                                    |
| --------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Engine    | SQLite (`expo-sqlite`)                                               | OPFS + wa-sqlite (Dexie fallback behind the interface) |
| Tables    | `entity_rows`, `mutation_queue`, `id_map`, `query_cache`, tombstones | same schema                                            |
| Interface | one shared `LocalStore` contract (§ARCHITECTURE)                     | same                                                   |

- **REQ-D50** Both platforms implement the same `LocalStore` interface so sync logic is platform-agnostic and shared.
- **REQ-D51** Reads are stale-while-revalidate: serve last local snapshot immediately; revalidate from cloud only when paid + online.
- **REQ-D52** Offline writes append to `mutation_queue` and update `entity_rows` optimistically so they are visible immediately across list/detail/derived (planner, build-tree) views.

---

## 6. Sync worker behavior (paid + online only)

- **REQ-D60** Gate: the worker (queue drain **and** warm-up pull) starts only when `canUseCloudSync && signedIn`. A pure `shouldRunSyncWorker(tier, signedIn)` predicate is the single decision point, unit-tested. _(Today `SyncWorkerProvider` runs unconditionally — fix.)_
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

- **REQ-D100** CSV (one per entity), JSON-ZIP (`data.json` + `/images/<imageKey>.<ext>`, relative refs, via `fflate`), and PDF export are all free.
- **REQ-D101** Import parses zip/json, rehydrates images into the local store, remaps ids via `id_map`, merges per-field LWW (REQ-D65), respects tombstones, and is **idempotent** on re-import (no duplicates).
- **REQ-D102** Round-trip fidelity: export on device A → import on fresh device B reproduces builds + images faithfully.
