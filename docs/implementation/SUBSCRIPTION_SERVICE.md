# Subscription Service: Stripe + Convex

**Purpose:** Stripe webhook to update user tier/subscription in Convex; Checkout and Customer Portal so users can upgrade and manage subscriptions. Feature gates (useFeatureAccess) and upgrade prompts in UI. No Go backend.

**Scope:** In: Convex (users table has tier, stripeCustomerId, subscriptionStatus, etc.); Stripe webhook verification and handlers; Convex action or HTTP endpoint returning Checkout/Portal URL; frontend opening URL. Out: Go POST /webhooks/stripe, Go subscription routes.

**Current state:**

- **Convex schema:** [convex/schema.ts](convex/schema.ts) — users have tier, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd.
- **Frontend:** [web/src/lib/api/useTier.ts](web/src/lib/api/useTier.ts) — useTier() hardcodes FREE; useFeatureAccess() derives canUseCloudSync, canExport, etc. No Stripe flow yet.
- **Stripe:** No webhook or Checkout/Portal implementation in repo. Env (STRIPE_WEBHOOK_SECRET, Stripe price ids) would live in Convex dashboard or external service.

**Next steps:**

1. **Stripe webhook:** Add HTTP route (e.g. in Convex HTTP or external server) that receives POST from Stripe; verify signature with STRIPE_WEBHOOK_SECRET; on customer.subscription.created/updated/deleted, look up user by stripeCustomerId (or create/link customer), update Convex user (tier, subscriptionStatus, subscriptionCurrentPeriodEnd) via Convex mutation or action. Convex actions can call Stripe API; HTTP handler can call Convex mutation with admin key or internal auth.
2. **Checkout URL:** Authenticated Convex action (or HTTP + auth) that creates Stripe Checkout Session for current user (price from env or arg), returns { url }; frontend redirects to url.
3. **Customer Portal URL:** Same pattern: create Stripe Customer Portal session for user's stripeCustomerId, return { url }; frontend opens in same tab or web view.
4. **Convex users:** Ensure mutations to update stripeCustomerId, tier, subscriptionStatus exist (or use patch/update from action). Wire useTier to Convex users.getMe (or query that returns tier, currentUsageMb, storageLimitMb).
5. **Frontend:** Settings → Subscription Plan: show tier/usage; "Upgrade" button calls action to get Checkout URL and redirects; "Manage" gets Portal URL. Add UpgradePrompt/FeatureGate where features are gated (see WEB_FEATURE_GATES).

**Links:** [FEATURES_CANONICAL.md](FEATURES_CANONICAL.md) (Tiers/subscription), [WEB_FEATURE_GATES.md](WEB_FEATURE_GATES.md), [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md), [convex/users.ts](convex/users.ts), [GAP_ANALYSIS.md](GAP_ANALYSIS.md).
