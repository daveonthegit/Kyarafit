import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  hasAdminAccess,
  hasUnlimitedAccess,
  type Role,
} from "@kyarafit/design-system/domain/accessPolicy";

type TierInfo = {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number;
  /** App role from the server (source of truth). Defaults to "user". */
  role: Role;
  /** ms epoch of the last paid→free downgrade, or `null` if never downgraded (REQ-D96/D97). */
  downgradedAt?: number | null;
};

const FREE_DEFAULT: TierInfo = {
  tier: "FREE",
  currentUsageMb: 0,
  storageLimitMb: 50,
  role: "user",
  downgradedAt: null,
};

export function useTier(userId: string | null | undefined): {
  data: TierInfo | null;
  isLoading: boolean;
} {
  const me = useQuery(api.users.getMe, userId ? { externalId: userId } : "skip");

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

/** True when the current user is the privileged owner role (unlimited access). */
export function useIsOwner(userId: string | null | undefined): boolean {
  const { data } = useTier(userId);
  return hasUnlimitedAccess(data?.role);
}

/** True when the current user has admin access (admin OR owner). */
export function useIsAdmin(userId: string | null | undefined): boolean {
  const { data } = useTier(userId);
  return hasAdminAccess(data?.role);
}
