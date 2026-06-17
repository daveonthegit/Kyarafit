# Local-First Freemium Plan

**Status:** Proposed (planning). **Owner:** TBD. **Created:** 2026-06-14.

Goal: Kyarafit is **free to use on web and mobile** with **accounts required**, where core work runs **local-first** (no cloud cost for free users), and **paid tiers add automatic cloud sync** ("work from any device, never sync manually, never lose data"). Free users get durability via **CSV / JSON-ZIP export + import**. Upgrade backfills local data to the cloud robustly; downgrade freezes the cloud without ever destroying data.

This plan **extends** `docs/mobile-rewrite/BLUEPRINT.md` §3.13 (mobile offline-first). Read that first — this document only describes the deltas needed for the freemium + web + export model.

---

## 1. How this differs from the existing blueprint

The blueprint §3.13 already designs, and the codebase already partially ships:

- SQLite entity cache, `mutation_queue`, `id_map`, `query_cache`, tombstones, storage caps, eviction (`mobile/src/offline/db.ts`). ✅ built
- `useOfflineQuery` / `useOfflineMutation` bridge that Offline Core screens already import (`mobile/src/offline/convex-bridge.ts`). ⚠️ **currently a passthrough stub to Convex** — the SQLite read-through and queue replay are not implemented.
- Schema offline scaffolding: `clientId`, `version`, `by_userId_clientId` indexes, `idempotencyLedger` table. ✅ in `convex/schema.ts`
- Entitlement policy shared across platforms (`design-system/domain/entitlements.ts`, `subscriptionTierPolicy.ts`) and RevenueCat-driven tier writes. ✅ built

Three assumptions in the blueprint **do not hold** for our model and are the substance of this plan:

| Blueprint assumption                                                               | Our requirement                                                                    | Implication                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQLite is a **cache** of an authoritative Convex; the app always eventually syncs. | For **free** users, local store is the **source of truth** and may **never** sync. | The "network leg" of SWR and the queue drain must be **gated on entitlement**, and the app must be fully functional with zero Convex data calls. |
| Offline is **mobile-only**; web is online/cloud.                                   | Web must also be **free + local-first**.                                           | Build a **web local store** (IndexedDB/OPFS) + web offline bridge mirroring mobile.                                                              |
| Image uploads are **online-only** (queued pending upload to Convex).               | Free users store images **locally, indefinitely**, and export them.                | Local image store + local-URI references + export packaging; cloud upload becomes a **paid-sync** step.                                          |

Plus two net-new flows the blueprint doesn't cover: **upgrade backfill** (merge possibly-divergent local datasets into one cloud truth) and **downgrade freeze** (stop sync, preserve data, never destroy).

---

## 2. Target architecture

```
            FREE (local-first, no cloud data)         PAID (local-first + automatic sync)
UI  ──►  useOfflineQuery / useOfflineMutation  ──►  same hooks
            │                                          │
            ▼                                          ▼
   Local store = SOURCE OF TRUTH               Local store = source of truth
   (SQLite mobile / IndexedDB-OPFS web)        + mutation_queue DRAINS to Convex
   + local image blobs                         + images upload to Convex storage
            │                                          │ (Convex reactive queries
   export/import = manual portability          ▲       push changes to all devices)
            └──────────────  upgrade backfill  ─┘
                             downgrade freeze
```

Two invariants:

1. **Local store is always authoritative on the device.** Reads/writes never block on network or entitlement.
2. **The sync worker is the only thing that talks to Convex for data, and it only runs when `canUseCloudSync` (any paid tier — `isPaid`) and signed in.** Free = worker never starts.

> **Tier model (June 2026):** tiers are now **FREE** + a single paid level expressed as two feature-identical entitlements — **PRO** ($3/mo, $30/yr) and **SUPPORTER** (pay-what-you-want preset price points ≥ $5/mo, same features as Pro). The legacy STUDIO tier was collapsed into PRO. Build/convention count limits were removed. All export (CSV/JSON/PDF) is free; **automatic cloud sync is the only paid lever.** Premium cloud storage cap = 2 GB. Gate paid features with `isPaidTier` / `isPaid`, never a specific tier. Sources of truth: `design-system/domain/subscriptionTierPolicy.ts`, `entitlements.ts`, `subscriptionPlans.ts`.

---

## 3. Phases

Each phase is independently shippable and verifiable. Phases 1–3 finish the mobile blueprint; 4 ports it to web; 5 adds export/import; 6–7 add the upgrade/downgrade flows; 8 hardens.

### Phase 0 — Shared data-layer contract (foundation)

- Define a platform-agnostic `LocalStore` interface (read entity rows by query, upsert, soft-delete, enqueue mutation, id_map get/set, query_cache get/set) in a shared location (`design-system/` or a new `packages/local-store/`).
- Define the **entity registry**: which tables are local-first (mirror blueprint §3.13.2 list) and their export shape.
- **Decided:** web storage engine is **OPFS + wa-sqlite** (one SQL schema shared web+mobile; OPFS durability). Keep the Phase 0 `LocalStore` interface clean enough that Dexie/IndexedDB remains a fallback if WASM-SQLite friction blocks Phase 4.
- DoD: interface compiles; mobile `db.ts` refactored to implement it with no behavior change.

### Phase 1 — Make mobile local-first real (finish §3.13.2–3.13.3)

- ✅ **Read-path slice landed (2026-06-15):** `useOfflineQuery` is now a real stale-while-revalidate drop-in (`mobile/src/offline/useOfflineQuery.ts`) backed by the `query_cache` table (`mobile/src/offline/queryCache.ts`). Online behaviour is unchanged (live Convex result, written through to cache); while loading/offline it serves the last cached snapshot instead of `undefined`. Pure key logic is shared + unit-tested (`design-system/domain/offlineQueryCache.ts`, `web/src/lib/offline/offlineQueryCache.test.ts`). Best-effort/never-throws, so it is a safe additive replacement. **Mutations still pass through** (`useOfflineMutation` → Convex).
- ✅ **Write-path slice landed (2026-06-15):** `useOfflineMutation` is now connectivity-aware (`mobile/src/offline/useOfflineMutation.ts`) — online it calls Convex directly and returns the real result (unchanged); offline it appends to the `mutation_queue` (`mobile/src/offline/mutationQueue.ts`) and resolves optimistically. The **Sync Worker** (`mobile/src/offline/syncWorker.ts`) drains the queue FIFO on reconnect/mount with retry+backoff, single-flight, rebuilding the Convex `FunctionReference` from the stored name. Connectivity tracked in `SyncWorkerProvider` via NetInfo (`connectivity.ts`). Retry/backoff policy is shared + tested (`design-system/domain/offlineMutationQueue.ts`, `web/src/lib/offline/offlineMutationQueue.test.ts`).
- ⏭️ **Known gaps for follow-up slices (in priority order):**
  - **Server idempotency** — ✅ _2026-06-15._ `convex/lib/idempotency.ts` (`runIdempotent` +
    `idempotentReplay`/`idempotentRecord`) backed by `idempotencyLedger` (pruned by a daily cron).
    Applied to **builds** (`create`, `update`, `updateStatusMany`, `duplicate`, `addNodesToBuild`) and
    **conventions** (`create`, `update`, `archiveMany`, `replacePlan`, `addManualPackingItem`); the
    sync worker injects the queued key for mutations registered in
    `mobile/src/offline/idempotentMutations.ts`. **Remaining:** `workflow` (`create`, `update`,
    `move`, `moveAndResequence`) + `users.setFocusedBuild`. **N/A:** `buildTasks` (web-only
    `workflowItems` shim — never offline-enqueued); `closetItems`/`cosplayNodes` create
    (not enqueued via the offline bridge — only `cosplayNodes.removeMany` is, and deletes are
    naturally idempotent).
  - **`clientId`/`id_map`** — ✅ _2026-06-16._ Offline creates mint a `local:`-prefixed client id
    (`mobile/src/offline/clientId.ts`) and resolve to an optimistic stub; the sync worker records
    `clientId → serverId` (`idMap.ts`) on replay and rewrites later queued ops that referenced the
    optimistic id (`design-system/domain/offlineIdMap.ts`). `mutation_queue` gained a v2 `client_id`
    column.
  - **Optimistic visibility** — ✅ _2026-06-16._ `entity_rows` overlay merged onto the last server
    snapshot in `useOfflineQuery` (`design-system/domain/offlineEntityOverlay.ts`,
    `mobile/src/offline/entityRows.ts`), reactive via `entityOverlayStore`. **Plain-document scope:**
    builds + conventions (lists + convention detail).
  - **Task visibility in derived views** — ✅ _2026-06-16._ Offline task writes now show in the two
    projected task surfaces. **Planner** (`workflow:listPlanner`) uses a projection overlay
    (`design-system/domain/offlinePlannerOverlay.ts`) that reuses the server's
    `deriveStatusProgress`/`isOverdueStatus` and pulls build/convention context from create
    attachments (joins it can't resolve locally default to null/0). **Build tree**
    (`workflow:listBuildTree`) uses re-derivation (`offlineBuildTreeOverlay.ts`): flatten the server
    tree back to items+attachments+dependencies, apply the queued mutations scoped to the build, and
    re-run the shared `buildWorkflowTree` + stats math. External (packing/cosplay) progress falls back
    to status-derived until next sync. ⏭️ **Deferred:** enriched `builds:get` is still not overlaid.
  - **`convex/sync.ts` `listChangedSince`** — ✅ _2026-06-16._ Auth-scoped, `_creationTime` cursor;
    consumer is the sync-worker warm-up (`warmEntityRows`) that seeds synced `entity_rows`, and
    `useOfflineQuery` falls back to that local store when offline with no live/cached result. ⚠️
    Captures **creates incrementally + full state at `since=0`**; field-level edit deltas need a
    maintained `updatedAt`/`version` (scaffolding exists, not yet bumped on write).
- DoD (full Phase 1): airplane-mode create/edit/delete across builds+tasks+conventions, relaunch online (paid), zero loss, no dupes (blueprint Phase 9 DoD subset). **Met for builds, conventions, and tasks** — queue replay is dedupe-safe + id-stable, and offline writes are optimistically visible across plain-document views (builds/conventions) and the projected task views (planner + build tree).

### Phase 2 — Entitlement-gated sync + free local-only semantics

- Sync Worker starts **only** when `useFeatureAccess().canUseCloudSync`. Free users: worker never runs; `mutation_queue` **accumulates as local change history** (decided — upgrade flips the drain on; see §6).
- Verify free users make **zero Convex data calls** (auth-only traffic). Add a dev assertion / network log check.
- Free account still required: auth + `users.upsert` + welcome email unchanged; no data sync triggered by sign-in.
- **Groups (shared multi-user data) are online-only by nature** — there is no local-first for data several people edit (blueprint §3.13.6). Gate: **creating a group requires a paid tier** (the shared data is hosted under the creator's synced account; aligns with `collab_invites` being paid). **Joining/participating is free** — group screens are an online-only surface for free members (offline banner like social), reading/writing group data directly against Convex when connected, leaving their local-first personal data untouched.
- DoD: signed-in FREE user does full CRUD with network blocked at the Convex data layer; only auth endpoints hit. Free user can join + view a group while online; group create is gated to paid.

### Phase 3 — Local images (mobile)

- Picked images saved to app document dir (`expo-file-system`); entity row references a **local URI** + a stable `imageKey`.
- Image resolver: prefer local file; fall back to Convex `imageStorageId` URL when synced.
- Cloud upload becomes a **sync step** (paid): on drain, upload local file → Convex storage → patch row `imageStorageId`; keep local copy as cache. (Extends blueprint §3.13.6 "pending upload" to also be the permanent free-tier home.)
- DoD: FREE user adds build w/ photo offline forever; photo renders from local file with no network.

### Phase 4 — Web local-first

- Build the **web `LocalStore` adapter** (OPFS+wa-sqlite or Dexie) implementing the Phase 0 interface, including `entity_rows`, `mutation_queue`, `id_map`, `query_cache`.
- Web **offline bridge** `useOfflineQuery`/`useOfflineMutation` mirroring mobile semantics.
- Migrate web pages off direct Convex `useQuery`/`useMutation` to the bridge (the large chunk — mirrors the mobile screen migration). Add a web ESLint guard analogous to `no-direct-convex-in-offline-core`.
- Web local images: store blobs in IndexedDB/OPFS; resolver prefers local blob URL.
- Same entitlement gate: web sync worker runs only when paid.
- DoD: signed-in FREE web user does full CRUD + images with Convex data layer blocked; data persists across reload.

### Phase 5 — Export / Import (free durability)

- **CSV export** (free): one CSV per entity (builds, closet/nodes, tasks, conventions, packing) — data only, no images. Spreadsheet-friendly.
- **JSON-ZIP backup** (free): `.zip` = `data.json` (full graph) + `/images/<imageKey>.<ext>`; JSON references images by relative path. Use `fflate` (works in browser + RN). Offer "data only" vs "data + images" toggle + size warning.
- **PDF export** (free): also free — see entitlement note below.
- **Import** (free): parse zip/json, rehydrate images into local store, remap ids via `id_map`, merge with **last-write-wins by `updated_at`**; respect tombstones. This is the manual equivalent of sync and makes export a real backup.
- Entitlement change (decided): **all export is free** (CSV, JSON-ZIP, **and PDF**) in `entitlements.ts` / `useFeatureAccess`. The **only** paid lever is **automatic cloud sync** — positioned as "replaces the need to export at all." Remove `canExport*` gating distinctions; collapse to a single free export capability.
- DoD: export on device A → import on a fresh device B reproduces builds + images byte-faithfully; round-trip is idempotent (no dupes on re-import).

### Phase 6 — Upgrade backfill (free → paid)

- On entitlement transition to paid: run **initial backfill** — enqueue all local `entity_rows` (with `clientId`s) into `mutation_queue`; Sync Worker pushes; pulls server deltas via `sync.listChangedSince`.
- **Multi-device merge:** a free user may have independent local datasets on phone + web. First device seeds the cloud; subsequent devices reconcile against existing server rows by `clientId`, then content-hash to avoid duplicate inserts.
- Handle scale: chunk the backfill, surface progress UI, respect the 10k/50MB queue cap, sequence image uploads against the storage quota.
- DoD: two devices each with offline-only data upgrade; after sync both converge to the same set with **zero duplicates**; large (>500 item) backfill completes with visible progress.

### Phase 7 — Downgrade handling (paid → free)

- On transition to free: **stop the Sync Worker**; local store keeps working (back to free local-first).
- **Grace period** (e.g. 14–30 days): cloud data kept intact and re-subscribe resumes instantly. Then **freeze** cloud (read-only; no new writes accepted).
- **Over-quota:** if cloud usage > free cap, **block new cloud uploads** — never delete existing data. Prompt to trim or re-subscribe.
- **Retention cleanup:** a Convex cron purges frozen cloud data only after N months of no re-subscribe, **after** explicit warnings + an export offer. This is the **only** place cloud data is deleted; local data is never touched.
- Server: extend `billing.syncEntitlement` (per blueprint §3.13.5 / §billing) to record downgrade timestamp + grace/freeze state (`tierSource`, `subscriptionStatus`); add the retention cron in `convex/crons.ts`.
- DoD: paid user with synced data + photos downgrades; data remains intact locally and (read-only) in cloud through grace; re-subscribe within grace restores seamless sync; "no data loss" holds throughout.

### Phase 8 — Hardening, UX, tests

- Blueprint §3.13.7 affordances on both platforms: `ConnectivityBanner`, per-row pending-sync badge, rate-limited conflict toasts.
- E2E (extend blueprint Phase 9 DoD to web + freemium):
  - offline create/edit/delete across 3 entities, kill, relaunch, verify zero loss/dupes — **web and mobile**;
  - export → wipe → import round-trip;
  - upgrade backfill dedupe across 2 devices;
  - downgrade freeze + re-subscribe.
- Sentry triage, perf, and the storage-cap/eviction audit already specced in blueprint Phase 9.

---

## 4. Data-flow rules (the contract everything must obey)

1. UI reads/writes **only** through `useOfflineQuery`/`useOfflineMutation`. Direct `convex/react` hooks for Offline Core data are banned (ESLint-enforced on both platforms).
2. Local store is authoritative on-device; Convex is reachable **only** via the Sync Worker.
3. Sync Worker runs **iff** `canUseCloudSync && signedIn`.
4. Conflict resolution: **last-write-wins by `updated_at`/server `version`**; tombstones idempotent; no CRDT (consistent with blueprint non-goals).
5. Deletion of cloud data happens in exactly one place: the Phase 7 retention cron, gated on warnings + grace expiry. Nothing else deletes server data on downgrade.
6. Images: local file/blob is the durable home for free; cloud copy is an additive paid cache.

---

## 5. Web storage engine — DECIDED: OPFS + wa-sqlite

| Option                             | Pros                                                                                                           | Cons                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **OPFS + wa-sqlite (recommended)** | One SQL schema/queries shared with mobile SQLite; durable (OPFS not evicted like localStorage); large capacity | WASM bundle; worker plumbing; newer API surface                                                    |
| Dexie / raw IndexedDB              | Simplest to ship on web; mature                                                                                | Different query model than mobile (two code paths); IndexedDB eviction risk under storage pressure |

Recommend OPFS+wa-sqlite to keep a single data-layer mental model and stronger durability (directly supports the "don't lose data" promise). If WASM friction blocks Phase 4, ship Dexie behind the Phase 0 `LocalStore` interface and swap later.

---

## 6. Decisions

**Resolved (2026-06-14):**

1. **Web engine:** ✅ **OPFS + wa-sqlite** (shared SQL with mobile; durable). Dexie kept as fallback behind the Phase 0 interface only if WASM blocks Phase 4.
2. **Free `mutation_queue`:** ✅ **Keep queue rows as local change history** — upgrade just flips the drain on. Simpler and more robust than rebuilding from `entity_rows`.
3. **Export tiering:** ✅ **All export is free** (CSV, JSON-ZIP, PDF). The **only** paid lever is automatic cloud sync. No export-based upsell.
4. **Existing cloud data:** ✅ **One-time pull on first run** post-migration seeds each user's local store via `sync.listChangedSince(since=0)`. In scope (folded into Phase 4 launch / a dedicated migration step before cutover).

**Still open:**

5. **Grace period length** + **retention horizon** for Phase 7 (suggest 14–30 day grace, purge after ~6–12 months no-resubscribe, always after warning + export). Settle when building Phase 7.

---

## 7. Sequencing & estimate (single-dev, rough)

Phase 0 (~0.5w) → 1 (~1.5w) → 2 (~0.5w) → 3 (~1w) → 4 (~2–3w, largest) → 5 (~1.5w) → 6 (~1.5w) → 7 (~1w) → 8 (~1.5w). ≈ **10–13 weeks**. Phases 5/6/7 can parallelize with 4 once the Phase 0 interface lands. First proof-of-value slice: **Phase 1 on the closet/elements screen only** as a vertical slice before migrating every screen.
