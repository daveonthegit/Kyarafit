import * as Linking from "expo-linking";
import { authClient, setStoredBearerToken } from "./client";
import { EXPO_PUBLIC_CONVEX_SITE_URL } from "@/config/env";

/** Exchange ?ott= from an OAuth redirect URL for a bearer session (cross-domain plugin). */
export async function verifyOneTimeTokenFromUrl(incomingUrl: string): Promise<boolean> {
  if (!EXPO_PUBLIC_CONVEX_SITE_URL) return false;
  const parsed = Linking.parse(incomingUrl);
  const ott = parsed.queryParams?.ott;
  if (!ott || typeof ott !== "string") return false;

  try {
    const res = await fetch(
      `${EXPO_PUBLIC_CONVEX_SITE_URL.replace(/\/$/, "")}/auth/cross-domain/one-time-token/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ott }),
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const sessionToken: string | undefined = data?.session?.token;
    if (!sessionToken) return false;
    await setStoredBearerToken(sessionToken);
    await authClient.getSession({
      fetchOptions: { headers: { Authorization: `Bearer ${sessionToken}` } },
    });
    const signal = (
      authClient as { $sessionSignal?: { get: () => boolean; set: (v: boolean) => void } }
    ).$sessionSignal;
    if (signal) {
      const val = signal.get();
      signal.set(!val);
    }
    return true;
  } catch {
    return false;
  }
}
