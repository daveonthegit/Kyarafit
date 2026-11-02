/**
 * Single source for tier → limits / feature flags (web + mobile).
 * Convex `users.tier` uses `FREE` | `PRO` | `SUPPORTER` (see `subscriptionTierPolicy.ts`);
 * `normalizeTier` accepts those plus legacy `STUDIO` / `PREMIUM_*` values (all map to a paid tier).
 *
 * PRO and SUPPORTER grant **identical** feature access — Supporter is a higher-priced
 * "pay what you want" variant of Pro, not a separate feature set. Anything that should be paid
 * is gated by `isPaidTier`, not by a specific tier.
 */
import { normalizeConvexTier } from "./subscriptionTierPolicy";

export type Tier = "free" | "pro" | "supporter";

export type Feature =
  | "storage_mb_soft_cap"
  | "cloud_sync"
  | "collab_invites"
  | "public_share"
  | "advanced_planner"
  | "priority_support"
  // Local productivity — free for everyone (REQ-012).
  | "export"
  | "import"
  // Social: posting/publishing is paid (expensive cloud), interactions are free (REQ-018).
  | "social_post"
  | "like"
  | "comment"
  | "follow"
  // Groups: creating is paid, joining is free (REQ-019).
  | "group_create"
  | "join_group";

/** Soft caps aligned with Convex enforcement (`convexTierStorageLimitMb`). Paid tiers share one cap. */
const STORAGE_CAP_MB: Record<Tier, number> = {
  free: 50,
  pro: 2048,
  supporter: 2048,
};

type BooleanFeature = Exclude<Feature, "storage_mb_soft_cap">;

const PAID_FLAGS: Record<BooleanFeature, boolean> = {
  cloud_sync: true,
  collab_invites: true,
  public_share: true,
  advanced_planner: true,
  priority_support: true,
  export: true,
  import: true,
  social_post: true,
  like: true,
  comment: true,
  follow: true,
  group_create: true,
  join_group: true,
};

const FLAGS: Record<Tier, Record<BooleanFeature, boolean>> = {
  free: {
    cloud_sync: false,
    collab_invites: false,
    // REQ-017: publishing/sharing publicly is a paid (expensive cloud) action.
    public_share: false,
    // REQ-013: advanced planner is free for everyone (cloud sync is the paid lever).
    advanced_planner: true,
    priority_support: false,
    // REQ-012: export/import are always free (local productivity, no cloud cost).
    export: true,
    import: true,
    // REQ-018: posting to the feed is paid; cheap interactions are free.
    social_post: false,
    like: true,
    comment: true,
    follow: true,
    // REQ-019: creating a group is paid; joining one is free.
    group_create: false,
    join_group: true,
  },
  // Supporter == Pro feature-wise.
  pro: PAID_FLAGS,
  supporter: PAID_FLAGS,
};

export function normalizeTier(raw: string | undefined | null): Tier {
  const c = normalizeConvexTier(raw ?? "");
  if (c === "FREE") return "free";
  if (c === "SUPPORTER") return "supporter";
  return "pro";
}

/** True for any paid tier (pro or supporter). Use this to gate paid features. */
export function isPaidTier(tier: Tier): boolean {
  return tier !== "free";
}

export function limit(tier: Tier, feature: Feature): number | boolean {
  if (feature === "storage_mb_soft_cap") {
    return STORAGE_CAP_MB[tier];
  }
  return FLAGS[tier][feature];
}

/** Whether the tier may use a boolean feature, or store under the soft storage cap. */
export function can(tier: Tier, feature: Feature, ctx?: { currentUsageMb?: number }): boolean {
  if (feature === "storage_mb_soft_cap") {
    const cap = STORAGE_CAP_MB[tier];
    const usage = ctx?.currentUsageMb ?? 0;
    return usage < cap;
  }
  return FLAGS[tier][feature];
}
