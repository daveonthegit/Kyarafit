"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { normalizeTier, isPaidTier } from "@kyarafit/design-system/domain/entitlements";
import {
  hasAdminAccess,
  hasUnlimitedAccess,
  type Role,
} from "@kyarafit/design-system/domain/accessPolicy";

export interface MeResponse {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number;
  /** App role from the server (source of truth). Defaults to "user". */
  role: Role;
  /** ms epoch of the last paid→free downgrade, or `null` if never downgraded (REQ-D96/D97). */
  downgradedAt?: number | null;
}

const FREE_DEFAULT: MeResponse = {
  tier: "FREE",
  currentUsageMb: 0,
  storageLimitMb: 50,
  role: "user",
  downgradedAt: null,
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
      role: (me.role ?? "user") as Role,
      downgradedAt: me.downgradedAt ?? null,
    },
    isLoading: false,
  };
}

/**
 * Returns feature access based on user's tier.
 *
 * Single source of truth for gating. Paid features are gated by `isPaid` (PRO or SUPPORTER —
 * identical access), not by a specific tier. Export/import is FREE for everyone; automatic
 * cloud sync is the paid lever. There are no build/convention count limits.
 */
export function useFeatureAccess() {
  const { data: me } = useTier();
  const tier = normalizeTier(me?.tier ?? "ANON");
  // getMe already returns the EFFECTIVE tier (owners surface as SUPPORTER), so `isPaid` is true for
  // owners without any extra handling here — do NOT double-apply the role.
  const isPaid = isPaidTier(tier);
  const role = me?.role ?? "user";
  const isOwner = hasUnlimitedAccess(role);
  const isAdmin = hasAdminAccess(role);

  return {
    tier,
    isPaid,
    isOwner,
    isAdmin,
    canUseWeb: true,
    // Paid lever: continuous cloud sync + multi-device.
    canUseCloudSync: isPaid,
    canCollaborate: isPaid,
    canUseAdvancedPlanner: isPaid,
    hasPrioritySupport: isPaid,
    // Free for everyone — manual portability that paid sync replaces.
    canExport: true,
    canImport: true,
  };
}
