# Kyarafit free ad system

Kyarafit Free may show quiet peripheral sponsor placements. Ads must never interrupt creating, editing, packing, checking tasks, onboarding, auth, or billing flows.

## Current implementation

Shared policy and placeholder inventory live in `design-system/domain/adPolicy.ts`.

Web component:

- `web/src/components/ads/SponsoredAdRail.tsx`
- `web/src/components/ads/GoogleAdsenseUnit.tsx`

Mobile component:

- `mobile/src/components/ads/MobileSponsoredAdStrip.tsx`

Current placements:

| Surface           | Placement                                                  | Rule            |
| ----------------- | ---------------------------------------------------------- | --------------- |
| Web app shell     | Slim right-side sponsor rail outside the main work surface | Free users only |
| Mobile tabs shell | Compact bottom sponsor strip above tab navigation          | Free users only |

Pro and Studio users do not see ads. Eligibility is determined by `shouldShowAdsForTier`, which only returns true for `FREE`.

## Product rules

- Use peripheral sponsor placements only.
- Label every placement as `Sponsored` and `Ad`.
- Maximum one ad per surface in the first implementation.
- No interstitials, app-open ads, rewarded video, sticky banners, or modal ads.
- No ads in create/edit flows.
- No ads inside active checklists, packing flows, auth, onboarding, or destructive action panels.
- No in-feed ad cards competing with user builds, elements, or planner content.
- No personalized ads unless consent and platform privacy requirements are implemented first.

## Integration path

The web rail supports Google AdSense with the built-in publisher client `ca-pub-8056052475009755`, matching `web/public/ads.txt`.

The sidebar rail renders the built-in Kyarafit display ad slot `6551071878`.

`NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT` and `NEXT_PUBLIC_GOOGLE_ADSENSE_SIDEBAR_SLOT` can override the built-in publisher client and slot for staging/testing. When connecting direct sponsor inventory, keep the shared placement shape:

- `sponsor`
- `eyebrow`
- `title`
- `body`
- `cta`
- `href`

For native mobile ads, use AdMob rather than AdSense. Map network assets into the same bottom-strip placement and keep the required ad attribution visible.

Do not add ad-blocker circumvention. Ads should be allowed to fail closed when users block ads, when Google returns no fill, or while the AdSense site is still under review.
