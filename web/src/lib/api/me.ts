/**
 * Tier and usage from backend GET /api/v1/me.
 * Requires Authorization header (Bearer token).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface MeResponse {
  tier: string;
  currentUsageMb: number;
  storageLimitMb: number; // -1 = unlimited
}

export async function fetchMe(token: string | null): Promise<MeResponse | null> {
  if (!token) return null;
  const res = await fetch(`${API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}
