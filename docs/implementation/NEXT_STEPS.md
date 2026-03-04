# Next Steps: Post–Convex Migration

**Context**: The app has migrated from Supabase + Go Fiber to **Convex** (backend, DB, file storage) and **Better Auth** (OAuth + email/password). Web and mobile use Convex when signed in; mobile keeps local SQLite and syncs via `useConvexSync` / `convexSync.ts`.  
**Last Updated**: 2026-03-04

---

## Immediate / High Priority

1. **Documentation alignment**  
   Ensure all docs reflect Convex + Better Auth. Update or deprecate Supabase/Go-era setup (QUICKSTART_SUPABASE, SUPABASE_TODO, API_DOCUMENTATION for Go, etc.). See [DOCS_AND_SETUP_UPDATES.md](DOCS_AND_SETUP_UPDATES.md).

2. **Run local CI**  
   Before pushing, run `make validate` (or `npm run validate`) and fix any failures. See [CI_LOCAL.md](../../CI_LOCAL.md).

3. **Mobile offline/signed-out experience**  
   Confirm flows (closet, builds, conventions, packing) work clearly when offline or signed out (SQLite-only). Add or refine “Sign in to sync” and any pending-sync indicators if needed.

4. **Feature parity**  
   Use [IMPLEMENTATION_GUIDES_INDEX.md](IMPLEMENTATION_GUIDES_INDEX.md) and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) to close gaps (e.g. image upload on all relevant forms, task–closet assignment, planner view, settings).

---

## Integration / Product

5. **Tiers and subscription**  
   No tier system in Convex yet. When ready, implement via [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md) (Stripe webhook, Checkout/Portal) and enforce limits in Convex (or auth metadata).

6. **Settings and account**  
   Account details, subscription plan, notification preferences. See [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md).

7. **Seed data (optional)**  
   If you want “first-time user” seed data (e.g. sample build/convention), implement it in Convex (e.g. a mutation or dashboard script). The old Go `POST /api/seed` is no longer used.

---

## Testing and Deployment

8. **Testing**  
   Use [TESTING_AND_DEPLOYMENT.md](TESTING_AND_DEPLOYMENT.md) for checklists. Verify auth (email + OAuth), Convex CRUD, file upload, and mobile Convex↔SQLite sync.

9. **Deployment**  
   - Convex: `npx convex deploy` (or CI). Set env vars in Convex dashboard (BETTER_AUTH_SECRET, OAuth credentials, RESEND for email, etc.).  
   - Web: e.g. GCP Cloud Run; see [GCP_DEPLOYMENT.md](../GCP_DEPLOYMENT.md) (update any Supabase/Go references to Convex where applicable).  
   - Ensure CORS and Better Auth trusted origins include production URLs (see [auth.md](../auth.md)).

---

## What Not To Do (Obsolete After Migration)

- **Do not** implement web IndexedDB repos or a web sync service that talks to the Go backend — web uses Convex only.
- **Do not** wire “sync status” to the old `sync.ts` or Go sync/pull — those are removed.
- **Do not** add new features against the Go API or Supabase — all new work is Convex + Better Auth.
- **Do not** use `EXPO_PUBLIC_API_URL` or Go backend URLs for app features; mobile uses Convex (and local SQLite).

---

## References

- [MIGRATION.md](../MIGRATION.md) — Supabase/Go → Convex migration summary  
- [auth.md](../auth.md) — Better Auth setup, CORS, trusted origins  
- [CONTEXT.md](../CONTEXT.md) — Data model and Convex function reference  
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) — Current status and remaining work
