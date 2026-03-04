# Documentation and Setup Updates

Keep **IMPLEMENTATION_STATUS**, **NEXT_STEPS**, and other docs aligned with the **Convex + Better Auth** stack so they reflect the current state and guide new contributors.

**Current state (post-migration)**: IMPLEMENTATION_STATUS and NEXT_STEPS have been updated for Convex. Supabase/Go setup docs are deprecated or marked legacy. Use the steps below when you add features or change the stack.

---

## Goal

- **IMPLEMENTATION_STATUS.md**: Keep "Completed" and "Remaining" accurate for Convex (no Go API, no web IndexedDB sync).
- **SUPABASE_TODO.md**: Deprecated; project uses Convex. Do not add new Supabase migration steps.
- **NEXT_STEPS / docs**: README, architecture, API docs, DEVELOPMENT — point to Convex and Better Auth; mark legacy Supabase/Go references.

---

## Prerequisites

- [docs/implementation/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [docs/implementation/NEXT_STEPS.md](NEXT_STEPS.md)
- [docs/MIGRATION.md](../MIGRATION.md) — Convex migration summary

---

## Step 1: IMPLEMENTATION_STATUS — keep current

**What to do**

- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) is updated for Convex. When you add features, add them under "Remaining" or move to "Completed" as appropriate. Do not reintroduce Go API, IndexedDB sync, or Supabase as the active stack.

---

## Step 2: (Supabase TODO — deprecated)

Supabase and Go backend are no longer used. SUPABASE_TODO.md is deprecated. Do not add new Supabase migration steps.

---

## Step 3: README — mention features and setup

**What to do**

- Update the project README to mention key features (builds, closet, conventions, Convex, Better Auth) and point to implementation docs and setup (Convex dashboard, OAuth, optional Stripe when implemented). Keep it concise.

**Files to touch**

- README.md (project root)

**Cursor prompt**

```
Update the project README.md: add or adjust a short section on features (builds with images, closet, conventions, sync, tiers, subscription) and link to docs/implementation/ and docs/setup/ for setup (Supabase, migrations, Stripe). Keep the README concise. No code changes.
```

---

## Step 4: Architecture and tiers (optional)

**What to do**

- [architecture.md](../architecture.md) is updated for Convex + Better Auth. When you add tiers (e.g. Stripe), add a tier-restrictions table to IMPLEMENTATION_STATUS or docs/tiers.md.

---

## Step 5: API docs

**What to do**

- Current API is **Convex** (queries/mutations). See [api_overview.md](../api/api_overview.md) and [CONTEXT.md](../CONTEXT.md). The Go REST API is documented in [API_DOCUMENTATION.md](../api/API_DOCUMENTATION.md) as legacy only.

---

## Summary

| Step | Action                                                                     |
| ---- | -------------------------------------------------------------------------- |
| 1    | IMPLEMENTATION_STATUS: keep accurate for Convex (done vs remaining).      |
| 2    | SUPABASE_TODO: deprecated; do not add Supabase steps.                     |
| 3    | README: features and links to Convex + Better Auth setup.                |
| 4    | Optional: tier table when subscription exists.                            |
| 5    | API: Convex in api_overview + CONTEXT; Go API doc is legacy.                |
