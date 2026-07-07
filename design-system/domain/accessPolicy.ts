/**
 * App-role access policy (shared with Convex + web + mobile).
 *
 * Roles live on the Convex `users.role` column and are the SERVER-SIDE source of truth. They are
 * NEVER trusted from client input — every server gate loads the caller's `users` row and reads
 * `role` from there. The client only mirrors the role for UX (showing admin/owner affordances).
 *
 * - `"user"`  — normal user; access governed entirely by `tier` (FREE / PRO / SUPPORTER).
 * - `"admin"` — admin/broadcast APIs (see `convex/admin.ts`); tier still governs paid features.
 * - `"owner"` — UNLIMITED access: all paid features + unlimited storage + admin. A privileged role an
 *   owner grants to themselves (bootstrapped via `users.setUserRole`) and to anyone they choose
 *   (via `users.grantRole`). Owner is a superset of admin.
 *
 * The helpers here are pure so the same access decision can be unit-tested and reused everywhere.
 */
import {
  convexTierStorageLimitMb,
  isPaidConvexTier,
  normalizeConvexTier,
  type ConvexTier,
} from "./subscriptionTierPolicy";

export type Role = "user" | "admin" | "owner";

/**
 * Sentinel "unlimited" storage cap for owners. A large FINITE number (not `Infinity`/-1) so the
 * ordinary `usage + size <= cap` arithmetic in the storage enforcer stays well-defined and an owner
 * simply never realistically reaches it (1 TB expressed in MB).
 */
export const UNLIMITED_STORAGE_LIMIT_MB = 1_000_000;

/** True only for the owner role — the unlimited, all-access role. */
export function hasUnlimitedAccess(role: Role | undefined | null): boolean {
  return role === "owner";
}

/** True for admin OR owner — the gate for admin/broadcast APIs. Owner is a superset of admin. */
export function hasAdminAccess(role: Role | undefined | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * The tier the server/client should treat this user as having. Owners are always the top paid tier
 * (`SUPPORTER`); everyone else keeps their normalized subscription tier.
 */
export function effectiveConvexTier(
  tier: string | undefined | null,
  role: Role | undefined | null
): ConvexTier {
  if (hasUnlimitedAccess(role)) return "SUPPORTER";
  return normalizeConvexTier(tier);
}

/**
 * The storage cap (MB) to enforce for this user. Owners get the unlimited sentinel; everyone else
 * gets their tier's bounded cap.
 */
export function effectiveStorageLimitMb(
  tier: string | undefined | null,
  role: Role | undefined | null
): number {
  if (hasUnlimitedAccess(role)) return UNLIMITED_STORAGE_LIMIT_MB;
  return convexTierStorageLimitMb(tier ?? "");
}

/** Whether this user has paid access: owners always do; otherwise it's driven by tier. */
export function hasPaidAccess(
  tier: string | undefined | null,
  role: Role | undefined | null
): boolean {
  return hasUnlimitedAccess(role) || isPaidConvexTier(tier);
}
