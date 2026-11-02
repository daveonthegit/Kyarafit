import { describe, it, expect } from "vitest";
import {
  resolveImageRef,
  canUseImageRefKind,
  allowedImageSourcesForTier,
  type ImageRef,
} from "@kyarafit/design-system/domain/imageRef";

/**
 * Shared ImageRef resolver + tier policy (PRODUCT_SPEC.md §3.1 + §4.2, REQ-011/016). The contract is
 * platform-agnostic so web and mobile resolve/gate images identically:
 *   - free → external URL + on-device local only (no cloud upload);
 *   - paid → URL + local + cloud (Convex storage).
 */
describe("resolveImageRef", () => {
  it("should_resolve_url_local_cloud_refs", () => {
    const url: ImageRef = { kind: "url", url: "https://example.com/a.png" };
    const local: ImageRef = { kind: "local", uri: "file:///img/b.png", imageKey: "k1" };
    const cloud: ImageRef = { kind: "cloud", storageId: "stor_1", imageKey: "k2" };

    expect(resolveImageRef(url)).toEqual({
      imageUrl: "https://example.com/a.png",
      imageStorageId: null,
    });
    expect(resolveImageRef(local)).toEqual({ imageUrl: "file:///img/b.png", imageStorageId: null });
    expect(resolveImageRef(cloud)).toEqual({ imageUrl: null, imageStorageId: "stor_1" });
    expect(resolveImageRef(null)).toEqual({ imageUrl: null, imageStorageId: null });
    expect(resolveImageRef(undefined)).toEqual({ imageUrl: null, imageStorageId: null });
  });
});

describe("canUseImageRefKind / allowedImageSourcesForTier", () => {
  it("should_allow_local_and_url_for_free_user", () => {
    expect(canUseImageRefKind("FREE", "url")).toBe(true);
    expect(canUseImageRefKind("FREE", "local")).toBe(true);
    expect(allowedImageSourcesForTier("FREE")).toEqual(["url", "local"]);
  });

  it("should_block_cloud_for_free_user", () => {
    expect(canUseImageRefKind("FREE", "cloud")).toBe(false);
    expect(allowedImageSourcesForTier("FREE")).not.toContain("cloud");
  });

  it("should_allow_cloud_for_paid_user", () => {
    for (const tier of ["PRO", "SUPPORTER"]) {
      expect(canUseImageRefKind(tier, "cloud")).toBe(true);
      expect(canUseImageRefKind(tier, "url")).toBe(true);
      expect(canUseImageRefKind(tier, "local")).toBe(true);
      expect(allowedImageSourcesForTier(tier)).toEqual(["url", "local", "cloud"]);
    }
  });
});
