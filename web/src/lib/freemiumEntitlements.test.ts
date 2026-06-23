import { describe, it, expect } from "vitest";
import { can, isPaidTier, normalizeTier } from "@kyarafit/design-system/domain/entitlements";

// Spec: PRODUCT_SPEC.md §3 (REQ-002, REQ-013, REQ-015). These assert the NEW freemium boundaries,
// not the current implementation. Advanced planner becomes FREE; cloud sync is the paid lever.
describe("freemium entitlements (PRODUCT_SPEC §3)", () => {
  it("should_grant_identical_access_for_pro_and_supporter", () => {
    const features = [
      "cloud_sync",
      "collab_invites",
      "public_share",
      "advanced_planner",
      "priority_support",
    ] as const;
    for (const f of features) {
      expect(can("pro", f)).toBe(can("supporter", f));
    }
  });

  it("should_keep_advanced_planner_free", () => {
    // REQ-013: advanced planner is free for everyone (changed from prior paid gating).
    expect(can("free", "advanced_planner")).toBe(true);
  });

  it("should_gate_cloud_sync_to_paid", () => {
    expect(can("free", "cloud_sync")).toBe(false);
    expect(can("pro", "cloud_sync")).toBe(true);
    expect(can("supporter", "cloud_sync")).toBe(true);
  });

  it("should_treat_pro_and_supporter_as_paid", () => {
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("supporter")).toBe(true);
  });

  it("should_normalize_legacy_tiers_to_paid", () => {
    expect(isPaidTier(normalizeTier("STUDIO"))).toBe(true);
  });
});
