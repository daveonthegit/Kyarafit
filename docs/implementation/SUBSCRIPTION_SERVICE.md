# Subscription service: RevenueCat, Convex, optional Stripe

**Purpose:** Keep `users.tier` in Convex aligned with paid entitlements. **Mobile** uses RevenueCat (store billing + webhook → Convex). **Web** uses **`@revenuecat/purchases-js`** (Web Billing; Stripe only inside RevenueCat) plus the same webhook → Convex; tier is still read from Convex for display. Optional direct **Stripe** webhooks are not used for tier—RC normalizes Stripe into subscriber state.

**Canonical tiers:** `FREE` | `PRO` | `STUDIO` (see `design-system/domain/subscriptionTierPolicy.ts`). Legacy DB values `PREMIUM_BASIC` / `PREMIUM_PRO` normalize to `PRO` / `STUDIO`.

**Current state:**

- **Convex:** [convex/users.ts](../../convex/users.ts) — `getMe` returns normalized tier and `storageLimitMb` from policy; `setTier` internal mutation normalizes before patch. [convex/revenuecat.ts](../../convex/revenuecat.ts) — HTTP webhook fetches subscriber from RevenueCat API and calls `setTier`. [convex/storageUsage.ts](../../convex/storageUsage.ts) — upload limits use `convexTierStorageLimitMb`.
- **Frontend:** [web/src/lib/api/useTier.ts](../../web/src/lib/api/useTier.ts) — `useTier()` reads Convex `getMe`; `useFeatureAccess()` uses design-system `normalizeTier`.
- **Stripe:** Schema still has `stripeCustomerId`, `subscriptionStatus`, etc.; no Stripe webhook in repo yet. Use when adding web-only checkout.

**Operational setup:** [docs/billing/REVENUECAT_SETUP.md](../billing/REVENUECAT_SETUP.md).

**Optional Stripe next steps:** (unchanged from prior plan) webhook → update user by `stripeCustomerId`; Checkout/Portal actions; settings “Upgrade” on web when not using app IAP.

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md), [WEB_FEATURE_GATES.md](WEB_FEATURE_GATES.md), [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [convex/users.ts](../../convex/users.ts).
