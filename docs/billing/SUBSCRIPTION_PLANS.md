# Kyarafit subscription plans

Kyarafit uses three public plans: **Free**, **Pro**, and **Studio**. The plan catalog lives in `design-system/domain/subscriptionPlans.ts`; entitlement enforcement lives in `design-system/domain/entitlements.ts` and `design-system/domain/subscriptionTierPolicy.ts`.

## Plan strategy

Kyarafit should not monetize by making the first build painful. Free stays useful enough to prove the product, Pro is the default paid plan for active solo creators, and Studio is the ceiling-removal plan for high-volume creators and small teams.

| Plan   | Target user                                               | Price         | Annual        | Convex tier | RevenueCat entitlement |
| ------ | --------------------------------------------------------- | ------------- | ------------- | ----------- | ---------------------- |
| Free   | Trying Kyarafit or keeping a small archive                | $0            | $0            | `FREE`      | none                   |
| Pro    | Active solo cosplayers with real convention deadlines     | $3 / month    | $30 / year    | `PRO`       | `pro`                  |
| Studio | High-volume makers, groups, and portfolio-driven creators | $9.99 / month | $79.99 / year | `STUDIO`    | `studio`               |

Pro annual pricing is two months free. Keep that framing in marketing copy instead of making monthly feel artificially punished.

## Limits and value

| Capability                        | Free  | Pro    | Studio    |
| --------------------------------- | ----- | ------ | --------- |
| Builds                            | 25    | 200    | Unlimited |
| Image storage                     | 50 MB | 500 MB | Unlimited |
| Digital closet and build tracking | Yes   | Yes    | Yes       |
| Convention and packing basics     | Yes   | Yes    | Yes       |
| Public build sharing              | Yes   | Yes    | Yes       |
| Advanced planner                  | No    | Yes    | Yes       |
| Collaboration invites             | No    | Yes    | Yes       |
| Import/export and cloud backup    | No    | Yes    | Yes       |
| CSV/PDF exports                   | No    | No     | Yes       |
| Priority support                  | No    | No     | Yes       |

## Product identifiers

Use these IDs in App Store Connect, Google Play Console, Stripe via RevenueCat Web Billing, and RevenueCat packages:

| Product        | Product identifier            |
| -------------- | ----------------------------- |
| Pro monthly    | `com.kyarafit.pro.monthly`    |
| Pro annual     | `com.kyarafit.pro.annual`     |
| Studio monthly | `com.kyarafit.studio.monthly` |
| Studio annual  | `com.kyarafit.studio.annual`  |

Recommended RevenueCat package identifiers for one shared default offering:

| Package          | Product identifier            |
| ---------------- | ----------------------------- |
| `pro_monthly`    | `com.kyarafit.pro.monthly`    |
| `pro_annual`     | `com.kyarafit.pro.annual`     |
| `studio_monthly` | `com.kyarafit.studio.monthly` |
| `studio_annual`  | `com.kyarafit.studio.annual`  |

The app matches checkout buttons by **product identifier**, so product IDs are the important stable contract. Package IDs may differ, but keep them unique within the offering.

## Positioning copy

Free: "Start organizing without pressure."

Pro: "For active cosplayers managing real convention seasons."

Studio: "For high-volume makers, groups, and portfolio-driven creators."

## Rollout checklist

- Create RevenueCat entitlements `pro` and `studio`.
- Attach Pro monthly/annual products to `pro`.
- Attach Studio monthly/annual products to `studio`.
- Add all four products to the default offering used by web, iOS, and Android.
- Confirm Convex webhook updates `users.tier` to `PRO` and `STUDIO`.
- Verify Settings -> Subscription displays the correct current plan after purchase, restore, cancellation, and renewal.
