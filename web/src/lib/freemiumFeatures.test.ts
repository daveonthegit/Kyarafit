import { describe, it, expect } from "vitest";
import { can } from "@kyarafit/design-system/domain/entitlements";

// Spec: PRODUCT_SPEC.md §3 freemium capability matrix. These cover the remaining free/paid feature
// boundaries beyond the core set in freemiumEntitlements.test.ts. Expensive cloud features are paid;
// local productivity and cheap social interactions are free.

describe("export / import are free (REQ-012)", () => {
  it("should_allow_export_for_free_user", () => {
    expect(can("free", "export")).toBe(true);
  });
  it("should_allow_import_for_free_user", () => {
    expect(can("free", "import")).toBe(true);
  });
});

describe("public sharing is paid (REQ-017)", () => {
  it("should_block_public_share_for_free_user", () => {
    expect(can("free", "public_share")).toBe(false);
  });
  it("should_allow_public_share_for_paid_user", () => {
    expect(can("pro", "public_share")).toBe(true);
  });
});

describe("social posting is paid; interactions are free (REQ-018)", () => {
  it("should_block_feed_post_for_free_user", () => {
    expect(can("free", "social_post")).toBe(false);
  });
  it("should_allow_like_comment_follow_for_free_user", () => {
    expect(can("free", "like")).toBe(true);
    expect(can("free", "comment")).toBe(true);
    expect(can("free", "follow")).toBe(true);
  });
});

describe("group create is paid; joining is free (REQ-019)", () => {
  it("should_block_group_create_for_free_user", () => {
    expect(can("free", "group_create")).toBe(false);
  });
  it("should_allow_join_group_for_free_user", () => {
    expect(can("free", "join_group")).toBe(true);
  });
});
