# Testing and Deployment

Execute the **testing checklists** from IMPLEMENTATION_STATUS and NEXT_STEPS and complete **deployment preparation** so MVP is verified and production-ready. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: Checklists in IMPLEMENTATION_STATUS and NEXT_STEPS (backend, frontend, integration) are unchecked. Deployment prep (env vars, migration 009, bucket policies, monitoring) is documented but not confirmed.
- **Target**: (1) Run through the testing checklists and mark or record results. (2) Confirm deployment steps (env, migrations, storage, monitoring) and document any gaps.

---

## Prerequisites

- [docs/implementation/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md): Testing checklist section.
- [docs/implementation/NEXT_STEPS.md](NEXT_STEPS.md): Testing and deployment sections.
- Backend, web, mobile, and any deployed environments (e.g. GCP, Fly).

---

## Step 1: Backend testing checklist

**What to do**

- Run the backend tests (unit/integration if any) and the manual backend checklist from IMPLEMENTATION_STATUS or NEXT_STEPS: image upload (valid/invalid file, quota), sync pull (correct data, timestamp filter), seed (creates once, does not duplicate). Record results (e.g. checkboxes in a copy of the doc or a TEST_RESULTS.md). Fix any failing tests.

**Files to touch**

- Test code if fixing; optionally docs/implementation/TEST_RESULTS.md or the checklist doc.

**Cursor prompt**

```
Run the backend testing checklist from docs/implementation/IMPLEMENTATION_STATUS.md or NEXT_STEPS.md: (1) Run any backend unit/integration tests (go test ./...). (2) Manually verify: image upload (valid file, reject invalid size/type, quota), sync pull (returns data, respects since param), seed (creates on first device, skips when builds exist). (3) Document results in TEST_RESULTS.md or update the checklist with pass/fail. Fix any failing tests. No new features.
```

---

## Step 2: Frontend testing checklist

**What to do**

- Run the frontend/testing checklist: ImageUpload (file and URL), IndexedDB creation, builds repo CRUD, outbox enqueue, sync push/pull, TaskChecklist (or task UI), feature access hooks. Use the web app and optionally automated tests. Record results.

**Files to touch**

- Optional TEST_RESULTS.md or checklist doc; test files if fixing.

**Cursor prompt**

```
Run the frontend testing checklist: (1) Manually test ImageUpload (file + URL), builds list and detail, task create/update/delete, sync (if wired), feature gates. (2) If there are frontend tests (e.g. npm test in web), run them. (3) Document results. Fix any broken flows. No new features.
```

---

## Step 3: Integration testing checklist

**What to do**

- Run integration scenarios: FREE user can use web but not sync; PREMIUM user can sync; create on mobile → appears on web (and vice versa); conflict resolution; seed for new user; storage quotas. Record results. Fix critical issues.

**Files to touch**

- TEST_RESULTS.md or checklist; fix bugs only.

**Cursor prompt**

```
Run the integration testing checklist: FREE user (web, no sync), PREMIUM sync (create on mobile vs web, both directions), conflict resolution, seed for new device, storage quota enforcement. Document results. Fix critical bugs only. No new features.
```

---

## Step 4: Deployment preparation

**What to do**

- Confirm deployment docs (e.g. GCP*DEPLOYMENT, DEPLOYMENT_CHECKLIST): (1) Env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, STRIPE*\*, etc.) are documented and set in target environment. (2) Migration 009 (and 007, 008 if needed) has been run on production DB. (3) Supabase Storage bucket exists and policies (public read, authenticated write) are correct. (4) Monitoring: app_users.current_usage_mb or equivalent is tracked; alerts for failed sync or errors if desired. Update the deployment doc with a short "Verified" or "Checklist completed" section with date.

**Files to touch**

- docs/setup/DEPLOYMENT_CHECKLIST.md or GCP_DEPLOYMENT.md; env in deployment target (no secrets in repo).

**Cursor prompt**

```
Complete deployment preparation: (1) Ensure env vars (SUPABASE_*, JWT_SECRET, STRIPE_*, etc.) are documented in deployment docs and set in the target environment. (2) Confirm migration 009 (and 007, 008) has been run on production. (3) Confirm Supabase Storage bucket and policies. (4) Add a short 'Verified' or checklist-completed section to the deployment doc with date. Do not commit secrets. Optional: add a note on monitoring (e.g. usage_mb, sync errors).
```

---

## Summary

| Step | Action                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| 1    | Run backend tests and manual backend checklist; record results.                 |
| 2    | Run frontend tests and manual frontend checklist; record results.               |
| 3    | Run integration scenarios; record results; fix critical bugs.                   |
| 4    | Confirm deployment env, migrations, storage, monitoring; update deployment doc. |
