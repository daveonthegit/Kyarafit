import { describe, it, expect } from "vitest";
import {
  cloudStorageCapMb,
  canUploadBuildToCloud,
  isWithinCloudCap,
  FREE_GROUP_BUILD_LIMIT,
  FREE_GROUP_CLOUD_MB,
  type BuildCloudUploadInput,
} from "@kyarafit/design-system/domain/cloudStoragePolicy";

// Spec: DATA_AND_SYNC.md §9 (REQ-D90) + PRODUCT_SPEC.md §3.2 (REQ-021).
describe("cloudStorageCapMb (REQ-D90)", () => {
  it("should_set_free_cloud_cap_to_zero", () => {
    expect(cloudStorageCapMb("FREE")).toBe(0);
  });

  it("should_set_paid_cloud_cap_2048", () => {
    expect(cloudStorageCapMb("PRO")).toBe(2048);
    expect(cloudStorageCapMb("SUPPORTER")).toBe(2048);
  });
});

function base(overrides: Partial<BuildCloudUploadInput> = {}): BuildCloudUploadInput {
  return {
    tier: "FREE",
    build: { groupId: "g1" },
    groupMembership: { isActiveMember: true, groupId: "g1" },
    existingGroupBuildCount: 0,
    currentGroupCloudMb: 0,
    addMb: 1,
    ...overrides,
  };
}

describe("canUploadBuildToCloud (REQ-021)", () => {
  it("should_allow_group_cosplay_build_to_cloud_for_free_member", () => {
    expect(canUploadBuildToCloud(base())).toBe(true);
  });

  it("should_block_non_group_build_cloud_for_free_user", () => {
    expect(canUploadBuildToCloud(base({ build: { groupId: null }, groupMembership: null }))).toBe(
      false
    );
  });

  it("should_block_when_free_user_is_not_active_member", () => {
    expect(
      canUploadBuildToCloud(base({ groupMembership: { isActiveMember: false, groupId: "g1" } }))
    ).toBe(false);
  });

  it("should_block_when_membership_group_differs_from_build_group", () => {
    expect(
      canUploadBuildToCloud(base({ groupMembership: { isActiveMember: true, groupId: "other" } }))
    ).toBe(false);
  });

  it("should_enforce_group_build_count_limit", () => {
    expect(canUploadBuildToCloud(base({ existingGroupBuildCount: FREE_GROUP_BUILD_LIMIT }))).toBe(
      false
    );
  });

  it("should_enforce_group_cloud_mb_limit", () => {
    expect(
      canUploadBuildToCloud(base({ currentGroupCloudMb: FREE_GROUP_CLOUD_MB, addMb: 1 }))
    ).toBe(false);
  });

  it("should_allow_paid_user_build_upload", () => {
    expect(
      canUploadBuildToCloud(base({ tier: "PRO", build: { groupId: null }, groupMembership: null }))
    ).toBe(true);
  });
});

describe("isWithinCloudCap (REQ-D90 over-cap blocks uploads only)", () => {
  it("should_allow_paid_upload_within_cap", () => {
    expect(isWithinCloudCap("PRO", 1000, 100)).toBe(true);
  });

  it("should_block_paid_upload_that_exceeds_cap", () => {
    expect(isWithinCloudCap("PRO", 2048, 1)).toBe(false);
  });

  it("should_allow_zero_byte_add_when_exactly_at_cap", () => {
    expect(isWithinCloudCap("PRO", 2048, 0)).toBe(true);
  });

  it("should_block_any_free_upload_since_free_cap_is_zero", () => {
    expect(isWithinCloudCap("FREE", 0, 1)).toBe(false);
  });
});
