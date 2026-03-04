# Canonical Feature List

Source of truth for product features, acceptance criteria, and dependencies. Aligned with Convex + Better Auth stack. **Competitor-informed:** Missing or partial features from [Competitor Analysis & Implementation Plan](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) are included below (build elements ≈ closet items + type/status, build list search/filter/sort, summary dashboard, completion validation, reference/process images, task reminders, project notes, About, engagement, etc.). Last updated: 2026-03-04.

---

## 1. Auth

**Description:** Sign-in and sign-up (email+password, Google, GitHub); session persistence via bearer token; route protection (AuthGate); verify email and reset password flows.

**Acceptance criteria:**

- User can sign up with email+password and receive verification email (if enabled).
- User can sign in with email+password or OAuth (Google required, GitHub optional).
- Session persists across reloads (bearer token in localStorage on web, AsyncStorage on mobile).
- Protected routes redirect unauthenticated users (AuthGate).
- User can request password reset and complete it via email link.
- CORS and trusted origins are configured so auth works from app origin (see docs/auth.md).

**Dependencies:** Convex HTTP routes, Better Auth component, Convex dashboard env (BETTER_AUTH_SECRET, OAuth credentials).

**Notes:** Cross-origin: auth API on \*.convex.site, app on different origin; bearer token used instead of cookies. Keep allowedOrigins (http.ts) and trustedOrigins (betterAuth/auth.ts) in sync.

---

## 2. Closet

**Description:** CRUD for closet items (costume pieces); categories; image upload via Convex file storage; optional cost, tags, notes.

**Acceptance criteria:**

- User can list closet items (filtered by userId).
- User can create a closet item with name, category, optional tags, notes, cost, and image.
- User can update and delete closet items.
- Image is uploaded via Convex (generateUploadUrl → upload → getUrl); stored imageUrl/imageStorageId on item.
- Categories align with schema (e.g. wig, prop, armor, garment, shoe, material, other).

**Dependencies:** Convex schema (closetItems), Convex files API, auth (userId).

**Notes:** design-system types in design-system/types/ for ClosetItem if shared.

---

## 3. Builds

**Description:** CRUD for builds (cosplay projects); optional required-image enforcement; link closet items to build; status (idea/wip/ready); budget and target date.

**Acceptance criteria:**

- User can list builds (by userId; optional status filter).
- User can create a build with name, status, optional character, notes, image, budgetCents, targetDate.
- User can update and delete builds.
- User can link/unlink closet items to a build (buildItemLinks).
- Build list can show card layout with image, progress (from tasks), and status tabs (optional enhancement).
- Optionally: create/update requires non-empty imageUrl (enforcement in Convex mutation and/or frontend).
- **Build list discovery (competitor parity):** User can filter build list by status (e.g. All, Planning/Idea, In progress, Completed); optionally search by name/character; sort by name, progress, targetDate, budget, etc.; choose order (asc/desc).
- **Elements ≈ closet items (competitor parity):** Each build–closet link (and any inline “element”) has type (to buy / to make) and status (e.g. pending, bought, ongoing, made); user can add from closet or add inline element (name + type), reorder, and update status. Completion requires all elements ready (see completion validation below).
- **Completion validation (competitor parity):** User can mark build complete only when all elements (linked + inline) are in a “ready” state (e.g. bought for buy, made for make); otherwise show clear message (e.g. “All elements must be 100% ready”).

**Dependencies:** Convex schema (builds, buildItemLinks), auth, closetItems for linking.

**Notes:** Progress derived from buildTasks (checked/total). Builds list as cards + tabs is a UX enhancement per BUILDS_REQUIRE_IMAGE_AND_OVERVIEW. For elements design (extend buildItemLinks vs new table) see [Competitor Analysis](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) §5.

---

## 4. Build tasks

**Description:** CRUD for build tasks (checklist items); checked state; optional assignment to closet item; sort order.

**Acceptance criteria:**

- User can list tasks for a build (by buildId).
- User can create a task (label, sortOrder, checked default false).
- User can update a task (label, checked, sortOrder, optional closetItemId).
- User can delete a task.
- Build detail shows task checklist with progress (e.g. X of Y complete).
- Optionally: drag-drop or UI to assign a task to a closet item (closetItemId).
- **Task reminders (competitor parity):** User can set an optional reminder (date/time) per task; app notifies at that time (in-app and/or push when implemented).
- **Task notes/details (competitor parity):** Task can have an optional notes or details field (in addition to label) for longer description.

**Dependencies:** Convex schema (buildTasks), auth, builds.

**Notes:** TaskChecklist component on build detail; Convex api.buildTasks.listByBuild, create, update, remove.

---

## 5. Conventions

**Description:** CRUD for conventions (events); day plans (date → buildId); packing list items; convention image upload.

**Acceptance criteria:**

- User can list conventions (by userId).
- User can create/update/delete a convention (name, location, startDate, endDate, optional image).
- User can manage convention day plan: set which build is assigned to which date (conventionDayPlans).
- User can list and update packing list items for a convention (packingListItems: label, checked, optional date, buildId, closetItemId).
- Image uploaded via Convex file storage.

**Dependencies:** Convex schema (conventions, conventionDayPlans, packingListItems), auth, builds.

**Notes:** Packing list can be regenerated from day plan or edited manually; add manual item supported.

---

## 6. Itinerary

**Description:** View convention itinerary: day-by-day build cards, task summary, countdown.

**Acceptance criteria:**

- User can select a convention and see itinerary view.
- Per-day: date label and assigned build (if any) with thumbnail, name, status (e.g. ready to pack, missing items).
- Countdown to convention start (or similar).
- Optional: sync/offline indicator, logistics section (if stored).

**Dependencies:** Conventions, convention day plans, builds, build tasks (for status), packing list (for item counts).

**Notes:** Itinerary page: web/src/app/itinerary/page.tsx; data from Convex queries.

---

## 7. Packing list

**Description:** Per-convention packing list with essentials, by-build sections, progress, search, add item, regenerate.

**Acceptance criteria:**

- User can open packing list for a convention.
- Total progress: X of Y items packed (progress bar / percentage).
- Essentials section: items not tied to a build (buildId null).
- By-build sections: expandable groups per build with sub-items and per-group progress.
- User can search/filter items by label.
- User can add manual item (to essentials or to a build).
- User can toggle checked on items (persisted via Convex).
- Optionally: regenerate list from convention day plan.

**Dependencies:** Convex packingListItems, conventionDayPlans, conventions, builds.

**Notes:** Packing page: web/src/app/conventions/[id]/packing/page.tsx.

---

## 8. Planner

**Description:** Cross-build task view; timeframe (today/week); progress summary; deadline-approaching and other tasks; task–build–convention links.

**Acceptance criteria:**

- User can see tasks across builds, optionally filtered by timeframe (e.g. today, this week).
- Progress summary: e.g. "X of Y tasks" with progress bar for selected timeframe.
- Section for deadline-approaching tasks (e.g. due today or soon); section for other tasks.
- Each task row: checkbox (maps to build task checked), label, build name (link to build detail), optional due date.
- Due date can come from convention day (build assigned to convention date) or explicit task field if added.
- User can add task (navigate to build detail or modal: pick build + label + optional due date).
- Navigation to wardrobe (closet), planner, events (conventions) available.

**Dependencies:** Build tasks, builds, convention day plans (for due-by-convention-day).

**Notes:** Planner page: web/src/app/planner/page.tsx; load tasks via Convex (all builds or convention-scoped).

---

## 9. Settings

**Description:** Account details, subscription plan, notification style; tier/usage display (useTier).

**Acceptance criteria:**

- Settings entry point (web and mobile) with menu items: Account Details, Subscription Plan, Notification Style, and optionally About, Privacy, Help.
- Account Details: show email, display name (from auth); link to change password or manage account (Better Auth / provider).
- Subscription Plan: show current tier and usage (from useTier / Convex users when wired); link to upgrade or manage subscription (when Stripe implemented).
- Notification Style: preferences (if implemented).
- Other menus: About, Privacy, Help have content or links.
- **About screen (competitor parity):** Dedicated About page/screen with app version, developer/credits, copyright; optionally language credits and link to request language.
- **App engagement (competitor parity):** Menu or settings entry for “Rate in App Store”, “Tell a friend” (share app), and “Comments and suggestions” (feedback channel — e.g. mailto or feedback form).
- **Theme / currency / thumbnail (competitor parity):** Optional user preferences for color/theme, display currency, and thumbnail size in lists/galleries; persisted and applied in UI.

**Dependencies:** Auth (session), Convex users (tier, currentUsageMb); Stripe for subscription flows when implemented.

**Notes:** useTier() currently hardcodes FREE; wire to Convex users.getMe when tier is in use.

---

## 10. Tiers / subscription

**Description:** Tier stored in Convex users; Stripe Checkout/Portal (not implemented); feature gates (useFeatureAccess); upgrade prompts in UI.

**Acceptance criteria:**

- User document has tier (e.g. FREE, PREMIUM_BASIC, PREMIUM_PRO) and optional Stripe fields (stripeCustomerId, subscriptionStatus, etc.).
- useFeatureAccess() derives canUseCloudSync, canExport, etc. from tier (currently from useTier; when implemented, from Convex users).
- Where features are gated (e.g. sync, export), show upgrade prompt (e.g. UpgradePrompt component) with message and link to settings/subscription.
- When implemented: Stripe webhook updates user tier/subscription; Checkout and Customer Portal URLs available for upgrade/manage.

**Dependencies:** Convex users schema, Stripe (webhook, Checkout, Portal), env (Stripe keys in Convex or backend).

**Notes:** Web has no “sync” to gate (Convex only); “cloud sync” gate applies to mobile or future features. SUBSCRIPTION_SERVICE guide to be reframed for Convex.

---

## 11. Mobile offline / sync

**Description:** SQLite local storage; Convex→SQLite sync (useConvexSync); push local changes (convexSync.ts); clear signed-out/offline UX.

**Acceptance criteria:**

- When signed out or offline, mobile uses SQLite for closet, builds, conventions, packing (read/write).
- When signed in, Convex is source of truth; useConvexSync syncs Convex data into SQLite; convexSync pushes local changes to Convex.
- Flows (closet, builds, conventions, packing) work consistently offline and when signed out.
- "Sign in to sync" and any "pending sync" or conflict UX are clear and consistent.

**Dependencies:** Mobile storage (SQLite repos), useConvexSync, convexSync.ts, Convex mutations for push.

**Notes:** No web equivalent (web uses Convex only, no IndexedDB sync).

---

## 12. Image upload

**Description:** Convex file storage (generateUploadUrl, getUrl); ImageUpload component on web; mobile parity using same Convex API.

**Acceptance criteria:**

- Client calls Convex mutation to get upload URL (e.g. api.files.generateUploadUrl).
- Client uploads file to returned URL (Convex storage).
- Client gets public URL via api.files.getUrl(storageId) and stores imageUrl (and optionally imageStorageId) on entity (build, closet item, convention).
- Web: ImageUpload component used in build create/edit, closet new/edit, convention new/edit where image is supported.
- Mobile: same flow (Convex upload) for build, closet item, convention creation/edit.

**Dependencies:** Convex files.ts, auth (user can upload), entity mutations accept imageUrl/imageStorageId.

**Notes:** Optional: external image service (e.g. rembg) for background removal; app can call it before or after upload.

---

## 13. Seed data (optional)

**Description:** First-time user seed (e.g. one build, one convention, one closet item linked to build) via Convex mutation or dashboard script.

**Acceptance criteria:**

- When desired, new user or new device can receive seed data (one build, one convention, one closet item linked to that build).
- Seed runs once (e.g. mutation checks "has any build" and skips if true).
- Implemented as Convex mutation or dashboard script (no Go endpoint).

**Dependencies:** Convex schema (builds, conventions, closetItems, buildItemLinks, buildTasks optional), auth (userId).

**Notes:** SEED_DATA_IMPLEMENTATION guide reframed for Convex; no POST /api/seed.

---

## 14. Build summary dashboard (competitor parity)

**Description:** Per-build summary view: status, progress %, dates (initial, due, elapsed, remaining), element counts (to buy / to make with sub-states), optional developing time, budget, total spend, difference. Optional share/export.

**Acceptance criteria:**

- User can open a Summary view for a build (tab or section on build detail).
- Summary shows: build status, progress % (and bar), initial date, due date, elapsed time, remaining time; elements to buy (bought/pending/total), to make (made/ongoing/total), total elements; optional developing time, budget, total spend, difference (budget − spend).
- Data is derived from build, buildItemLinks (with type/status), buildTasks; optional future tables for time/spend if added.
- Optionally: Share/export summary (native share or export).

**Dependencies:** Builds, buildItemLinks (with type/status), buildTasks; optional time/spend tracking.

**Notes:** See [Competitor Analysis](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) §5 (Summary dashboard).

---

## 15. Build project notes (dedicated) (competitor parity)

**Description:** Dedicated Notes screen or modal for a build (in addition to optional notes field on build).

**Acceptance criteria:**

- User can open “Notes” for a build from build detail (button or tab).
- Notes screen/modal shows editable content tied to the build (e.g. build.notes or dedicated notes document); user can create, edit, and delete notes.
- Content persists (e.g. via build update or dedicated notes table).

**Dependencies:** Builds (existing notes field or new store).

**Notes:** Build already has optional `notes` string; this feature adds a dedicated UI for editing it (or a richer notes entity).

---

## 16. Build reference images (competitor parity)

**Description:** Per-build gallery of reference images (character/source reference pictures).

**Acceptance criteria:**

- User can add reference images to a build (upload via Convex file storage).
- User can view and reorder reference images on build detail (tab or section).
- User can remove a reference image.
- Images are stored per build (e.g. buildReferenceImages table or equivalent).

**Dependencies:** Convex schema (e.g. buildReferenceImages), Convex files API, auth, builds.

**Notes:** See [Competitor Analysis](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) §5.

---

## 17. Build process pictures (competitor parity)

**Description:** Per-build gallery of process pictures (photos of the making process).

**Acceptance criteria:**

- User can add process pictures to a build (upload via Convex file storage).
- User can view and reorder process pictures on build detail (tab or section).
- User can remove a process picture.
- Images are stored per build (e.g. buildProcessPictures table or equivalent).

**Dependencies:** Convex schema (e.g. buildProcessPictures), Convex files API, auth, builds.

**Notes:** Same pattern as reference images; see [Competitor Analysis](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) §5.

---

## 18. Build list search, filter, and sort (competitor parity)

**Description:** Build list supports search by name/character, filter by status, and sort by multiple criteria with ascending/descending order.

**Acceptance criteria:**

- User can search the build list by name or character (optional search input; list filters as user types or on submit).
- User can filter the list by status (e.g. All, Idea/Planning, WIP/In progress, Ready/Completed) via tabs or dropdown.
- User can choose sort by (e.g. name, progress %, target date, budget) and order (ascending/descending).
- Backend list query accepts optional search, status, sortBy, and order parameters; results are filtered and sorted accordingly.

**Dependencies:** Convex builds.list (extend args), builds schema and indexes.

**Notes:** Overlaps with Builds §3 acceptance criteria; this section makes the discovery behavior explicit. See [Competitor Analysis](../competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) §4–5.

---

## 19. Internationalization (i18n) (competitor parity, optional)

**Description:** App supports multiple languages; user can switch language; optional language credits and CTA to request a language.

**Acceptance criteria:**

- App UI (or key screens) can be shown in more than one language (e.g. via i18n library and locale selection).
- User can select preferred language (e.g. in settings or on first run).
- Optional: About or Settings shows language credits (contributors per language) and link/CTA to request or contribute a new language.

**Dependencies:** i18n solution (e.g. next-intl, react-i18next); locale storage; translated strings or translation pipeline.

**Notes:** Competitor has language credits and “see app in your language” CTA; Tier 3 in competitor analysis.
