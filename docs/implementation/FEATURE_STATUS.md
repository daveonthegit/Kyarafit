# Feature Status

Audit of each canonical feature: IMPLEMENTED / PARTIAL / NOT IMPLEMENTED, with evidence (file paths). Last updated: 2026-03-04.

---

## Summary Table

| Feature              | Backend     | Frontend (web) | Frontend (mobile) | DB          | Infra | Tests            | Status          | Evidence                                                                                                                                |
| -------------------- | ----------- | -------------- | ----------------- | ----------- | ----- | ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                 | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | Yes   | PARTIAL (manual) | IMPLEMENTED     | convex/betterAuth/, convex/http.ts, web/src/lib/auth/, web/src/app/auth/, mobile/src/lib/auth/, mobile/app/\_layout.tsx                 |
| Closet               | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | convex/closetItems.ts, web/src/app/closet/, web/src/app/add-item/, mobile (tabs + Convex)                                               |
| Builds               | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | convex/builds.ts, web/src/app/builds/, web/src/app/build-detail/, mobile app                                                            |
| Build tasks          | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | convex/buildTasks.ts, web/src/components/builds/TaskChecklist.tsx, web/src/app/build-detail/page.tsx                                    |
| Conventions          | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | convex/conventions.ts, web/src/app/conventions/, mobile                                                                                 |
| Itinerary            | IMPLEMENTED | PARTIAL        | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL         | convex/conventions.ts (day plans), web/src/app/itinerary/page.tsx (stub or basic)                                                       |
| Packing list         | IMPLEMENTED | IMPLEMENTED    | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | convex/conventions.ts (packingListItems), web/src/app/conventions/[id]/packing/page.tsx                                                 |
| Planner              | IMPLEMENTED | PARTIAL        | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL         | convex/buildTasks.ts, web/src/app/planner/page.tsx (Daily/Conventions toggle; tasks not fully wired)                                    |
| Settings             | N/A         | PARTIAL        | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL         | web/src/app/settings/page.tsx (labels only; no subpages), Convex users (tier fields)                                                    |
| Tiers / subscription | PARTIAL     | PARTIAL        | PARTIAL           | IMPLEMENTED | NOT   | NOT              | PARTIAL         | convex/schema.ts (users.tier, stripe\*), web/src/lib/api/useTier.ts (hardcoded FREE); no Stripe webhook/Checkout                        |
| Mobile offline/sync  | IMPLEMENTED | N/A            | IMPLEMENTED       | IMPLEMENTED | —     | NOT              | IMPLEMENTED     | mobile/src/storage/, mobile/src/hooks/useConvexSync.ts, mobile/src/services/convexSync.ts                                               |
| Image upload         | IMPLEMENTED | PARTIAL        | PARTIAL           | IMPLEMENTED | —     | NOT              | PARTIAL         | convex/files.ts, web ImageUpload in builds + closet/new; convention new has no image field; mobile may not use Convex upload everywhere |
| Seed data            | NOT         | NOT            | NOT               | —           | —     | NOT              | NOT IMPLEMENTED | No Convex seed mutation or script                                                                                                       |

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
- **Web:** web/src/app/conventions/page.tsx, web/src/app/conventions/new/page.tsx, web/src/app/conventions/[id]/page.tsx, web/src/app/conventions/[id]/packing/page.tsx. Convention new has no image field (PARTIAL for image).

### Itinerary

- **Backend:** Day plans and packing in convex/conventions.ts; builds/buildTasks available for status.
- **Web:** web/src/app/itinerary/page.tsx exists; may be stub ("Assign a build from your convention plan") or basic; full day-by-day build cards and countdown may be PARTIAL.

### Packing list

- **Backend:** packingListItems in convex/conventions.ts (list, update, add manual, regenerate).
- **Web:** web/src/app/conventions/[id]/packing/page.tsx with ChecklistRow, regenerate; essentials and by-date grouping.

### Planner

- **Backend:** buildTasks.listByBuild (and builds, convention day plans for due dates).
- **Web:** web/src/app/planner/page.tsx has Daily/Conventions toggle; Conventions lists conventions with Itinerary/Packing links; tasks not fully loaded from builds or grouped by deadline (PARTIAL).

### Settings

- **Web:** web/src/app/settings/page.tsx shows tier/storage (useTier) and labels (Account Details, Subscription Plan, Notification Style) with no destination routes or forms.
- **DB:** users table has tier, currentUsageMb, stripeCustomerId, etc.; useTier hardcodes FREE (no Convex users.getMe for tier yet).

### Tiers / subscription

- **Backend:** Schema has tier and Stripe fields; no Stripe webhook or Checkout/Portal implementation.
- **Frontend:** web/src/lib/api/useTier.ts returns hardcoded FREE; useFeatureAccess() derives gates from that. No UpgradePrompt/FeatureGate component in UI yet.

### Mobile offline/sync

- **Mobile:** mobile/src/storage/ (SQLite repos); mobile/src/hooks/useConvexSync.ts; mobile/src/services/convexSync.ts; Convex ↔ SQLite sync when signed in.

### Image upload

- **Backend:** convex/files.ts (generateUploadUrl, getUrl).
- **Web:** web/src/components/ui/ImageUpload.tsx uses Convex; used in web/src/app/builds/new/page.tsx, web/src/app/build-detail/page.tsx, web/src/app/closet/new/page.tsx. Convention new page has no image field (PARTIAL).
- **Mobile:** May use Convex upload in some flows; parity with web (closet, convention image) may be PARTIAL.

### Seed data

- **Backend:** No Convex mutation or dashboard script; old Go seed endpoint removed.
- **Frontend:** None.
