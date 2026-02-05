# Web: Sync Status Indicator

Add a UI component that shows sync state (syncing / synced / offline) and pending count so users have feedback. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: `getSyncPendingCount()` exists in [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts) but no UI uses it. NEXT_STEPS asks for a component showing sync state and pending count.
- **Target**: A small indicator (e.g. in header or footer) that shows: **Syncing** (when a sync is in progress), **Synced** (last sync succeeded, optional timestamp), **Offline** (when appropriate), and **pending count** (number of unsynced changes). Only show for users who have cloud sync (PREMIUM_BASIC+); hide or show "Upgrade to sync" for FREE users if desired.

---

## Prerequisites

- [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts): `runSync`, `getSyncPendingCount()`, and `setupSyncTriggers` exist.
- Sync is wired (see [WEB_SYNC_WIRING.md](WEB_SYNC_WIRING.md)); optional but recommended so the indicator reflects real sync activity.
- `useFeatureAccess()`: `canUseCloudSync` to show/hide the indicator for FREE vs premium.

---

## Step 1: Add sync state (syncing / synced / error) to sync service or context

**What to do**

- Either (A) extend the sync service to expose current state (e.g. "idle" | "syncing" | "synced" | "error") and optionally last sync time, and a way to subscribe (e.g. callback or event), or (B) create a small React context that holds sync status and is updated when sync starts/completes/fails.
- When `runSync` is called, set state to "syncing"; when it resolves successfully, set to "synced" (and optionally store lastSyncAt); when it fails, set to "error". Expose pending count via existing `getSyncPendingCount()` (may need to be called periodically or after sync completes to update UI).
- If using context: provide `status`, `pendingCount`, and optionally `lastSyncAt`. Update pending count after each sync run (re-fetch getSyncPendingCount) or on an interval.

**Files to touch**

- [web/src/lib/services/sync.ts](web/src/lib/services/sync.ts) (add state/callbacks) and/or new file e.g. `web/src/lib/contexts/SyncStatusContext.tsx`.

**Cursor prompt**

```
In the Kyarafit web app, add sync status state for the UI: (1) Either in web/src/lib/services/sync.ts or in a new SyncStatusContext, expose current state: "idle" | "syncing" | "synced" | "error", and optionally lastSyncAt. (2) When runSync is invoked, set state to "syncing"; on success set "synced" and lastSyncAt; on failure set "error". (3) Expose getSyncPendingCount() so the UI can show pending count; either call it after sync completes and expose the value, or provide a function the UI can call. If using context, create web/src/lib/contexts/SyncStatusContext.tsx with provider that wraps sync triggers and exposes status, pendingCount, lastSyncAt. Keep existing sync API; only add state/callbacks or context.
```

---

## Step 2: Build SyncStatusIndicator component

**What to do**

- Create a client component `SyncStatusIndicator` that:
  - Uses the sync status (from context or from a hook that reads the state added in Step 1).
  - Uses `useFeatureAccess().canUseCloudSync`; if false, render nothing or a short "Upgrade to sync" text/link.
  - Renders a compact indicator: icon + short label. Examples: "Syncing…", "Synced", "Offline", "3 pending". Use existing design tokens (e.g. meta-label, small text). Optional: show last sync time on hover or next to "Synced".
  - For "pending" count, use the value from getSyncPendingCount (or from context). Update it when sync status changes or on a short interval (e.g. every 10s) while status is synced.

**Files to touch**

- New file, e.g. `web/src/components/SyncStatusIndicator.tsx` or `web/src/components/layout/SyncStatusIndicator.tsx`.

**Cursor prompt**

```
In the Kyarafit web app, create a SyncStatusIndicator component: (1) Read sync status (syncing / synced / error) and pending count from the sync context or hook added for sync status. (2) If useFeatureAccess().canUseCloudSync is false, render nothing or a short "Upgrade to sync" link. (3) Otherwise show a compact indicator: icon + label for "Syncing…", "Synced", "Offline", or "X pending" using existing design tokens. (4) Optionally show lastSyncAt next to "Synced". Place the component in web/src/components/ or web/src/components/layout/. Use "use client" and match the app's typography (e.g. meta-label, small text).
```

---

## Step 3: Place the indicator in the UI

**What to do**

- Add the SyncStatusIndicator to a visible spot: e.g. header (builds, closet, or global header), or footer, or settings. Avoid cluttering small screens; consider a single icon that expands or shows tooltip with status and pending count.

**Files to touch**

- Layout or a shared header component (e.g. [web/src/components/layout/BottomNav.tsx](web/src/components/layout/BottomNav.tsx) or a top bar, or [web/src/app/layout.tsx](web/src/app/layout.tsx)).

**Cursor prompt**

```
In the Kyarafit web app, add SyncStatusIndicator to the UI: place it in the global layout or in a shared header so it is visible on main screens (e.g. builds, closet). Prefer a compact placement (e.g. top-right of header or next to nav). Ensure it only renders when the sync status context/provider is available. Run npm run build and verify the indicator appears for premium users and shows syncing/synced/pending as appropriate.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Add sync state (syncing/synced/error) and expose pending count (context or sync service). |
| 2 | Build SyncStatusIndicator component (icon + label, hide for FREE or show upgrade). |
| 3 | Place indicator in layout or shared header. |
