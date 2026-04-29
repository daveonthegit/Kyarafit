import { normalizeConvexTier } from "./subscriptionTierPolicy";

export type AdSurface = "web_sidebar" | "mobile_bottom";

export type SponsoredPlacement = {
  id: string;
  sponsor: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
};

export const AD_POLICY = {
  label: "Sponsored",
  maxPerSurface: 1,
} as const;

export const SPONSORED_PLACEMENTS: Record<AdSurface, SponsoredPlacement> = {
  web_sidebar: {
    id: "web-sidebar-maker-supply",
    sponsor: "Kyarafit Sponsor",
    eyebrow: "Materials desk",
    title: "Restock before your next fitting.",
    body: "A quiet sponsor slot for fabric, foam, wigs, tools, patterns, or convention prep partners.",
    cta: "Sponsor slot",
    href: "/settings/subscription",
  },
  mobile_bottom: {
    id: "mobile-bottom-material-sponsor",
    sponsor: "Kyarafit Sponsor",
    eyebrow: "Sponsor",
    title: "Find the missing piece.",
    body: "Tools, notions, patterns, and materials for cosplay planning.",
    cta: "Learn more",
    href: "/settings/subscription",
  },
};

export function shouldShowAdsForTier(tier: string | undefined | null): boolean {
  return normalizeConvexTier(tier) === "FREE";
}

export function getSponsoredPlacement(surface: AdSurface): SponsoredPlacement {
  return SPONSORED_PLACEMENTS[surface];
}
