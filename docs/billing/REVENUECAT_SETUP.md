# RevenueCat and subscription tiers

Kyarafit uses **RevenueCat** for mobile in-app purchases. Convex stores the canonical tier on `users.tier` and updates it from a RevenueCat webhook.

## Tiers and entitlements

| Convex `users.tier` | RevenueCat entitlement id (recommended) | Legacy RC ids (still supported) |
| ------------------- | --------------------------------------- | ------------------------------- |
| `FREE`              | _(none)_                                | —                               |
| `PRO`               | `pro`                                   | `premium_basic`                 |
| `STUDIO`            | `studio`                                | `premium_pro`                   |

Policy is defined in `design-system/domain/subscriptionTierPolicy.ts` (single source for Convex, web, and mobile).

**Storage enforcement (MB):** Free 50, Pro 500, Studio unlimited (`-1` in API responses).

## RevenueCat dashboard

1. Create a project and add **iOS** and **Android** apps with the correct bundle IDs.
2. Under **Entitlements**, create `**pro`** and `**studio`** (or keep legacy `premium_basic`/`premium_pro` and map them as above).
3. In **App Store Connect** / **Google Play Console**, create subscription products (e.g. `com.kyarafit.pro.monthly`, `com.kyarafit.studio.annual`). Attach them to the matching entitlements in RevenueCat.
4. Create an **Offering** (e.g. `default`) with packages pointing at those products so `Purchases.getOfferings()` returns packages in the app.

## App user ID

The mobile app should call `Purchases.logIn(appUserId)` with the same id Convex uses as `users.externalId` (Better Auth `subject`). The webhook and subscriber API use that id.

## Convex webhook

- **Path:** `POST /webhooks/revenuecat` (see `convex/http.ts`).
- **Full URL:** `https://<your-deployment>.convex.site/webhooks/revenuecat`
- Register it under RevenueCat → **Project settings** → **Integrations** → **Webhooks**.

### Convex environment variables

| Variable                           | Purpose                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `REVENUECAT_SECRET_API_KEY`        | Secret API key; used to call `GET /v1/subscribers/{app_user_id}` after each webhook. |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Optional. If set, `Authorization` must be `Bearer <value>` or exactly `<value>`.     |

If `REVENUECAT_SECRET_API_KEY` is missing, the handler returns 200 and skips tier sync (logged).

## Mobile (Expo) environment

Set in `mobile/.env` (or EAS secrets), **public** keys only:

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

These are read in `mobile/src/lib/revenuecat.ts`.

## Web: RevenueCat Web Billing (Stripe as processor)

On **web**, Kyarafit uses `**@revenuecat/purchases-js`** (RevenueCat Web Billing). You connect a **Stripe\*\* account inside the RevenueCat dashboard (Web Billing / payment gateway). The browser never loads the Stripe.js SDK from Kyarafit code—checkout is RevenueCat-hosted; Stripe is only the processor behind RC.

### Dashboard steps

1. In RevenueCat, add a **Web** app (or use the Web Billing app) and copy the **Web Billing SDK API key** (often prefixed `rcb_`).
2. **Connect Stripe** under RevenueCat’s Web Billing / payment settings (exact menu varies; see [RevenueCat Web Billing docs](https://www.revenuecat.com/docs/web/web-billing)).
3. Create **Web** subscription products in RevenueCat (linked to Stripe prices), attach them to entitlements `**pro`** and `**studio`**, and add them to the same **Offering** you use on mobile (e.g. `default`) so `getOfferings()` returns packages.
4. Ensure the **Convex webhook** (above) is registered so web purchases update `users.tier` the same way as iOS/Android.

### Next.js env

Set in `web/.env.local`:

| Variable                                     | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_REVENUECAT_WEB_BILLING_API_KEY` | Public Web Billing SDK key from RevenueCat (safe in the client bundle). |

Implementation: `web/src/lib/revenuecatWeb.ts` and `WebSubscriptionRevenueCat` on **Settings → Subscription**. The SDK identifies the subscriber with `**app_user_id` = Convex `users.externalId`\*\* (Better Auth subject), matching mobile `Purchases.logIn`.

### Manage / cancel

After purchase, **Customer Center** / management URLs come from `CustomerInfo.managementURL` in the SDK (store-specific: web vs App Store vs Play). The subscription settings UI surfaces that link when present.
