import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

type TierInfo = {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number;
  /** ms epoch of the last paid→free downgrade, or `null` if never downgraded (REQ-D96/D97). */
  downgradedAt?: number | null;
};

const FREE_DEFAULT: TierInfo = {
  tier: "FREE",
  currentUsageMb: 0,
  storageLimitMb: 50,
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
      downgradedAt: me.downgradedAt ?? null,
    },
    isLoading: false,
  };
}
