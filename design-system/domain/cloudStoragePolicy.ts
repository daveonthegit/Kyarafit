/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per DATA_AND_SYNC.md §9 + PRODUCT_SPEC.md
 * §3.2 (REQ-D90, REQ-021).
 *
 * Cloud-storage caps and the free-tier group-cosplay upload exception.
 * - Free cloud cap = 0 MB; Paid cloud cap = 2048 MB.
 * - Over-cap blocks NEW uploads only (never deletes) — enforced by callers using `cloudStorageCapMb`.
 * - A FREE user may cloud-host a build ONLY if it is linked to a group they actively belong to,
 *   within `FREE_GROUP_BUILD_LIMIT` builds and `FREE_GROUP_CLOUD_MB` of images.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

import { normalizeTier, isPaidTier } from "./entitlements";

export const FREE_GROUP_BUILD_LIMIT = 5;
export const FREE_GROUP_CLOUD_MB = 100;
export const PAID_CLOUD_CAP_MB = 2048;

/** MB of cloud storage allowed for a tier. Free = 0 (local-only), paid = 2048. */
export function cloudStorageCapMb(tier: string | null | undefined): number {
  return isPaidTier(normalizeTier(tier)) ? PAID_CLOUD_CAP_MB : 0;
}

export interface BuildCloudUploadInput {
  tier: string | null | undefined;
  build: { groupId?: string | null };
  /** The free user's active membership in the build's group, if any. */
  groupMembership?: { isActiveMember: boolean; groupId: string } | null;
  /** How many group builds the free user already cloud-hosts. */
  existingGroupBuildCount: number;
  /** Current group-cloud image usage (MB) for the free user. */
  currentGroupCloudMb: number;
  /** MB this upload would add. */
  addMb: number;
}

/**
 * Whether a build (and its images) may be uploaded to the cloud.
 * Paid: allowed (subject to the 2 GB cap, checked separately). Free: only the group-cosplay
 * exception, with count + MB guards.
 */
export function canUploadBuildToCloud(input: BuildCloudUploadInput): boolean {
  if (isPaidTier(normalizeTier(input.tier))) {
    return true;
  }

  const { build, groupMembership, existingGroupBuildCount, currentGroupCloudMb, addMb } = input;

  if (build.groupId == null || groupMembership == null) {
    return false;
  }

  return (
    groupMembership.isActiveMember &&
    groupMembership.groupId === build.groupId &&
    existingGroupBuildCount < FREE_GROUP_BUILD_LIMIT &&
    currentGroupCloudMb + addMb <= FREE_GROUP_CLOUD_MB
  );
}

/**
 * SPEC STUB — NOT IMPLEMENTED (REQ-D90 over-cap). Whether an upload of `addMb` keeps the user within
 * their tier's cloud cap. Over-cap blocks NEW uploads only (callers must never delete existing data).
 * At-cap with a zero-byte add is allowed.
 */
export function isWithinCloudCap(
  tier: string | null | undefined,
  currentMb: number,
  addMb: number
): boolean {
  return currentMb + addMb <= cloudStorageCapMb(tier);
}

/** Format storage size from MB to a short human-readable string (KB, MB, or GB). */
export function formatStorageMb(mb: number): string {
  if (mb < 0) return "unlimited";
  if (mb < 1 / 1024) return "< 1 KB";
  if (mb < 1) {
    const kb = Math.round(mb * 1024);
    return `${kb} KB`;
  }
  if (mb < 1000) {
    const whole = Math.floor(mb);
    const frac = mb - whole;
    if (frac < 0.01) return `${whole} MB`;
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return gb < 10 ? `${gb.toFixed(1)} GB` : `${Math.round(gb)} GB`;
}
