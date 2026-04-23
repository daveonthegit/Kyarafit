/**
 * Convex `users.tier` + RevenueCat entitlement policy (shared with Convex + web + mobile).
 *
 * RevenueCat: create entitlements **`pro`** and **`studio`**, attach App Store / Play / Web Billing products.
 * Optional legacy entitlement ids `premium_basic` / `premium_pro` still map for older RC projects.
 *
 * Store product identifiers (App Store Connect / Play Console) should match your RC package SKUs, e.g.:
 * `com.kyarafit.pro.monthly`, `com.kyarafit.pro.annual`, `com.kyarafit.studio.monthly`, `com.kyarafit.studio.annual`.
 */

export type ConvexTier = "FREE" | "PRO" | "STUDIO";

const STORAGE_LIMIT_MB: Record<ConvexTier, number> = {
  FREE: 50,
  PRO: 500,
  STUDIO: -1,
};

const LEGACY_TO_CONVEX: Record<string, ConvexTier> = {
  ANON: "FREE",
  PREMIUM_BASIC: "PRO",
  PREMIUM_PRO: "STUDIO",
};

const RANK: Record<ConvexTier, number> = {
  FREE: 0,
  PRO: 1,
  STUDIO: 2,
};

/** RevenueCat entitlement id → `users.tier` (case-sensitive keys = RC dashboard identifiers). */
export const ENTITLEMENT_TO_CONVEX_TIER: Record<string, ConvexTier> = {
  pro: "PRO",
  studio: "STUDIO",
  premium_basic: "PRO",
  premium_pro: "STUDIO",
};

export function normalizeConvexTier(raw: string | undefined | null): ConvexTier {
  if (raw == null || raw.trim() === "") return "FREE";
  const u = raw.trim().toUpperCase();
  if (u === "FREE" || u === "PRO" || u === "STUDIO") return u as ConvexTier;
  return LEGACY_TO_CONVEX[u] ?? "FREE";
}

/** Storage quota in MB; -1 = unlimited (enforced only on FREE/PRO in upload paths). */
export function convexTierStorageLimitMb(tier: string): number {
  const t = normalizeConvexTier(tier);
  return STORAGE_LIMIT_MB[t];
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
