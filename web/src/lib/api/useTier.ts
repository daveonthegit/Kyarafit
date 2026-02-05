'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/client';
import { fetchMe, type MeResponse } from './me';

/** Returns tier and storage from GET /api/v1/me. Null when not signed in or request fails. */
export function useTier(): { data: MeResponse | null; isLoading: boolean } {
  const { session } = useSession();
  const token = session?.access_token ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ['me', token],
    queryFn: () => fetchMe(token),
    enabled: !!token,
  });
  return { data: data ?? null, isLoading };
}

/** Returns feature access based on user's tier */
export function useFeatureAccess() {
  const { data: me } = useTier();
  
  const tier = me?.tier || 'ANON';
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
