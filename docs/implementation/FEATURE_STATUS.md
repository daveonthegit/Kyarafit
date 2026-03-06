# Feature Status

Audit of each canonical feature: IMPLEMENTED / PARTIAL / NOT IMPLEMENTED, with evidence (file paths).

For **competitor comparison** (Cosplanner vs Kyarafit) and gaps that map to these features (e.g. elements ≈ closet items, summary dashboard, status filter), see [Competitor Analysis & Implementation Plan](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) — Section 3 (Feature Comparison Table) and Section 4 (High-Value Feature Gaps).

Last updated: 2026-03-05.

---

## Summary Table

| Feature                            | Backend     | Frontend (web) | Frontend (mobile) | DB          | Infra | Tests            | Status      | Evidence                                                                                                                                                                                              |
| ---------------------------------- | ----------- | -------------- | ----------------- | ----------- | ----- | ---------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                               | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | Yes   | PARTIAL (manual) | IMPLEMENTED | convex/betterAuth/, convex/http.ts, web/src/lib/auth/, web/src/app/auth/, mobile/src/lib/auth/, mobile/app/\_layout.tsx                                                                               |
| Closet                             | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | convex/closetItems.ts, web/src/app/closet/, web/src/app/add-item/, mobile (tabs + Convex)                                                                                                             |
| Builds                             | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | convex/builds.ts, web/src/app/builds/, web/src/app/build-detail/, mobile app                                                                                                                          |
| Build tasks                        | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | convex/buildTasks.ts, web/src/components/builds/TaskChecklist.tsx, web/src/app/build-detail/page.tsx                                                                                                  |
| Conventions                        | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | convex/conventions.ts, web/src/app/conventions/, mobile                                                                                                                                               |
| Itinerary                          | IMPLEMENTED | PARTIAL        | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL     | convex/conventions.ts (day plans), web/src/app/itinerary/page.tsx (stub or basic)                                                                                                                     |
| Packing list                       | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | convex/conventions.ts (packingListItems), web/src/app/conventions/[id]/packing/page.tsx                                                                                                               |
| Planner                            | IMPLEMENTED | IMPLEMENTED    | PARTIAL           | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | convex/buildTasks.ts (listForPlanner), web/src/app/planner/page.tsx (Daily: tasks, progress, deadline/other, checkbox, add-task; Conventions: real list + links); web/src/app/planner/page.test.tsx   |
| Settings                           | N/A         | IMPLEMENTED    | PARTIAL           | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | web/src/app/settings/page.tsx (menu links), /settings/account, /settings/subscription, /settings/notifications; Convex users (tier); settings/\*.test.tsx                                             |
| Tiers / subscription               | PARTIAL     | IMPLEMENTED    | PARTIAL           | IMPLEMENTED | NOT   | PARTIAL (unit)   | PARTIAL     | convex/users.ts (getMe), useTier + useFeatureAccess; web UpgradePrompt + FeatureGate; settings shows prompt when !canUseCloudSync; no Stripe webhook/Checkout                                         |
| Mobile offline/sync                | IMPLEMENTED | N/A            | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED | mobile/src/storage/, mobile/src/hooks/useConvexSync.ts, mobile/src/services/convexSync.ts                                                                                                             |
| Image upload                       | IMPLEMENTED | IMPLEMENTED    | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL     | convex/files.ts, web ImageUpload in builds + closet/new + conventions/new and conventions/[id]/edit; convention detail shows image; mobile may not use Convex upload everywhere                       |
| Seed data                          | IMPLEMENTED | IMPLEMENTED    | NOT               | —           | —     | NOT              | IMPLEMENTED | convex/seed.ts (createStarter); web dev route /dev/seed (type URL to access)                                                                                                                          |
| Build summary dashboard (14)       | IMPLEMENTED | IMPLEMENTED    | NOT               | —           | —     | PARTIAL (unit)   | IMPLEMENTED | convex/builds.ts (getSummary), web BuildSummarySection + build-detail; BuildSummarySection.test.tsx; element breakdown deferred until buildItemLinks type/status                                      |
| Build project notes dedicated (15) | IMPLEMENTED | IMPLEMENTED    | PARTIAL           | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | build.notes; web: BuildNotesModal + Notes button on build detail; convex/builds.update(notes); BuildNotesModal.test.tsx                                                                               |
| Build reference images (16)        | IMPLEMENTED | IMPLEMENTED    | NOT               | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | convex/schema.ts, convex/buildReferenceImages.ts, web BuildReferenceImagesSection + ImageGallery; build-detail; BuildReferenceImagesSection.test.tsx                                                  |
| Build process pictures (17)        | IMPLEMENTED | IMPLEMENTED    | NOT               | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | convex/schema.ts, convex/buildProcessPictures.ts, web BuildProcessPicturesSection + ImageGallery; build-detail; BuildProcessPicturesSection.test.tsx                                                  |
| Build list search/filter/sort (18) | IMPLEMENTED | IMPLEMENTED    | NOT               | IMPLEMENTED | —     | PARTIAL (unit)   | IMPLEMENTED | convex/builds.ts (list: status, search, sortBy, order), web/src/app/builds/page.tsx, web/src/lib/buildsListArgs.ts, web/src/app/builds/page.test.tsx                                                  |
| i18n (19)                          | N/A         | IMPLEMENTED    | NOT               | —           | —     | PARTIAL (unit)   | IMPLEMENTED | next-intl; web/messages/en.json, es.json; web/src/lib/i18n/, LocaleProvider; Settings translated + language selector; locale in localStorage; web/src/lib/i18n/locale.test.ts, settings/page.test.tsx |

---

## Evidence Detail

### Auth

- **Backend:** Better Auth in convex/betterAuth/ (auth.ts, schema.ts, adapter.ts); HTTP routes in convex/http.ts; getCurrentUser in convex/auth.ts.
- **Web:** web/src/lib/auth/auth-client.ts, auth-server.ts, bearer-storage-plugin.ts; web/src/components/ConvexClientProvider.tsx, AuthGate.tsx; web/src/app/auth/signin/page.tsx, signup/page.tsx, verify-email/, reset-password/.
- **Mobile:** mobile/src/lib/auth/; ConvexBetterAuthProvider in mobile/app/\_layout.tsx; OTT handler for OAuth.
- **Tests:** Manual; no automated auth e2e.

### Closet

- **Backend:** convex/closetItems.ts (list, get, create, update, remove); schema closetItems with userId index.
- **Web:** web/src/app/closet/page.tsx, web/src/app/closet/new/page.tsx, web/src/app/add-item/page.tsx; Convex useQuery/useMutation; ImageUpload on closet new.
- **Mobile:** Uses Convex when signed in; offline SQLite + sync per useConvexSync/convexSync.

### Builds

- **Backend:** convex/builds.ts (get, list, create, update, remove, linkItems, getItems); buildItemLinks table.
- **Web:** web/src/app/builds/page.tsx, web/src/app/builds/new/page.tsx, web/src/app/build-detail/page.tsx, web/src/app/build-detail/link-items/page.tsx; ImageUpload on new and build-detail edit.
- **DB:** builds, buildItemLinks; no required-image enforcement in mutation.

### Build tasks

- **Backend:** convex/buildTasks.ts (listByBuild, create, update, remove).
- **Web:** web/src/app/build-detail/page.tsx uses TaskChecklist; useMutation(api.buildTasks.update), etc.; tasks from useQuery(api.buildTasks.listByBuild).

### Conventions

- **Backend:** convex/conventions.ts (CRUD, day plans, packing list); conventionDayPlans, packingListItems tables.
- **Web:** web/src/app/conventions/page.tsx, web/src/app/conventions/new/page.tsx, web/src/app/conventions/[id]/page.tsx, web/src/app/conventions/[id]/edit/page.tsx, web/src/app/conventions/[id]/packing/page.tsx. ImageUpload on convention new and edit; convention detail shows image when set.

### Itinerary

- **Backend:** Day plans and packing in convex/conventions.ts; builds/buildTasks available for status.
- **Web:** web/src/app/itinerary/page.tsx exists; may be stub ("Assign a build from your convention plan") or basic; full day-by-day build cards and countdown may be PARTIAL.

### Packing list

- **Backend:** packingListItems in convex/conventions.ts (list, update, add manual, regenerate).
- **Web:** web/src/app/conventions/[id]/packing/page.tsx with ChecklistRow, regenerate; essentials and by-date grouping.

### Planner

- **Backend:** convex/buildTasks.ts listForPlanner(userId) returns build tasks with buildName and optional dueDate (from convention day plan); auth enforced.
- **Web:** web/src/app/planner/page.tsx — Daily view: useQuery(listForPlanner), timeframe filter (All/Today/This week), progress summary (X of Y tasks + bar), Deadline approaching and Other sections, task rows (checkbox → buildTasks.update, build name link to build-detail, optional due date), Add task link to /builds; Conventions view: useQuery(conventions.list), convention rows with Itinerary and Packing List links.
- **Tests:** web/src/app/planner/page.test.tsx (Vitest) — tabs, progress summary, deadline section, task labels and build links, Add task link, Conventions tab with convention list and itinerary/packing links).

### Settings

- **Web:** web/src/app/settings/page.tsx shows tier/storage (useTier) and menu links to Account Details, Subscription Plan, Notification Style. Routes: /settings/account (email, display name, change password link), /settings/subscription (tier, storage from useTier; upgrade/manage placeholder), /settings/notifications (placeholder). Unit tests: web/src/app/settings/page.test.tsx, account/page.test.tsx, subscription/page.test.tsx, notifications/page.test.tsx.
- **DB:** users table has tier, currentUsageMb, stripeCustomerId, etc.; useTier wired to Convex users.getMe.

### Tiers / subscription

- **Backend:** convex/users.ts getMe returns tier, currentUsageMb, storageLimitMb (storageLimitMb from TIER_LIMITS). Schema has tier and Stripe fields; no Stripe webhook or Checkout/Portal implementation.
- **Frontend:** web/src/lib/api/useTier.ts calls useQuery(api.users.getMe, { externalId: userId }) when signed in (userId from useCurrentUser); returns real tier from Convex. useFeatureAccess() derives gates from useTier. UpgradePrompt and FeatureGate in web/src/components/UpgradePrompt.tsx; settings page (Backup & storage) shows UpgradePrompt when !canUseCloudSync with message and link to /settings/subscription. Unit tests: UpgradePrompt.test.tsx, settings page.test.tsx (upgrade prompt link).

### Mobile offline/sync

- **Mobile:** mobile/src/storage/ (SQLite repos); mobile/src/hooks/useConvexSync.ts; mobile/src/services/convexSync.ts; Convex ↔ SQLite sync when signed in.

### Image upload

- **Backend:** convex/files.ts (generateUploadUrl, getUrl).
- **Web:** web/src/components/ui/ImageUpload.tsx uses Convex; used in web/src/app/builds/new/page.tsx, web/src/app/build-detail/page.tsx, web/src/app/closet/new/page.tsx, web/src/app/conventions/new/page.tsx, web/src/app/conventions/[id]/edit/page.tsx; convention detail shows image via ResolvedImage when set.
- **Mobile:** May use Convex upload in some flows; parity with web (closet, convention image) may be PARTIAL.

### Seed data

- **Intended for:** Dev/dashboard use only (not for regular end users). Use for local testing, demos, or Convex dashboard.
- **Backend:** convex/seed.ts — `createStarter` mutation: requires auth; if user has any builds, returns `{ skipped: true }`; otherwise creates one build, one convention, one closet item (linked to build), one build task; returns `{ skipped: false, buildId, conventionId, closetItemId }`.
- **Web:** web/src/app/dev/seed/page.tsx — dev-only route at `/dev/seed` (no link in app; type URL to access). Button runs `api.seed.createStarter`; shows result or error. In production the button is disabled and shows "Not available in production".
- **Mobile:** No UI; mutation can be invoked from Convex dashboard or dev tooling.
- **Tests:** Manual; no automated tests.

### Build summary dashboard (14)

- **Status:** IMPLEMENTED (web). Convex `builds.getSummary` query (buildId, userId) returns status, progress %, tasksChecked/Total, createdDate, targetDate, elapsedDays, remainingDays, linkedItemCount, linkedItemsCompleteCount, totalCostCents, budgetCents, budgetDifferenceCents. Build detail page includes Summary section (right column) via `BuildSummarySection` component; shows status, progress bar, initial/due dates, elapsed/remaining, linked items complete count, budget/spend/difference. Unit tests: `web/src/components/builds/BuildSummarySection.test.tsx`. Element breakdown (to buy / to make with sub-states) deferred until buildItemLinks has type/status (FEATURES_CANONICAL §3). Mobile: not yet (optional follow-up).

### Build project notes dedicated (15)

- **Status:** IMPLEMENTED (web). build.notes field in schema; convex/builds.ts update mutation accepts notes. Web: build detail page has "Notes" button (description icon) opening BuildNotesModal (web/src/components/builds/BuildNotesModal.tsx); user can edit, save, clear notes; content persisted via api.builds.update. Unit tests: web/src/components/builds/BuildNotesModal.test.tsx. Mobile: no dedicated Notes screen yet (PARTIAL).

### Build reference images (16)

- **Status:** IMPLEMENTED (web). Convex table buildReferenceImages; convex/buildReferenceImages.ts (listByBuild, add, remove, reorder); web BuildReferenceImagesSection (ImageUpload + ImageGallery with onRemove/onReorder); build detail left column; URL resolution via ResolveBuildImageUrl + files.getUrl. Unit tests: BuildReferenceImagesSection.test.tsx. Mobile: not yet.

### Build process pictures (17)

- **Status:** IMPLEMENTED (web). Convex table buildProcessPictures; convex/buildProcessPictures.ts (listByBuild, add, remove, reorder); web BuildProcessPicturesSection (ImageUpload + ImageGallery); build detail left column. Unit tests: BuildProcessPicturesSection.test.tsx. Mobile: not yet.

### Build list search/filter/sort (18)

- **Status:** IMPLEMENTED. Backend: convex/builds.ts list query accepts optional status, search, sortBy (name | progress | targetDate | budget), order (asc | desc); uses by_userId_status when status provided; in-memory search and sort. Frontend: web/src/app/builds/page.tsx has search input, sort dropdown, order toggle; status tabs (current/archived/planning/completed) drive API filter; web/src/lib/buildsListArgs.ts builds query args. Tests: web/src/app/builds/page.test.tsx (Vitest) unit tests for statusForTab and buildListArgs. Mobile: not yet wired to same list args (optional follow-up).

### i18n (19)

- **Status:** IMPLEMENTED (web). No backend or DB; locale is client-only (localStorage).
- **Web:** next-intl; web/messages/en.json, web/messages/es.json; web/src/lib/i18n/locale.ts (getStoredLocale, setStoredLocale, SUPPORTED_LOCALES); web/src/lib/i18n/context.tsx (LocaleContext, useLocaleContext); web/src/components/LocaleProvider.tsx (NextIntlClientProvider + locale state); root layout wraps with LocaleProvider. Settings page uses useTranslations("Settings") and useTranslations("Language"); language selector (English / Español) in Settings under Profile & Identity; locale persisted in localStorage key kyarafit-locale.
- **Tests:** web/src/lib/i18n/locale.test.ts (getStoredLocale, setStoredLocale); web/src/app/settings/page.test.tsx (LocaleProvider wrapper, language selector buttons).
- **Optional (not in this PR):** About/Settings language credits and CTA to request language; mobile i18n; more screens translated.
