# Refactor Test Plan (REQ → tests)

_Maps spec requirements to tests. Philosophy/conventions in [`../TESTING.md`](../TESTING.md). Tests
are written against the **spec**; many **fail first** (marked ⛔ = expected red before implementation)._

---

## 1. Existing tests: keep / rewrite / delete

_Verdicts from a full read-through (2026-06-17), classified by whether the test asserts **behavior**
(trustworthy spec guard) or is **coupled to implementation / soon-deleted model / overturned rules**.
`B`=behavior-based, `IMPL`=implementation-coupled, `MODEL`=tests a to-be-deleted model, `RULES`=bakes
in freemium/storage rules the spec changes._

| Existing test                                                              | Class      | Verdict                  | Reason                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ---------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offline/offlineMutationQueue.test.ts`                                     | B          | **Keep**                 | Pure backoff/retry policy; unchanged                                                                                                                                                                            |
| `offline/offlineQueryCache.test.ts`                                        | B          | **Keep**                 | Key derivation; unchanged                                                                                                                                                                                       |
| `offline/offlineIdMap.test.ts`                                             | B          | **Keep**                 | Id remap on replay; unchanged                                                                                                                                                                                   |
| `offline/offlineEntityOverlay.test.ts`                                     | B          | **Keep (extend)**        | Overlay retained; extend to all local-first entities                                                                                                                                                            |
| `offline/offlinePlannerOverlay.test.ts`, `offlineBuildTreeOverlay.test.ts` | B          | **Keep**                 | Planner model retained                                                                                                                                                                                          |
| `workflowProgress.test.ts`                                                 | B          | **Keep**                 | Progress math; behavior-based                                                                                                                                                                                   |
| `workflowDomain.test.ts`                                                   | B          | **Keep**                 | Tree build + dependency blocking; behavior-based                                                                                                                                                                |
| `i18n/locale.test.ts`                                                      | B          | **Keep**                 | Locale allowlist behavior                                                                                                                                                                                       |
| `UpgradePrompt.test.tsx`                                                   | B          | **Keep (extend)**        | Good role/text behavior; add new paid levers (publish, social post, group create)                                                                                                                               |
| `BuildNotesModal.test.tsx`                                                 | B          | **Keep**                 | Real render + user-event behavior                                                                                                                                                                               |
| `BuildSummaryModal.test.tsx`, `BuildSummarySection.test.tsx`               | B          | **Keep (minor)**         | Behavior-based; reconcile copy with Elements terminology                                                                                                                                                        |
| `BuildReferenceImagesSection.test.tsx`                                     | **IMPL**   | **Deleted → replaced**   | Anti-pattern (asserted `typeof===function`, arity, `.toString()` regex). Replaced by pure gallery behavior in `offline/mediaGallery.test.ts` (REQ-047/048) ⛔                                                   |
| `BuildProcessPicturesSection.test.tsx`                                     | **IMPL**   | **Deleted → replaced**   | Same anti-pattern; same replacement (process photos use the same gallery domain logic) ⛔                                                                                                                       |
| `settings/page.test.tsx`                                                   | **RULES**  | **Rewritten**            | Dropped `canExport:false` + "backup **and export**" upsell assertion. Now: `should_not_gate_export_behind_an_upgrade_prompt_for_free_user` + `should_warn_free_user_to_export_before_sign_out` (REQ-012/031) ⛔ |
| `settings/subscription/page.test.tsx`                                      | **RULES**  | **Rewritten**            | Dropped `storageLimitMb:50` coupling. Now asserts tier display + `should_present_cloud_sync_as_the_paid_upgrade` (REQ-015/091)                                                                                  |
| `builds/page.test.tsx` (`buildsListArgs`)                                  | **IMPL**   | **Deleted → replaced**   | Server-arg shaping removed; replaced by local-first `offline/buildsList.test.ts` (`filterAndSortBuilds`) ⛔                                                                                                     |
| `settings/account/page.test.tsx`                                           | B(+wiring) | **Keep (extend)**        | Mostly behavior; extend for export-on-delete + sign-out export warning (REQ-031/032)                                                                                                                            |
| `settings/notifications/page.test.tsx`                                     | B          | **Keep**                 | Placeholder-page behavior; revisit when notifications are spec'd                                                                                                                                                |
| `cosplayGraph.test.ts`                                                     | MODEL      | **Deleted → retargeted** | Graph (`material` nodeType, `isAllowedLink`) dropped. Surviving concepts (cost math, progress, cycle prevention) retargeted to `web/src/lib/elements.test.ts` ⛔                                                |
| `cosplayUi.test.ts`                                                        | MODEL      | **Deleted → retargeted** | Node-type/material labels dropped; search-text concept retargeted to `elements.test.ts` ⛔                                                                                                                      |
| `backend-archived/.../handler_test.go`                                     | —          | **Delete**               | Archived Go backend, unused                                                                                                                                                                                     |

**Trust summary:** the offline/domain core is genuinely behavior-tested (the risky part is well covered).
The untrustworthy set has now been handled: the 2 non-tests + the `buildsListArgs` impl test were
deleted and replaced by pure behavior tests (`offline/mediaGallery.test.ts`, `offline/buildsList.test.ts`);
the 2 settings tests were rewritten to defend the new freemium/storage behavior; and the 2 graph-model
suites were retargeted to `elements.test.ts`. None of the "Keep" tests assert internals the spec breaks.

**New shared-domain modules added as stubs (throw until implemented):** `domain/mediaGallery.ts`
(`appendToGallery`/`reorderGallery`/`removeFromGallery`/`setGalleryCaption`/`sortProgressUpdates`),
`domain/buildsList.ts` (`filterAndSortBuilds`), `domain/elements.ts` (`normalizeElementCostCents`/
`deriveElementProgressPercent`/`wouldCreateElementCycle`/`elementSearchText`).

---

## 2. New / updated tests by requirement

Legend: type U=unit(pure) · C=component · A=api/backend · I=integration. ⛔ expected-fail-first.

### Freemium & entitlements (PRODUCT_SPEC §3)

| REQ     | Behavior                                     | Type | Tests                                                                                                                                                                      |
| ------- | -------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-002 | Pro == Supporter feature access              | U    | `should_grant_identical_access_for_pro_and_supporter`                                                                                                                      |
| REQ-013 | Advanced planner is **free**                 | U    | ⛔ `should_keep_advanced_planner_free` (current code gates it paid)                                                                                                        |
| REQ-012 | Export/import free                           | U    | `should_allow_export_and_import_for_free_user`                                                                                                                             |
| REQ-015 | Cloud sync gated paid                        | U    | `should_gate_cloud_sync_to_paid`                                                                                                                                           |
| REQ-017 | Publish/share gated paid                     | U/C  | ⛔ `should_block_public_share_for_free_user`                                                                                                                               |
| REQ-018 | Social posting gated paid; interactions free | U/C  | `should_block_feed_post_for_free_user`, `should_allow_like_comment_follow_for_free_user`                                                                                   |
| REQ-019 | Group create paid; join free                 | U/A  | `should_block_group_create_for_free_user`, `should_allow_join_group_for_free_user`                                                                                         |
| REQ-021 | Group-cosplay build cloud exception + guards | U/A  | ⛔ `should_allow_group_cosplay_build_to_cloud_for_free_member`, ⛔ `should_block_non_group_build_cloud_for_free_user`, ⛔ `should_enforce_group_build_count_and_mb_limits` |
| REQ-022 | Paid action → upgrade prompt, no data loss   | C    | `should_show_upgrade_prompt_without_blocking_local_work`                                                                                                                   |

### Storage & quotas (DATA_AND_SYNC §9)

| REQ-D90/9 | Free cloud cap = 0; paid = 2048; over-cap blocks uploads only | U | ⛔ `should_set_free_cloud_cap_to_zero`, `should_set_paid_cloud_cap_2048`, ⛔ `should_block_new_cloud_upload_over_cap_without_deleting` |

### Sync worker & local-first (DATA_AND_SYNC §6)

| REQ-D60 | Worker gated on `canUseCloudSync && signedIn` | U | ⛔ `should_not_start_sync_worker_for_free_user`, `should_start_sync_worker_for_paid_signed_in_user`, ⛔ `should_not_start_sync_worker_when_signed_out` |
| REQ-D10 | Free user → zero Convex data calls | I | ⛔ `should_make_zero_convex_data_calls_for_free_user` |
| REQ-D61 | FIFO, stop-on-first-failure, capped backoff | U | `should_replay_queue_in_fifo_order`, `should_stop_pass_on_first_transient_failure` |
| REQ-D62 | Idempotent replay (no dupes) | U/A | `should_dedupe_replayed_offline_create` |
| REQ-D41 | Client→server id remap rewrites later ops | U | `should_rewrite_dependent_ops_after_id_map` |
| REQ-D63 | Warm-up covers all local-first entities + edit deltas | A | ⛔ `should_return_changed_rows_for_all_local_first_tables`, ⛔ `should_include_field_edits_via_updatedAt_delta` |
| REQ-D64 | Sync status observable; failures surfaced | C | `should_show_pending_badge_and_last_synced`, `should_surface_failed_sync_state` |

### Conflict resolution (DATA_AND_SYNC §6.1)

| REQ-D65/66 | Per-field LWW merge | U | ⛔ `should_merge_per_field_when_two_devices_edit_different_fields`, ⛔ `should_let_remote_newer_field_win`, ⛔ `should_let_tombstone_win_over_older_edit`, ⛔ `should_break_equal_timestamp_ties_deterministically` |

### Elements (PRODUCT_SPEC §4.2)

| REQ-040 | Element CRUD is build-scoped (no Closet page) | C | ⛔ `should_manage_elements_within_build_detail` |
| REQ-041 | Sub-element hierarchy; delete-parent prompt | U/C | ⛔ `should_support_sub_elements`, ⛔ `should_prompt_when_deleting_parent_element_with_children` |
| REQ-042 | Duplicate element to another build | U | ⛔ `should_duplicate_element_into_another_build_independently` |
| REQ-044/046 | Element status feeds build progress | U | `should_derive_build_progress_from_elements_and_tasks` |

### Builds, media & progress updates (PRODUCT_SPEC §4.3)

| REQ-047/048 | Reference/process galleries: add/reorder/caption/delete | C | `should_add_reorder_caption_delete_reference_images` |
| REQ-049 | Progress updates timeline; empty state; publish (paid) | C | ⛔ `should_show_empty_state_when_build_has_no_progress_updates`, ⛔ `should_add_progress_update_to_timeline_immediately`, ⛔ `should_block_publish_progress_update_to_feed_for_free_user` |
| REQ-050 | Visibility default private; public requires paid | U/C | `should_default_build_visibility_to_private` |

### Conventions/packing & planner (PRODUCT_SPEC §4.4–4.5)

| REQ-053 | Packing regen preserves manual + checked | U | `should_preserve_manual_items_and_checked_state_on_regen` |
| REQ-061 | Task attach to element/build rolls up progress | U | `should_roll_up_task_completion_to_build_progress` |
| REQ-063 | Planner advanced fields hidden by default | C | ⛔ `should_hide_advanced_task_fields_by_default` |

### Auth & account (PRODUCT_SPEC §4.1)

| REQ-001 | Account required beyond public pages | C | `should_require_account_for_personal_data` |
| REQ-031 | Sign-out warns free user to export | C | ⛔ `should_warn_free_user_to_export_on_signout` |
| REQ-033 | Expired session doesn't wipe local data | I | ⛔ `should_not_wipe_local_data_on_expired_session` |

### Tier transitions (DATA_AND_SYNC §10)

| REQ-D95 | Upgrade backfill dedupes across devices | I | ⛔ `should_backfill_without_duplicates_on_upgrade` |
| REQ-D96 | Downgrade: stop sync, keep local, grace then freeze, never delete local | U/A | ⛔ `should_stop_sync_and_preserve_data_on_downgrade`, ⛔ `should_never_delete_local_data_on_downgrade` |

### Online-only surfaces (PRODUCT_SPEC §5)

| REQ-101/082 | Social/groups/billing show offline banner offline | C | `should_show_offline_banner_for_online_only_surface` |

### Export / import (DATA_AND_SYNC §11)

| REQ-D101/102 | Idempotent import; round-trip fidelity | U/I | ⛔ `should_be_idempotent_on_reimport`, ⛔ `should_round_trip_builds_and_images` |

---

## 3. Backend (Convex) tests

Runner: `convex-test` + edge-runtime via `convex/vitest.config.ts` (`npm run test:convex`). Written and
verified:

| Area                    | File             | Tests                                                                                                                                                                                                 |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency ledger      | `builds.test.ts` | ✅ `should_record_and_replay_an_idempotent_create_exactly_once`, ✅ `should_insert_separately_for_distinct_idempotency_keys`                                                                          |
| Ownership/authorization | `builds.test.ts` | ✅ `should_scope_list_to_the_requested_user`, ✅ `should_prevent_a_non_owner_from_updating_a_build`                                                                                                   |
| Visibility default      | `builds.test.ts` | ✅ `should_default_build_visibility_to_private` (REQ-050)                                                                                                                                             |
| `sync.listChangedSince` | `sync.test.ts`   | ✅ `should_scope_results_to_the_authenticated_user`, ✅ `should_return_nothing_for_an_unauthenticated_caller`, ⛔ `should_return_all_local_first_tables…`, ⛔ `should_advance_cursor_on_field_edits…` |

Backend status: **9 written — 7 green, 2 fail-first** (the two ⛔ guard the spec gaps: warm-up must
cover every local-first table, and the cursor must track `updatedAt` field-edit deltas, not just
`_creationTime` creates).

---

## 4. First implementation slice (smallest red→green)

1. `domain/syncPolicy.ts` + gate `SyncWorkerProvider` (REQ-D60) — turns AC-02 green.
2. `entitlements.ts` advanced-planner-free + `cloudStoragePolicy.ts` (REQ-013, REQ-D90).
3. `domain/offlineConflict.ts` field-LWW (REQ-D65/66).
4. Group-cosplay cloud exception (REQ-021).

These four have pure, fast unit tests and unblock the core invariants before the larger schema/UI work.

---

## 5. Test authoring status

**Written (red, ready for implementation):**

- Pure domain: `syncPolicy`, `entitlements` (freemium core), `cloudStoragePolicy` (caps + group
  exception + `isWithinCloudCap` over-cap, REQ-D90), `offlineConflict`, `mediaGallery`, `buildsList`,
  `elements` (cost/progress/cycle/search + `duplicateElementForBuild`, REQ-042), `packingList`
  (REQ-053), `tierTransition` (REQ-D95/96), `importExport` (REQ-D101/102), and the remaining freemium
  feature boundaries (`freemiumFeatures.test.ts`: REQ-012/017/018/019).
- Rewritten behavior tests: `settings/page` (export-free + sign-out export warning),
  `settings/subscription` (sync value prop).

**Deferred by design (authored within their implementation slice, not guessed now):**

- **Component/integration ⛔ tests** (elements build-scoped CRUD, sub-element hierarchy, duplicate-to-build,
  gallery/progress-timeline UI, planner advanced-fields-hidden, offline banners, upgrade-prompt-no-data-loss,
  expired-session-keeps-local, zero-Convex-calls-for-free-user, sync-status UI). Per `TESTING.md`
  these must assert real rendered behavior against the rebuilt components; writing them before the
  components exist would couple them to guessed APIs. They are written alongside each slice.
- **Backend Convex suite (§3)** — DONE. Stood up `convex-test` + `convex/vitest.config.ts`
  (`npm run test:convex`); wrote and verified the idempotency-ledger / ownership-scoping /
  `sync.listChangedSince` tests (6 green, 2 fail-first).
