# RevenueCat React Native implementation

Kyarafit mobile uses RevenueCat through:

- `react-native-purchases` for SDK configuration, offerings, purchases, restores, and customer info.
- `react-native-purchases-ui` for RevenueCat-hosted Paywalls and Customer Center.

Official docs:

- [React Native installation](https://www.revenuecat.com/docs/getting-started/installation/reactnative#installation)
- [Paywalls](https://www.revenuecat.com/docs/tools/paywalls)
- [Customer Center](https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native)

## Installation

From the repo root:

```bash
npm install --save -w mobile react-native-purchases react-native-purchases-ui
```

This updates `mobile/package.json` and the root `package-lock.json`.

## API key

Kyarafit currently falls back to this RevenueCat public test key:

```bash
EXPO_PUBLIC_REVENUECAT_API_KEY=test_LcHOSOPOKvmPIwiBKeOOusRzKHE
```

For production, prefer platform-specific keys in `mobile/.env` or EAS secrets:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
```

The configuration lives in:

- `mobile/src/config/env.ts`
- `mobile/src/lib/revenuecat.ts`
- `mobile/src/components/RevenueCatBootstrap.tsx`

## Product IDs

Configure these products in RevenueCat and the stores:

| Product        | Identifier                    |
| -------------- | ----------------------------- |
| Studio Monthly | `com.kyarafit.studio.monthly` |
| Studio Annual  | `com.kyarafit.studio.annual`  |
| Pro Monthly    | `com.kyarafit.pro.monthly`    |
| Pro Annual     | `com.kyarafit.pro.annual`     |
| Lifetime       | `lifetime`                    |
| Yearly         | `yearly`                      |
| Monthly        | `monthly`                     |

The custom Kyarafit plan cards use the four canonical plan products from `design-system/domain/subscriptionPlans.ts`. Generic `monthly`, `yearly`, and `lifetime` products can be used in RevenueCat Paywalls if you attach them to an offering and entitlement.

## Entitlements

Create an entitlement named:

```txt
pro
```

Attach every product that should unlock Pro access to the `pro` entitlement. Kyarafit checks it with:

```ts
customerHasProEntitlement(customerInfo);
```

## Dashboard offering setup

1. Create products in App Store Connect and Google Play Console.
2. Import or add the products in RevenueCat.
3. Attach products to the `pro` entitlement.
4. Create an offering, commonly `default`.
5. Add packages for each product you want to display.
6. Configure a RevenueCat Paywall for the offering.
7. Enable Customer Center in RevenueCat if you want hosted subscription management.

Recommended package IDs for the canonical Kyarafit plans:

```txt
pro_monthly
pro_annual
studio_monthly
studio_annual
```

## Code surface

The app centralizes RevenueCat calls in `mobile/src/lib/revenuecat.ts`:

```ts
ensureRevenueCatConfigured();
const customerInfo = await getRevenueCatCustomerInfo();
const hasPro = customerHasProEntitlement(customerInfo);
```

Purchases and restores:

```ts
const purchaseResult = await purchaseRevenueCatPackage(pkg);
const restoredInfo = await restoreRevenueCatPurchases();
```

Paywall:

```ts
const result = await presentProPaywallIfNeeded();
const unlocked = didRevenueCatPaywallUnlockEntitlement(result);
```

Customer Center:

```ts
await presentRevenueCatCustomerCenter({
  onRestoreCompleted: ({ customerInfo }) => {
    // Refresh local UI from customerInfo.
  },
});
```

`mobile/app/(app)/settings/subscription.tsx` uses these helpers for:

- customer info retrieval
- live customer info updates
- `pro` entitlement status
- package purchases
- restores
- RevenueCat Paywall presentation
- Customer Center presentation

## Best practices

- Do not infer paid access from the client alone. RevenueCat webhooks update Convex, and app feature gates should continue reading Kyarafit tier state from Convex.
- Use RevenueCat customer info for immediate UI feedback after a purchase or restore.
- Keep the RevenueCat app user id equal to the Better Auth subject / Convex `users.externalId`.
- Handle cancelled purchases separately from failed purchases.
- Keep product IDs stable. If prices change, create new products and migrate offerings rather than renaming existing identifiers.
- Test on a development build or store sandbox build. Expo Go cannot exercise native purchase SDKs reliably.
