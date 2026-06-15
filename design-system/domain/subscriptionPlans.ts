import { normalizeConvexTier, type ConvexTier } from "./subscriptionTierPolicy";

export type SubscriptionPlanId = "free" | "pro" | "supporter";
export type SubscriptionBillingInterval = "monthly" | "annual";

/** A preset "pay what you want" price point (app stores require fixed prices). */
export type SubscriptionPreset = {
  id: string;
  label: string;
  monthlyPriceUsd: number;
  productId: string;
};

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
  revenueCatEntitlementId: "pro" | "supporter" | null;
  productIds: Partial<Record<SubscriptionBillingInterval, string>>;
  /** Pay-what-you-want preset price points (Supporter). Each grants the same entitlement. */
  payWhatYouWant?: boolean;
  /** Minimum monthly contribution for a pay-what-you-want plan (must exceed Pro). */
  minimumMonthlyPriceUsd?: number;
  presets?: readonly SubscriptionPreset[];
  highlights: string[];
  features: string[];
  notIncluded?: string[];
};

const PRO_MONTHLY_USD = 3;

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "free",
    tier: "FREE",
    name: "Free",
    shortName: "Free",
    tagline: "Everything you need to plan builds — on your device.",
    audience: "Best for anyone organizing cosplay builds, conventions, and packing.",
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    annualSavingsLabel: null,
    storageLimitMb: 50,
    revenueCatEntitlementId: null,
    productIds: {},
    highlights: [
      "Unlimited builds",
      "Works offline on your device",
      "Export anytime (CSV, JSON, PDF)",
    ],
    features: [
      "Digital closet and unlimited build tracking",
      "Conventions, day plans, and packing lists",
      "Public build sharing",
      "Local-first — your data lives on this device",
      "Full export and import (CSV, JSON backup with images, PDF)",
    ],
    notIncluded: ["Automatic cloud sync", "Multi-device access", "Collaboration invites"],
  },
  {
    id: "pro",
    tier: "PRO",
    name: "Kyarafit Pro",
    shortName: "Pro",
    tagline: "Stop thinking about backups. Work from any device.",
    audience: "Best for makers who want their builds synced, backed up, and always available.",
    monthlyPriceUsd: PRO_MONTHLY_USD,
    annualPriceUsd: 30,
    annualSavingsLabel: "Save 2 months",
    storageLimitMb: 2048,
    revenueCatEntitlementId: "pro",
    productIds: {
      monthly: "com.kyarafit.pro.monthly",
      annual: "com.kyarafit.pro.annual",
    },
    highlights: ["Automatic cloud sync", "Work from any device", "2 GB image storage"],
    features: [
      "Everything in Free",
      "Automatic cloud backup & sync — no manual exports",
      "Seamless access across all your devices",
      "Collaboration invites",
      "Advanced planner for deadlines & nested build tasks",
      "Priority support",
    ],
  },
  {
    id: "supporter",
    tier: "SUPPORTER",
    name: "Kyarafit Supporter",
    shortName: "Supporter",
    tagline: "Love Kyarafit? Chip in more — same Pro features, extra thanks.",
    audience: "Best for people who want to back Kyarafit's development beyond the Pro price.",
    monthlyPriceUsd: 5,
    annualPriceUsd: 0,
    annualSavingsLabel: null,
    storageLimitMb: 2048,
    revenueCatEntitlementId: "supporter",
    productIds: {},
    payWhatYouWant: true,
    minimumMonthlyPriceUsd: 5,
    presets: [
      { id: "m5", label: "$5 / mo", monthlyPriceUsd: 5, productId: "com.kyarafit.supporter.m5" },
      {
        id: "m10",
        label: "$10 / mo",
        monthlyPriceUsd: 10,
        productId: "com.kyarafit.supporter.m10",
      },
      {
        id: "m25",
        label: "$25 / mo",
        monthlyPriceUsd: 25,
        productId: "com.kyarafit.supporter.m25",
      },
      {
        id: "m50",
        label: "$50 / mo",
        monthlyPriceUsd: 50,
        productId: "com.kyarafit.supporter.m50",
      },
    ],
    highlights: ["Everything in Pro", "Choose your contribution", "Support ongoing development"],
    features: [
      "Everything in Pro — identical features",
      "Pick the amount that feels right (min $5 / mo)",
      "Directly funds Kyarafit's development",
      "Our heartfelt thanks ✨",
    ],
  },
] as const;

export const PAID_SUBSCRIPTION_PLANS = SUBSCRIPTION_PLANS.filter((plan) => plan.id !== "free");

/** All store product identifiers a plan can be purchased through (intervals + presets). */
export function subscriptionPlanProductIds(plan: SubscriptionPlan): string[] {
  const ids = Object.values(plan.productIds).filter((id): id is string => Boolean(id));
  for (const preset of plan.presets ?? []) ids.push(preset.productId);
  return ids;
}

export function getSubscriptionPlanByTier(tier: string | undefined | null): SubscriptionPlan {
  // Normalize legacy/loose values (e.g. "STUDIO", "premium_pro") to a current tier so the helper
  // is total and safe to call with raw stored values.
  const normalized = normalizeConvexTier(tier);
  return SUBSCRIPTION_PLANS.find((plan) => plan.tier === normalized) ?? SUBSCRIPTION_PLANS[0];
}

export function getSubscriptionPlanByProductId(
  productId: string | undefined | null
): SubscriptionPlan | null {
  if (!productId) return null;
  return (
    PAID_SUBSCRIPTION_PLANS.find((plan) => subscriptionPlanProductIds(plan).includes(productId)) ??
    null
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
