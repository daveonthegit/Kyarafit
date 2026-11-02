/**
 * Convex `users.tier` + RevenueCat entitlement policy (shared with Convex + web + mobile).
 *
 * Tiers: **FREE** (local-first, no cloud sync) and a single paid level expressed as two
 * entitlements that grant **identical** feature access:
 *   - **`pro`**  → tier `PRO`      — the standard paid plan.
 *   - **`supporter`** → tier `SUPPORTER` — same features as Pro, "pay what you want" via preset
 *      price points above the Pro price (a donation/support plan). Feature-wise == Pro.
 *
 * Legacy entitlement ids `studio` / `premium_basic` / `premium_pro` collapse into `PRO`.
 *
 * Store product identifiers (App Store Connect / Play Console) match the RC package SKUs, e.g.:
 * `com.kyarafit.pro.monthly`, `com.kyarafit.pro.annual`,
 * `com.kyarafit.supporter.m5`, `com.kyarafit.supporter.m10`, … (one product per preset amount;
 * app stores require fixed price points, so "pay what you want" is a set of presets).
 */

export type ConvexTier = "FREE" | "PRO" | "SUPPORTER";

/** Cloud storage quota in MB; -1 = unlimited. Paid tiers share one generous bounded cap. */
const STORAGE_LIMIT_MB: Record<ConvexTier, number> = {
  FREE: 50,
  PRO: 2048,
  SUPPORTER: 2048,
};

/** Historical / legacy tier values → current tiers. STUDIO collapsed into PRO. */
const LEGACY_TO_CONVEX: Record<string, ConvexTier> = {
  ANON: "FREE",
  STUDIO: "PRO",
  PREMIUM_BASIC: "PRO",
  PREMIUM_PRO: "PRO",
};

const RANK: Record<ConvexTier, number> = {
  FREE: 0,
  PRO: 1,
  SUPPORTER: 2,
};

/** RevenueCat entitlement id → `users.tier` (case-sensitive keys = RC dashboard identifiers). */
export const ENTITLEMENT_TO_CONVEX_TIER: Record<string, ConvexTier> = {
  pro: "PRO",
  supporter: "SUPPORTER",
  // legacy entitlements collapse into PRO
  studio: "PRO",
  premium_basic: "PRO",
  premium_pro: "PRO",
};

export function normalizeConvexTier(raw: string | undefined | null): ConvexTier {
  if (raw == null || raw.trim() === "") return "FREE";
  const u = raw.trim().toUpperCase();
  if (u === "FREE" || u === "PRO" || u === "SUPPORTER") return u as ConvexTier;
  return LEGACY_TO_CONVEX[u] ?? "FREE";
}

/** Storage quota in MB; -1 = unlimited. */
export function convexTierStorageLimitMb(tier: string): number {
  const t = normalizeConvexTier(tier);
  return STORAGE_LIMIT_MB[t];
}

/** True for any paid tier (PRO or SUPPORTER). Feature access is identical across paid tiers. */
export function isPaidConvexTier(tier: string | undefined | null): boolean {
  return normalizeConvexTier(tier) !== "FREE";
}

export function bestConvexTierFromSubscriberEntitlements(
  entitlements: Record<string, { expires_date?: string | null }>
): ConvexTier {
  let best: ConvexTier = "FREE";
  for (const [entitlementId, meta] of Object.entries(entitlements)) {
    const exp = meta.expires_date;
    if (exp != null && exp !== "") {
      const d = new Date(exp);
      if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) continue;
    }
    const mapped = ENTITLEMENT_TO_CONVEX_TIER[entitlementId];
    if (!mapped) continue;
    if (RANK[mapped] > RANK[best]) best = mapped;
  }
  return best;
}
