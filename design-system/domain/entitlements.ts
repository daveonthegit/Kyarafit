/**
 * Single source for tier → limits / feature flags (web + mobile).
 * Convex `users.tier` uses `FREE` | `PRO` | `STUDIO` (see `subscriptionTierPolicy.ts`);
 * `normalizeTier` accepts those plus legacy `PREMIUM_*` values.
 */
import { normalizeConvexTier } from "./subscriptionTierPolicy";

export type Tier = "free" | "pro" | "studio";

export type Feature =
  | "storage_mb_soft_cap"
  | "max_builds"
  | "collab_invites"
  | "public_share"
  | "advanced_planner"
  | "priority_support";

/** Soft caps aligned with Convex enforcement (`convexTierStorageLimitMb`); studio = effectively unlimited. */
const STORAGE_CAP_MB: Record<Tier, number> = {
  free: 50,
  pro: 500,
  studio: 1_000_000_000,
};

const MAX_BUILDS: Record<Tier, number | null> = {
  free: 25,
  pro: 200,
  studio: null,
};

const FLAGS: Record<
  Tier,
  Pick<
    Record<Feature, boolean>,
    "collab_invites" | "public_share" | "advanced_planner" | "priority_support"
  >
> = {
  free: {
    collab_invites: false,
    public_share: true,
    advanced_planner: false,
    priority_support: false,
  },
  pro: {
    collab_invites: true,
    public_share: true,
    advanced_planner: true,
    priority_support: false,
  },
  studio: {
    collab_invites: true,
    public_share: true,
    advanced_planner: true,
    priority_support: true,
  },
};

export function normalizeTier(raw: string | undefined | null): Tier {
  const c = normalizeConvexTier(raw ?? "");
  if (c === "FREE") return "free";
  if (c === "PRO") return "pro";
  return "studio";
}

export function limit(tier: Tier, feature: Feature): number | null | boolean {
  switch (feature) {
    case "storage_mb_soft_cap":
      return STORAGE_CAP_MB[tier];
    case "max_builds":
      return MAX_BUILDS[tier];
    default:
      return FLAGS[tier][feature];
  }
}

/** Whether the tier may use a boolean feature, or soft storage under cap (when `feature` is storage). */
export function can(
  tier: Tier,
  feature: Feature,
  ctx?: { currentUsageMb?: number; currentBuildCount?: number }
): boolean {
  if (feature === "storage_mb_soft_cap") {
    if (tier === "studio") return true;
    const cap = STORAGE_CAP_MB[tier];
    const usage = ctx?.currentUsageMb ?? 0;
    return usage < cap;
  }
  if (feature === "max_builds") {
    const max = MAX_BUILDS[tier];
    if (max === null) return true;
    const n = ctx?.currentBuildCount ?? 0;
    return n < max;
  }
  return FLAGS[tier][feature as keyof (typeof FLAGS)["free"]];
}
