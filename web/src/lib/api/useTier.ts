"use client";

import { authClient } from "@/lib/auth/auth-client";

export interface MeResponse {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number;
}

/**
 * Returns tier and storage info.
 * During migration, all authenticated users default to FREE tier.
 * Convex user.tier will be the source of truth once wired.
 */
export function useTier(): { data: MeResponse | null; isLoading: boolean } {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return { data: null, isLoading: true };
  if (!session) return { data: null, isLoading: false };

  return {
    data: {
      tier: "FREE",
      currentUsageMb: 0,
      storageLimitMb: 100,
    },
    isLoading: false,
  };
}

/** Returns feature access based on user's tier */
export function useFeatureAccess() {
  const { data: me } = useTier();

  const tier = me?.tier || "ANON";
  const tierOrder: Record<string, number> = {
    ANON: 0,
    FREE: 1,
    PREMIUM_BASIC: 2,
    PREMIUM_PRO: 3,
  };

  const currentTierLevel = tierOrder[tier] || 0;

  return {
    tier,
    canUseWeb: currentTierLevel >= tierOrder.FREE,
    canUseCloudSync: currentTierLevel >= tierOrder.PREMIUM_BASIC,
    canExport: currentTierLevel >= tierOrder.PREMIUM_BASIC,
    canImport: currentTierLevel >= tierOrder.PREMIUM_BASIC,
    canExportCSV: currentTierLevel >= tierOrder.PREMIUM_PRO,
    canExportPDF: currentTierLevel >= tierOrder.PREMIUM_PRO,
    hasUnlimitedStorage: currentTierLevel >= tierOrder.PREMIUM_PRO,
    hasUnlimitedBuilds: currentTierLevel >= tierOrder.PREMIUM_PRO,
    hasUnlimitedConventions: currentTierLevel >= tierOrder.PREMIUM_PRO,
  };
}
