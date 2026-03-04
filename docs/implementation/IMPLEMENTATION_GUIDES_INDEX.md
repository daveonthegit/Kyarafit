# Final Implementation Gaps: Guide Index

Step-by-step implementation guides for each gap from the [final implementation plan](.cursor/plans/). Each guide has **steps in order** and a **Cursor prompt** per step you can paste into Cursor.

**Convex migration (2026)**: The app now uses **Convex** and **Better Auth** instead of Supabase + Go. Web uses Convex only (no IndexedDB sync to Go). Mobile uses Convex when signed in and syncs to local SQLite. Guides that assumed Go REST API or web IndexedDB/sync are **obsolete as written** — see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for which guides to use vs reframe.

**Feature parity**: Unless a guide is marked **web-only** or **mobile-only**, implement the **same features on both web and mobile**. Guides that describe a feature (e.g. settings, itinerary, planner, build profile) include parity notes or steps for the other platform.

**Recommended order**: Do guides in the table sequence where dependencies allow. Skip or reframe guides marked **Obsolete** below.

| Order | Guide                                                                            | Gap                                                                             |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ~ 1   | [BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md](BUILDS_REQUIRE_IMAGE_AND_OVERVIEW.md)     | Builds require image; builds list as card layout with progress and tabs         |
| 2     | [SEED_DATA_IMPLEMENTATION.md](SEED_DATA_IMPLEMENTATION.md)                       | Reframe for Convex (mutation or script); Go seed endpoint removed.              |
| ~3    | [WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md](WEB_TASK_CHECKLIST_AND_BUILD_DETAIL.md) | TaskChecklist on build detail; task create/update/delete and progress           |
| ~ 4   | [DRAG_DROP_IMPLEMENTATION.md](DRAG_DROP_IMPLEMENTATION.md)                       | Closet items → builds; tasks → closet items (assignment)                        |
| ~5    | [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md)                               | Convention itinerary = convention tasks + build tasks from plan                 |
| 5b    | [PACKING_LIST.md](PACKING_LIST.md)                                               | Packing list: total progress, essentials, by-build sections, search, add item   |
| 5c    | [PLANNING_VIEW.md](PLANNING_VIEW.md)                                             | Planner: timeframe, progress, deadline/other tasks, task–build–convention links |
| 6     | [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md)                                   | Account Details, Subscription Plan, Notification Style; other menus             |
| 7     | [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md)                               | Stripe webhook + Checkout/Customer Portal                                       |
| 8     | [WEB_SYNC_WIRING.md](WEB_SYNC_WIRING.md)                                         | **Obsolete** — Web uses Convex only; no sync to Go.                             |
| 9     | [WEB_REPOS_AND_FULL_SYNC.md](WEB_REPOS_AND_FULL_SYNC.md)                         | **Obsolete** — No web IndexedDB repos or push/pull to Go.                       |
| 10    | [WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md](WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md) | ImageUpload in closet/new and convention new/edit (use Convex files, not Go)     |
| 11    | [WEB_SYNC_STATUS_INDICATOR.md](WEB_SYNC_STATUS_INDICATOR.md)                     | **Obsolete** — No web sync service; any status would be Convex subscription.    |
| 12    | [WEB_FEATURE_GATES.md](WEB_FEATURE_GATES.md)                                     | Reframe for Convex when tiers exist (no Go tier API).                           |
| 13    | [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md)                           | Keep docs aligned with Convex + Better Auth (see IMPLEMENTATION_STATUS).         |
| 14    | [AUTH_WEB.md](AUTH_WEB.md)                                                       | **Done** — Better Auth; see [auth.md](../auth.md).                               |
| 15    | [MOBILE_NEXT_STEPS.md](MOBILE_NEXT_STEPS.md)                                     | Mobile image upload, task UI, convention/packing pull                           |
| 16    | [TESTING_AND_DEPLOYMENT.md](TESTING_AND_DEPLOYMENT.md)                           | Run checklists; deployment prep and verification                                |

---

## Quick reference

- **Backend (Convex)**: SEED_DATA (reframe for Convex), SUBSCRIPTION_SERVICE (Stripe + Convex when implemented). AUTH is Better Auth — done.
- **Web**: Use Convex only. Relevant guides (adapt for Convex): WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS, WEB_TASK_CHECKLIST_AND_BUILD_DETAIL, DRAG_DROP_IMPLEMENTATION, CONVENTION_ITINERARY, PACKING_LIST, PLANNING_VIEW, SETTINGS_AND_MENUS, WEB_FEATURE_GATES (when tiers exist). WEB_SYNC_* guides are obsolete.
- **Mobile**: MOBILE_NEXT_STEPS; feature parity with web (image upload, task UI, itinerary/packing/planner/settings). Sync is Convex ↔ SQLite (useConvexSync).
- **Docs/ops**: DOCS_AND_SETUP_UPDATES, TESTING_AND_DEPLOYMENT.
