# Mobile: Next Steps (Convex)

**Purpose:** Mobile image upload via Convex; build detail with task checklist; convention and packing data from Convex (or SQLite when synced). Feature parity with web where applicable. No Go backend.

**Scope:** In: Mobile build/closet/convention create with Convex file upload; mobile build detail with task CRUD; useConvexSync and convexSync for Convex↔SQLite; settings and other screens per SETTINGS_AND_MENUS. Out: POST /api/v1/upload/image, backend sync pull (mobile uses Convex + convexSync).

**Current state:**

- **Mobile Convex:** [mobile/app/\_layout.tsx](mobile/app/_layout.tsx) — Convex + Better Auth providers. Screens use useQuery/useMutation with Convex api.
- **Sync:** [mobile/src/hooks/useConvexSync.ts](mobile/src/hooks/useConvexSync.ts), [mobile/src/services/convexSync.ts](mobile/src/services/convexSync.ts) — Convex→SQLite sync; push local changes to Convex. [mobile/src/storage/](mobile/src/storage/) — SQLite repos for offline.
- **Image upload:** Mobile may still use local-only or data URL for build/closet/convention; should use Convex generateUploadUrl → upload → getUrl like web.
- **Build detail:** May have task list; ensure task create/update/delete use api.buildTasks and progress (X/Y) is shown.
- **Convention/packing:** Data from Convex when signed in (or SQLite when offline after sync); ensure convention list, day plan, packing list load and update via Convex (or synced SQLite).

**Next steps:**

1. **Image upload:** In mobile build create, closet create, convention create: on photo pick (Expo ImagePicker), call Convex generateUploadUrl, upload blob to URL with auth (Bearer token), call getUrl, pass imageUrl/imageStorageId into create mutation. Handle errors and optionally offline (queue or show "Image upload requires network").
2. **Build detail + tasks:** Build detail screen: fetch build and buildTasks (useQuery api.buildTasks.listByBuild). Render task list with check/uncheck (update mutation), add task (create), delete (remove). Show progress (tasksChecked/tasksTotal). Match web TaskChecklist behavior where applicable.
3. **Convention and packing:** Ensure convention list, convention detail, day plan, and packing list use Convex queries/mutations when signed in; useConvexSync keeps SQLite updated; convexSync pushes local changes. No separate "sync pull" to Go.
4. **Settings and parity:** Implement settings menu and sub-screens (Account, Subscription, Notifications) per SETTINGS_AND_MENUS; use same useTier/useFeatureAccess when available on mobile. Itinerary and planner screens with same data as web (Convex).
5. **Offline/signed-out UX:** Clear "Sign in to sync" and pending-sync indicators; consistent behavior when offline or signed out (SQLite-only flows).

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Mobile offline/sync, Image upload), [WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md](WEB_IMAGE_UPLOAD_CLOSET_CONVENTIONS.md), [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [CONVENTION_ITINERARY.md](CONVENTION_ITINERARY.md), [PACKING_LIST.md](PACKING_LIST.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
