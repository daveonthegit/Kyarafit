## Description

Implements UpgradePrompt / FeatureGate for tier-gated features (FEATURE_STATUS Tiers §10).

- **UpgradePrompt**: message + link to /settings/subscription (customizable).
- **FeatureGate**: when canUseFeature is false shows UpgradePrompt; else renders children.
- **Settings**: Backup & storage shows UpgradePrompt when !canUseCloudSync (e.g. FREE); i18n viewPlan (en/es).
- Tests: UpgradePrompt.test.tsx; settings page test for upgrade link.

## Type of Change

- [x] New feature (non-breaking change which adds functionality)

## Service(s) Affected

- [x] Web app
- [x] Documentation

## Testing

- [x] Unit tests added (UpgradePrompt, settings upgrade link)
- [x] npm run validate passes (format, lint, typecheck, build:web)

## Checklist

- [x] Code follows project style (Prettier)
- [x] Docs updated: FEATURE_STATUS, GAP_ANALYSIS, COMMIT_PLAN (3.4 done)
- [x] Tests added
- [x] npm run validate passes

## How to test

1. npm run validate
2. npm run dev, go to Settings. As FREE user: Backup & storage shows upgrade message and "View plan" link to /settings/subscription.

## Evidence

- web/src/components/UpgradePrompt.tsx, UpgradePrompt.test.tsx
- web/src/app/settings/page.tsx (useFeatureAccess, UpgradePrompt)
- web/messages en.json, es.json (viewPlan)
- FEATURE_STATUS, GAP_ANALYSIS, COMMIT_PLAN updated.
