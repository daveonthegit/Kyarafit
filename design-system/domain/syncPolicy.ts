/**
 * Sync worker gating policy (DATA_AND_SYNC.md §6, REQ-D60).
 *
 * The background sync worker is a paid, cloud feature: it runs ONLY for a signed-in
 * user on a paid tier. Tier normalization / paid detection is reused from
 * `subscriptionTierPolicy` so this stays consistent with Convex + entitlements.
 */
import { isPaidConvexTier } from "./subscriptionTierPolicy";

/**
 * Whether the background sync worker should run.
 *
 * Returns true only when the user is signed in AND on a paid tier (PRO, SUPPORTER,
 * or a legacy paid tier such as STUDIO). Free, null, undefined, or unknown tiers
 * (regardless of case) return false.
 */
export function shouldRunSyncWorker(tier: string | null | undefined, signedIn: boolean): boolean {
  return signedIn && isPaidConvexTier(tier);
}
