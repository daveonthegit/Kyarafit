# Documentation and Setup Updates

Update **IMPLEMENTATION_STATUS**, **SUPABASE_TODO**, and other docs so they reflect the current state and guide new contributors. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **IMPLEMENTATION_STATUS.md**: "Next Steps" still lists completed items (file upload UI, IndexedDB, sync service); update or remove that section.
- **SUPABASE_TODO.md**: Migration checklist stops at 006; add 007, 008, 009.
- **NEXT_STEPS / docs**: README, architecture diagram, tier restrictions, developer guide, API docs — update or add as needed.

---

## Prerequisites

- [docs/implementation/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [docs/implementation/SUPABASE_TODO.md](SUPABASE_TODO.md) (or [docs/setup/SUPABASE_TODO.md](../setup/SUPABASE_TODO.md) if path differs)
- [docs/implementation/NEXT_STEPS.md](NEXT_STEPS.md)
- Migrations 007, 008, 009 in backend/migrations/

---

## Step 1: IMPLEMENTATION_STATUS — fix "Next Steps" section

**What to do**

- Open [docs/implementation/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Find the "Next Steps" or "Immediate (Essential for MVP)" section that lists "Build file upload UI", "Set up web IndexedDB", "Create web sync service". Remove those items (they are done) or replace with the actual remaining work (e.g. "Wire sync in app", "Add closet/convention repos and full sync", "Settings and subscription UI"). Keep the document accurate so new readers see what is done vs pending.

**Files to touch**

- docs/implementation/IMPLEMENTATION_STATUS.md

**Cursor prompt**

```
In docs/implementation/IMPLEMENTATION_STATUS.md, update the Next Steps section: remove or rewrite any bullets that say 'Build file upload UI', 'Set up web IndexedDB', 'Create web sync service' (these are completed). Replace with a short list of actual remaining work from the final implementation plan (e.g. wire sync in app, full web repos and sync, settings and subscription, etc.). Keep the rest of the doc unchanged. No code changes.
```

---

## Step 2: SUPABASE_TODO — add migrations 007, 008, 009

**What to do**

- Open the Supabase TODO doc: [docs/implementation/SUPABASE_TODO.md](SUPABASE_TODO.md). In the migration checklist, add entries for 007_supabase_storage_setup, 008_enhanced_user_sync, 009_convention_images_and_sync with short descriptions (storage bucket, user sync columns, convention image_url and sync triggers). Mark as optional or required as appropriate.

**Files to touch**

- docs/implementation/SUPABASE_TODO.md or docs/setup/SUPABASE_TODO.md

**Cursor prompt**

```
In docs/implementation/SUPABASE_TODO.md, add migrations 007, 008, 009 to the migration checklist: 007_supabase_storage_setup (storage bucket for images), 008_enhanced_user_sync (user sync columns), 009_convention_images_and_sync (convention image_url and updated_at triggers). Add one line each with file name and brief description. No code changes.
```

---

## Step 3: README — mention new features and setup

**What to do**

- Update the project README to mention key features (builds with images, closet, conventions, sync, tiers, subscription) and point to implementation docs and setup guides (IndexedDB/sync, Supabase, Stripe) where relevant. Keep it concise.

**Files to touch**

- README.md (project root)

**Cursor prompt**

```
Update the project README.md: add or adjust a short section on features (builds with images, closet, conventions, sync, tiers, subscription) and link to docs/implementation/ and docs/setup/ for setup (Supabase, migrations, Stripe). Keep the README concise. No code changes.
```

---

## Step 4: Architecture diagram and tier docs (optional)

**What to do**

- Add or update a simple architecture diagram (e.g. in docs/architecture.md or docs/implementation/) showing web, mobile, backend, Supabase, Stripe, and sync flow. Add a short tier-restrictions table (FREE vs PREMIUM_BASIC vs PREMIUM_PRO) in a doc (e.g. IMPLEMENTATION_STATUS or a new docs/tiers.md).

**Files to touch**

- docs/architecture.md or docs/implementation/; optionally docs/tiers.md

**Cursor prompt**

```
In docs/architecture.md (or docs/implementation/), add or update a simple architecture diagram: services (web, mobile, backend, Supabase, Stripe) and data flow (sync, upload). Use text or Mermaid. Optionally add a short tier table (FREE, PREMIUM_BASIC, PREMIUM_PRO) with limits (builds, storage, sync) in IMPLEMENTATION_STATUS or docs/tiers.md. No code changes.
```

---

## Step 5: API docs (optional)

**What to do**

- Document the main API endpoints (builds, closet, conventions, sync pull, upload, subscription) in docs/api/ or in the existing API doc. Include method, path, auth, and brief request/response. Can be a single markdown file.

**Files to touch**

- docs/api/ or existing API documentation

**Cursor prompt**

```
Add or update API documentation: list main endpoints (GET/POST builds, closet, conventions, GET sync/pull, POST upload/image, POST subscription/checkout or portal) with method, path, auth requirement, and brief request/response. Place in docs/api/ or existing API doc. No code changes.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | IMPLEMENTATION_STATUS: fix Next Steps (remove completed, list remaining). |
| 2 | SUPABASE_TODO: add migrations 007, 008, 009. |
| 3 | README: features and links to implementation/setup. |
| 4 | Optional: architecture diagram and tier table. |
| 5 | Optional: API endpoint list. |
