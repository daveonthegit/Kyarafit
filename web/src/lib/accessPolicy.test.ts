import { describe, it, expect } from "vitest";
import {
  UNLIMITED_STORAGE_LIMIT_MB,
  effectiveConvexTier,
  effectiveStorageLimitMb,
  hasAdminAccess,
  hasPaidAccess,
  hasUnlimitedAccess,
} from "@kyarafit/design-system/domain/accessPolicy";

// The owner role grants UNLIMITED access (all paid features + unlimited storage + admin). These pure
// helpers are the single source of truth for that decision; server gates load `role` from the DB row.
describe("accessPolicy owner role", () => {
  it("should_treat_only_owner_as_unlimited", () => {
    expect(hasUnlimitedAccess("owner")).toBe(true);
    expect(hasUnlimitedAccess("admin")).toBe(false);
    expect(hasUnlimitedAccess("user")).toBe(false);
    expect(hasUnlimitedAccess(undefined)).toBe(false);
    expect(hasUnlimitedAccess(null)).toBe(false);
  });

  it("should_treat_owner_and_admin_as_admin", () => {
    expect(hasAdminAccess("owner")).toBe(true);
    expect(hasAdminAccess("admin")).toBe(true);
    expect(hasAdminAccess("user")).toBe(false);
    expect(hasAdminAccess(undefined)).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
  });

  it("should_report_owner_as_top_paid_tier_regardless_of_tier", () => {
    expect(effectiveConvexTier("FREE", "owner")).toBe("SUPPORTER");
    expect(effectiveConvexTier(undefined, "owner")).toBe("SUPPORTER");
    // Non-owners keep their normalized tier.
    expect(effectiveConvexTier("FREE", "admin")).toBe("FREE");
    expect(effectiveConvexTier("FREE", "user")).toBe("FREE");
    expect(effectiveConvexTier("PRO", "user")).toBe("PRO");
    expect(effectiveConvexTier("SUPPORTER", undefined)).toBe("SUPPORTER");
  });

  it("should_give_owner_unlimited_storage_and_others_their_cap", () => {
    expect(effectiveStorageLimitMb("FREE", "owner")).toBe(UNLIMITED_STORAGE_LIMIT_MB);
    expect(effectiveStorageLimitMb(undefined, "owner")).toBe(UNLIMITED_STORAGE_LIMIT_MB);
    // Non-owners: bounded caps (FREE 50, PRO/SUPPORTER 2048).
    expect(effectiveStorageLimitMb("FREE", "user")).toBe(50);
    expect(effectiveStorageLimitMb("FREE", "admin")).toBe(50);
    expect(effectiveStorageLimitMb("PRO", "user")).toBe(2048);
    expect(effectiveStorageLimitMb("SUPPORTER", "user")).toBe(2048);
  });

  it("should_treat_owner_and_paid_tiers_as_paid_but_not_free_non_owners", () => {
    // Owner is paid regardless of tier.
    expect(hasPaidAccess("FREE", "owner")).toBe(true);
    // Admin/user follow their tier.
    expect(hasPaidAccess("FREE", "admin")).toBe(false);
    expect(hasPaidAccess("FREE", "user")).toBe(false);
    expect(hasPaidAccess("PRO", "user")).toBe(true);
    expect(hasPaidAccess("SUPPORTER", "user")).toBe(true);
    expect(hasPaidAccess(undefined, undefined)).toBe(false);
  });

  it("should_keep_unlimited_sentinel_a_safe_large_finite_number", () => {
    expect(Number.isFinite(UNLIMITED_STORAGE_LIMIT_MB)).toBe(true);
    // Comfortably above the paid cap so an owner never realistically reaches it.
    expect(UNLIMITED_STORAGE_LIMIT_MB).toBeGreaterThan(2048);
  });
});
