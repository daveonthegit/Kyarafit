# Seed Data Implementation (Convex)

**Purpose:** Provide optional first-time user seed data (e.g. one build, one convention, one closet item linked to the build) so new users see non-empty closet and build flows. Implemented in Convex only (no Go endpoint).

**Scope:** In: Convex mutation or dashboard script that creates seed data once per user. Out: Go backend, POST /api/seed, device-id semantics.

**Current state:**

- No Convex seed mutation or script exists. Old Go `POST /api/seed` and `backend/internal/seed/` are archived; web and mobile do not call them.
- Schema: [convex/schema.ts](convex/schema.ts) — users, closetItems, builds, buildItemLinks, buildTasks, conventions, conventionDayPlans, packingListItems all have userId.
- Auth: `getIdentity()` in Convex gives userId for the current user.

**Next steps:**

1. **Convex mutation:** Add e.g. `convex/seed.ts` with a mutation `createStarter` (or similar) that:
   - Reads identity via `ctx.auth.getUserIdentity()`; if no user, return or throw.
   - Checks if user already has any builds (query builds by userId); if count > 0, return without creating (idempotent).
   - Creates one build (name e.g. "My First Build", status "wip", optional image from placeholder or skip if image required later), one convention (name e.g. "My First Convention", startDate/endDate), one closet item (e.g. "Sample Wig"), links closet item to build via buildItemLinks, optionally creates a few buildTasks for the build.
   - Returns created ids or success.
2. **Call site:** Frontend (web/mobile) can call this mutation once after first sign-in (e.g. from a "Get started" screen or when builds list is empty and user clicks "Add sample data"). Alternatively run from Convex dashboard as a one-off script.
3. **Design-system / types:** Use existing Convex types; no design-system schema change required for seed.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Seed data), [convex/schema.ts](convex/schema.ts), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
