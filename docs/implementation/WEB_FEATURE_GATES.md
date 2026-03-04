# Web: Feature Gates and Upgrade Prompts

**Purpose:** Show upgrade prompts where features are gated by tier (e.g. cloud sync on mobile, export, premium features) so FREE users see clear messaging and link to upgrade. Use Convex users.tier when wired; keep useFeatureAccess().

**Scope:** In: Reusable UpgradePrompt/FeatureGate component; settings and any gated feature entry points (web and mobile). Out: Go tier API (tier comes from Convex users).

**Current state:**

- **useTier / useFeatureAccess:** [web/src/lib/api/useTier.ts](web/src/lib/api/useTier.ts) — useTier() returns hardcoded FREE (currentUsageMb: 0, storageLimitMb: 100). useFeatureAccess() derives canUseCloudSync, canExport, etc. from tier. Used in [web/src/app/settings/page.tsx](web/src/app/settings/page.tsx).
- **UI:** No UpgradePrompt or FeatureGate component; no inline "Upgrade to Premium to…" messages at gated entry points.
- **Convex:** users.tier exists in schema; when useTier is wired to Convex users.getMe (or equivalent), tier will be real. Until then, all users effectively FREE.

**Next steps:**

1. **UpgradePrompt component:** Create e.g. web/src/components/UpgradePrompt.tsx (or FeatureGate.tsx): props — canUseFeature (boolean), message (string), optional linkUrl, linkText. When canUseFeature is false, render compact banner or inline message with text and link; when true, render children or null. Use existing design tokens.
2. **Settings:** In settings page (e.g. Backup & storage or subscription section), when useFeatureAccess().canUseCloudSync is false, render UpgradePrompt with message "Upgrade to Premium Basic to sync across devices" and link to /settings/subscription (or subscription page). For web, "sync" may mean mobile sync or future features; gate only where product defines it.
3. **Other gated features:** Where export or other actions use canExport (or similar), show UpgradePrompt when false (e.g. next to disabled export button). Document which features are gated in this guide or in the component.
4. **Wire useTier to Convex:** So that tier is read from Convex users (see SUBSCRIPTION_SERVICE and GAP_ANALYSIS). Then feature gates reflect real tier.
5. **Mobile:** Same upgrade prompts at same logical entry points (settings, sync section, export); use same tier/feature-access source.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Tiers/subscription), [SUBSCRIPTION_SERVICE.md](SUBSCRIPTION_SERVICE.md), [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
