# Final Implementation Gaps: Guide Index

Step-by-step implementation guides for each gap from the [final implementation plan](.cursor/plans/). Each guide has **steps in order** and a **Cursor prompt** per step you can paste into Cursor.

**Recommended order** (from the plan): do guides in this sequence where dependencies allow.

| Order | Guide | Gap |
|-------|--------|-----|
| 1 | [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md) | Builds require image; builds list as card layout with progress and tabs |
| 2 | [SEED_DATA_IMPLEMENTATION.md](SEED_DATA_IMPLEMENTATION.md) | Seed closet item + link to build |
| 3 | [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) | TaskChecklist on build detail; task create/update/delete and progress |
| 4 | [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md) | Closet items → builds; tasks → closet items (assignment) |
| 5 | [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md) | Convention itinerary = convention tasks + build tasks from plan |
| 6 | [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md) | Account Details, Subscription Plan, Notification Style; other menus |
| 7 | [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md) | Stripe webhook + Checkout/Customer Portal |
| 8 | [WEB_SYNC_WIRING.md](WEB_SYNC_WIRING.md) | Call setupSyncTriggers from app root with session + canUseCloudSync |
| 9 | [WEB_REPOS_AND_FULL_SYNC.md](WEB_REPOS_AND_FULL_SYNC.md) | closetRepo, conventionsRepo, buildTasksRepo; push/pull all entity types |
| 10 | [WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md](WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md) | ImageUpload in closet/new and convention new/edit |
| 11 | [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md) | Sync status component (syncing / synced / offline, pending count) |
| 12 | [WEB_FEATURE_GATES.md](WEB_FEATURE_GATES.md) | FREE user upgrade prompts (e.g. sync) |
| 13 | [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md) | IMPLEMENTATION_STATUS, SUPABASE_TODO, README, architecture, API docs |
| 14 | [AUTH_WEB.md](AUTH_WEB.md) | Clarify or implement web auth (sync/tier need token) |
| 15 | [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md) | Mobile image upload, task UI, convention/packing pull |
| 16 | [TESTING_AND_DEPLOYMENT.md](TESTING_AND_DEPLOYMENT.md) | Run checklists; deployment prep and verification |

---

## Quick reference

- **Backend-only**: SEED_DATA_IMPLEMENTATION, BUILDS_REQUIRE_IMAGE_AND_OVERVIEW (partial), SUBSCRIPTION_SERVICE, AUTH_WEB (if backend auth).
- **Web-only**: WEB_SYNC_WIRING, WEB_SYNC_STATUS_INDICATOR, WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS, WEB_REPOS_AND_FULL_SYNC, WEB_TASK_CHECKLIST_AND_BUILD_DETAIL, WEB_FEATURE_GATES, DRAG_DROP_IMPLEMENTATION, CONVENTION_ITINERARY, SETTINGS_AND_MENUS.
- **Mobile**: MOBILE_NEXT_STEPS.
- **Docs/ops**: DOCS_AND_SETUP_UPDATES, TESTING_AND_DEPLOYMENT.
