import type { ConvexTier } from "./subscriptionTierPolicy";

export type SubscriptionPlanId = "free" | "pro" | "studio";
export type SubscriptionBillingInterval = "monthly" | "annual";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  tier: ConvexTier;
  name: string;
  shortName: string;
  tagline: string;
  audience: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  annualSavingsLabel: string | null;
  storageLimitMb: number;
  maxBuilds: number | null;
  revenueCatEntitlementId: "pro" | "studio" | null;
  productIds: Partial<Record<SubscriptionBillingInterval, string>>;
  highlights: string[];
  features: string[];
  notIncluded?: string[];
};

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "free",
    tier: "FREE",
    name: "Free",
    shortName: "Free",
    tagline: "Start organizing without pressure.",
    audience: "Best for trying Kyarafit or keeping a small personal build log.",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    annualSavingsLabel: null,
    storageLimitMb: 50,
    maxBuilds: 25,
    revenueCatEntitlementId: null,
    productIds: {},
    highlights: ["25 builds", "50 MB image storage", "Public profile and sharing"],
    features: [
      "Digital closet and build tracking",
      "Convention and packing basics",
      "Public build sharing",
      "Local-first planning while signed in",
    ],
    notIncluded: ["Collaboration", "Advanced planner", "Priority support"],
  },
  {
    id: "pro",
    tier: "PRO",
    name: "Kyarafit Pro",
    shortName: "Pro",
    tagline: "For active cosplayers managing real convention seasons.",
    audience: "Best for solo creators with multiple builds, references, and deadlines.",
    monthlyPriceUsd: 3,
    annualPriceUsd: 30,
    annualSavingsLabel: "Save 2 months",
    storageLimitMb: 500,
    maxBuilds: 200,
    revenueCatEntitlementId: "pro",
    productIds: {
      monthly: "com.kyarafit.pro.monthly",
      annual: "com.kyarafit.pro.annual",
    },
    highlights: ["200 builds", "500 MB image storage", "Advanced planner"],
    features: [
      "Everything in Free",
      "Advanced planner for deadlines and build tasks",
      "Collaboration invites",
      "Import/export and cloud backup",
      "More room for references and process photos",
    ],
  },
  {
    id: "studio",
    tier: "STUDIO",
    name: "Kyarafit Studio",
    shortName: "Studio",
    tagline: "For high-volume makers, groups, and portfolio-driven creators.",
    audience: "Best for creators who coordinate many looks or work with assistants and teams.",
    monthlyPriceUsd: 9.99,
    annualPriceUsd: 79.99,
    annualSavingsLabel: "Save about 33%",
    storageLimitMb: -1,
    maxBuilds: null,
    revenueCatEntitlementId: "studio",
    productIds: {
      monthly: "com.kyarafit.studio.monthly",
      annual: "com.kyarafit.studio.annual",
    },
    highlights: ["Unlimited builds", "Unlimited storage", "Priority support"],
    features: [
      "Everything in Pro",
      "Unlimited builds and conventions",
      "Unlimited image storage",
      "CSV and PDF exports",
      "Priority support for billing and account issues",
    ],
  },
] as const;

export const PAID_SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS.filter((plan) => plan.id !== "free");

export function getSubscriptionPlanByTier(tier: string | undefined | null): SubscriptionPlan {
  const normalized = (tier ?? "FREE").toUpperCase();
  return SUBSCRIPTION_PLANS.find((plan) => plan.tier === normalized) ?? SUBSCRIPTION_PLANS[0];
}

export function getSubscriptionPlanByProductId(
  productId: string | undefined | null
): SubscriptionPlan | null {
  if (!productId) return null;
  return (
    PAID_SUBSCRIPTION_PLANS.find((plan) =>
      Object.values(plan.productIds).some((id) => id === productId)
    ) ?? null
  );
}

export function formatUsdPrice(price: number): string {
  if (price === 0) return "$0";
  if (Number.isInteger(price)) return `$${price}`;
  return `$${price.toFixed(2)}`;
}

export function formatPlanStorage(limitMb: number): string {
  if (limitMb < 0) return "Unlimited";
  if (limitMb >= 1024) return `${Number((limitMb / 1024).toFixed(1))} GB`;
  return `${limitMb} MB`;
}

export function formatPlanBuildLimit(limit: number | null): string {
  return limit === null ? "Unlimited" : `${limit}`;
}
