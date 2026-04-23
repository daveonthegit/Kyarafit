"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { normalizeTier } from "@kyarafit/design-system/domain/entitlements";

export interface MeResponse {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number;
}

const FREE_DEFAULT: MeResponse = {
  tier: "FREE",
  currentUsageMb: 0,
  storageLimitMb: 50,
};

/**
 * Returns tier and storage info from Convex users.getMe.
 * When signed in, uses identity.subject (userId) to fetch user doc; when not
 * signed in or user doc missing, returns null or FREE default.
 */
export function useTier(): { data: MeResponse | null; isLoading: boolean } {
  const { userId, isLoading: identityLoading } = useCurrentUser();
  const me = useQuery(api.users.getMe, userId ? { externalId: userId } : "skip");

  if (identityLoading) return { data: null, isLoading: true };
  if (!userId) return { data: null, isLoading: false };
  if (me === undefined) return { data: null, isLoading: true };
  if (me === null) return { data: FREE_DEFAULT, isLoading: false };

  return {
    data: {
      tier: me.tier,
      currentUsageMb: me.currentUsageMb,
      storageLimitMb: me.storageLimitMb,
    },
    isLoading: false,
  };
}

/** Returns feature access based on user's tier */
export function useFeatureAccess() {
  const { data: me } = useTier();
  const tier = normalizeTier(me?.tier ?? "ANON");

  return {
    tier,
    canUseWeb: true,
    canUseCloudSync: tier === "pro" || tier === "studio",
    canExport: tier === "pro" || tier === "studio",
    canImport: tier === "pro" || tier === "studio",
    canExportCSV: tier === "studio",
    canExportPDF: tier === "studio",
    hasUnlimitedStorage: tier === "studio",
    hasUnlimitedBuilds: tier === "studio",
    hasUnlimitedConventions: tier === "studio",
  };
}
