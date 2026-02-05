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
