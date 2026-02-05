# Web: Feature Gates for FREE Users

Show **upgrade prompts** where features are gated by tier (e.g. cloud sync) so FREE users understand why a feature is unavailable and how to upgrade. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: `useFeatureAccess()` exists in [web/src/lib/api/useTier.ts](web/src/lib/api/useTier.ts) (e.g. canUseCloudSync, canExport) but no UI shows upgrade messaging for FREE users.
- **Target**: Where sync or other premium features are gated, show a short message (e.g. "Upgrade to Premium Basic to sync across devices") and optionally a link to settings or subscription.

---

## Prerequisites

- [web/src/lib/api/useTier.ts](web/src/lib/api/useTier.ts): `useFeatureAccess()` returns `canUseCloudSync`, `canExport`, etc.
- Settings or subscription page (or placeholder) where users can upgrade (see [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md) and [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md)).

---

## Step 1: Create a reusable UpgradePrompt or FeatureGate component

**What to do**

- Create a small component (e.g. `UpgradePrompt` or `FeatureGate`) that accepts a condition (e.g. `canUseFeature: boolean`), a short message (e.g. "Upgrade to Premium Basic to sync across devices"), and an optional link (e.g. to /settings or subscription). When `canUseFeature` is false, render the message and link; when true, render children or null. Use existing design tokens (e.g. meta-label, subtle background) so it fits the app.

**Files to touch**

- New file, e.g. `web/src/components/UpgradePrompt.tsx` or `web/src/components/FeatureGate.tsx`.

**Cursor prompt**

```
In the Kyarafit web app, create a reusable UpgradePrompt (or FeatureGate) component: (1) Props: canUseFeature (boolean), message (string), optional linkUrl and linkText. (2) When canUseFeature is false, render a compact banner or inline message with the text and optional link; when true, render children or null. (3) Use existing design tokens (e.g. meta-label, border, subtle background like yellow-50 or gray-100). (4) Place in web/src/components/. Run npm run build.
```

---

## Step 2: Add sync upgrade prompt where sync is relevant

**What to do**

- Identify places where sync is relevant: e.g. settings (storage/backup section), or a dedicated "Sync" section, or near the sync status indicator. Use `useFeatureAccess().canUseCloudSync`; when false, render the UpgradePrompt with message "Upgrade to Premium Basic to sync across devices" and link to settings or subscription. When true, show the normal sync UI or status.

**Files to touch**

- [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx) (backup & storage section) and/or the SyncStatusIndicator area, or a sync settings block.

**Cursor prompt**

```
In the Kyarafit web app, add an upgrade prompt for cloud sync: (1) In web/src/app/settings/page.tsx, in the "Backup & storage" section, when useFeatureAccess().canUseCloudSync is false, render the UpgradePrompt component with message "Upgrade to Premium Basic to sync across devices" and link to /settings (or subscription). (2) Optionally add the same prompt near the SyncStatusIndicator or wherever sync is explained. Use the UpgradePrompt (or FeatureGate) component from Step 1. Run npm run build.
```

---

## Step 3: Add upgrade prompts for other gated features (optional)

**What to do**

- If export or other features use `canExport` or similar, add UpgradePrompt in those flows (e.g. export button disabled with tooltip or inline message). Document which features are gated in the component or in this guide.

**Files to touch**

- Pages or components that expose export or other gated features.

**Cursor prompt**

```
In the Kyarafit web app, add upgrade prompts for other gated features: where export (or similar) is gated by useFeatureAccess().canExport, show UpgradePrompt when false (e.g. next to disabled export button). Reuse the same UpgradePrompt component and link to settings/subscription. Document in WEB_FEATURE_GATES.md which features are gated.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Create UpgradePrompt/FeatureGate component (message + optional link). |
| 2 | Add sync upgrade prompt in settings and/or near sync UI. |
| 3 | Optional: add prompts for export and other gated features. |
