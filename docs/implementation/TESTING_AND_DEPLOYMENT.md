# Testing and Deployment

**Purpose:** Checklists to verify Convex + web + mobile flows and deployment preparation. No Go backend or Supabase; Convex and Better Auth only.

**Scope:** In: Manual and automated testing of auth, Convex CRUD, file upload, mobile Convex↔SQLite sync; deployment steps for Convex, web (e.g. Vercel), mobile. Out: Go backend tests, IndexedDB sync tests, Supabase migrations.

**Current state:**

- **CI:** [.github/workflows/ci.yml](.github/workflows/ci.yml) — web (lint, typecheck, test), mobile (lint, typecheck), security scan. No Go or Supabase. Local: `npm run validate` or `npm run ci` / `npm run ci:win` (see [CI_LOCAL.md](../../CI_LOCAL.md)).
- **Tests:** Web and mobile have placeholder "No tests yet"; image-service has pytest. Convex has no automated tests in repo.
- **Deploy:** Convex: `npx convex deploy`; env in Convex dashboard (BETTER_AUTH_SECRET, OAuth, RESEND, etc.). Web: Vercel (per CI). Mobile: EAS build/submit.

**Next steps (checklists):**

1. **Auth:** Sign up (email+password), verify email (if enabled), sign in; OAuth (Google, optional GitHub); sign out; password reset. Check CORS and trusted origins for app origin (docs/auth.md).
2. **Convex CRUD:** Create/read/update/delete closet item, build, build task, convention, day plan, packing item. Verify ownership (userId) and real-time updates.
3. **File upload:** Build create with image (generateUploadUrl → upload → getUrl → create with imageUrl/imageStorageId); closet and convention create with image where implemented.
4. **Mobile sync:** Sign in on mobile; create/update data; confirm Convex and SQLite in sync; sign out or go offline; confirm local SQLite still works; "Sign in to sync" or pending indicator if implemented.
5. **Deployment:** Convex env vars set; web deploy (Vercel) with NEXT_PUBLIC_CONVEX_URL and Convex site URL; production URLs in CORS and Better Auth trusted origins; mobile EAS config and env if needed.
6. **Optional:** Add Convex function tests (e.g. Convex testing utilities); add web component or e2e tests; document in [rules/testing-patterns.mdc](../../rules/testing-patterns.mdc).

**Links:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [NEXT_STEPS.md](NEXT_STEPS.md), [docs/auth.md](../auth.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md), [rules/ci-cd-patterns.mdc](../../rules/ci-cd-patterns.mdc).
