# Final Implementation Gaps: Guide Index

Step-by-step implementation guides for each gap from the [final implementation plan](.cursor/plans/). Each guide has **steps in order** and a **Cursor prompt** per step you can paste into Cursor.

**Feature parity**: Unless a guide is marked **web-only** or **mobile-only**, implement the **same features on both web and mobile**. Guides that describe a feature (e.g. settings, itinerary, planner, build profile) include parity notes or steps for the other platform; platform-specific implementation guides (e.g. WEB_SYNC_WIRING, WEB_REPOS_AND_FULL_SYNC) stay as-is and call out that the other platform has its own implementation where relevant.

**Recommended order** (from the plan): do guides in this sequence where dependencies allow.

| Order | Guide                                                                            | Gap                                                                             |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1     | [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md)     | Builds require image; builds list as card layout with progress and tabs         |
| 2     | [SEED_DATA_IMPLEMENTATION.md](SEED_DATA_IMPLEMENTATION.md)                       | Seed closet item + link to build                                                |
| 3     | [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) | TaskChecklist on build detail; task create/update/delete and progress           |
| 4     | [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md)                       | Closet items → builds; tasks → closet items (assignment)                        |
| 5     | [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md)                               | Convention itinerary = convention tasks + build tasks from plan                 |
| 5b    | [PACKING_LIST.md](PACKING_LIST.md)                                               | Packing list: total progress, essentials, by-build sections, search, add item   |
| 5c    | [PLANNING_VIEW.md](PLANNING_VIEW.md)                                             | Planner: timeframe, progress, deadline/other tasks, task–build–convention links |
| 6     | [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md)                                   | Account Details, Subscription Plan, Notification Style; other menus             |
| 7     | [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md)                               | Stripe webhook + Checkout/Customer Portal                                       |
| 8     | [WEB_SYNC_WIRING.md](WEB_SYNC_WIRING.md)                                         | Call setupSyncTriggers from app root with session + canUseCloudSync             |
| 9     | [WEB_REPOS_AND_FULL_SYNC.md](WEB_REPOS_AND_FULL_SYNC.md)                         | closetRepo, conventionsRepo, buildTasksRepo; push/pull all entity types         |
| 10    | [WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md](WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md) | ImageUpload in closet/new and convention new/edit                               |
| 11    | [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md)                     | Sync status component (syncing / synced / offline, pending count)               |
| 12    | [WEB_FEATURE_GATES.md](WEB_FEATURE_GATES.md)                                     | FREE user upgrade prompts (e.g. sync)                                           |
| 13    | [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md)                           | IMPLEMENTATION_STATUS, SUPABASE_TODO, README, architecture, API docs            |
| 14    | [AUTH_WEB.md](AUTH_WEB.md)                                                       | Clarify or implement web auth (sync/tier need token)                            |
| 15    | [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md)                                     | Mobile image upload, task UI, convention/packing pull                           |
| 16    | [TESTING_AND_DEPLOYMENT.md](TESTING_AND_DEPLOYMENT.md)                           | Run checklists; deployment prep and verification                                |

---

## Quick reference

- **Backend-only**: SEED_DATA_IMPLEMENTATION, BUILDS_REQUIRE_IMAGE_AND_OVERVIEW (partial), SUBSCRIPTION_SERVICE, AUTH_WEB (if backend auth).
- **Web-only (implementation)** — same _features_ on mobile per parity notes in each guide: WEB_SYNC_WIRING, WEB_REPOS_AND_FULL_SYNC (web IndexedDB; mobile has own sync/storage), WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS, WEB_TASK_CHECKLIST_AND_BUILD_DETAIL, WEB_SYNC_STATUS_INDICATOR, WEB_FEATURE_GATES, DRAG_DROP_IMPLEMENTATION, CONVENTION_ITINERARY, PACKING_LIST, PLANNING_VIEW, SETTINGS_AND_MENUS.
- **Mobile**: MOBILE_NEXT_STEPS (mobile implementation; feature parity with web for image upload, task UI, sync pull, and cross-reference to other guides for itinerary/packing/planner/settings).
- **Docs/ops**: DOCS_AND_SETUP_UPDATES, TESTING_AND_DEPLOYMENT.
