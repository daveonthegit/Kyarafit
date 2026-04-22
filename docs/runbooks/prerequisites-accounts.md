# Prerequisites and accounts — mobile + billing + ops

Checklist for Kyarafit mobile rebuild and store submission. Each row should have an **owner** and **target date** in your tracker; blockers here gate **Phase 7** (subscriptions, push, admin) per the mobile blueprint.


| Area       | Item                                                 | Owner | Target | Status | Notes                                                                                                                                                |
| ---------- | ---------------------------------------------------- | ----- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple      | Apple Developer Program enrollment                   |       |        |        | Required for iOS builds and App Store                                                                                                                |
| Apple      | App Store Connect app record (`com.kyarafit.mobile`) |       |        |        | Bundle ID must match `mobile/app.json`                                                                                                               |
| Apple      | In-app subscription products                         |       |        |        | SKUs e.g. `com.kyarafit.pro.monthly`, `com.kyarafit.pro.annual`, `com.kyarafit.studio.monthly`, `com.kyarafit.studio.annual` — align with RevenueCat |
| Google     | Play Console developer account                       |       |        |        |                                                                                                                                                      |
| Google     | Play app + subscription products                     |       |        |        | Match RevenueCat / Play Billing                                                                                                                      |
| RevenueCat | Project + iOS + Android + Web keys                   |       |        |        | Web uses public key + Web Billing; server secrets in Convex/EAS only                                                                                 |
| RevenueCat | Entitlements `pro`, `studio`; offerings wired        |       |        |        | Single source maps to `users.tier` via webhook                                                                                                       |
| RevenueCat | Webhook URL → Convex HTTP action                     |       |        |        | `REVENUECAT_WEBHOOK_SECRET` in Convex env                                                                                                            |
| Stripe     | Account as RevenueCat processor only                 |       |        |        | No Stripe SDK in app code; tax/invoicing per org                                                                                                     |
| Push       | APNs key / FCM for Expo Push                         |       |        |        | For transactional + marketing (opt-in)                                                                                                               |
| Sentry     | Project + DSN                                        |       |        |        | `EXPO_PUBLIC_SENTRY_DSN` in EAS env for client                                                                                                       |
| Expo       | EAS project + `EXPO_TOKEN` for CI                    |       |        |        | Secrets: `RC_*`, `SENTRY_AUTH_TOKEN`, etc.                                                                                                           |
| Convex     | Production + dev deployments                         |       |        |        | `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`                                                                                              |


## Environment placement

- **Client-readable:** only `EXPO_PUBLIC_*` in `mobile/src/`** (CI enforces via `npm run check:env` in `mobile`).
- **Secrets:** EAS secrets, Convex dashboard, never committed.

## Gate

**Phase 7** must not start until RevenueCat projects, store products, webhook, and Convex billing surfaces are verified in a dev/staging stack.