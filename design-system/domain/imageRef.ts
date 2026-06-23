/**
 * Shared, platform-agnostic image-reference contract (PRODUCT_SPEC.md §3.1 + §4.2, REQ-011/016/021;
 * DATA_AND_SYNC.md §7, REQ-D70). This is the keystone image layer: web and mobile both resolve and
 * gate images through these helpers so the two platforms cannot drift.
 *
 * An `ImageRef` is a discriminated union describing WHERE an image's binary lives. It mirrors the
 * backend `imageRefValidator` (`convex/lib/imageRef.ts`) field-for-field:
 *
 *   - `{ kind: "url",   url }`                 → external URL (free + paid).
 *   - `{ kind: "local", uri, imageKey }`       → on-device file/blob, the FREE durable home (free + paid).
 *   - `{ kind: "cloud", storageId, imageKey }` → Convex storage, the PAID backup/cache (paid only).
 *
 * Freemium rule (REQ-011/016): free users may reference external URLs and store images locally
 * on-device indefinitely (included in export); NO cloud upload happens for free users. Paid users
 * additionally upload to cloud (Convex storage), subject to the 2 GB cap (cloudStoragePolicy).
 *
 * This module is PURE: no platform / native / React dependencies. The per-platform local stores
 * (web IndexedDB, mobile FileSystem) and the cloud upload path live in the app packages and produce
 * the `ImageRef` values that flow back here for resolution.
 */
import { can, normalizeTier, type Tier } from "./entitlements";

/** Where an image's binary lives. Matches `convex/lib/imageRef.ts` exactly. */
export type ImageRef =
  | { kind: "url"; url: string }
  | { kind: "local"; uri: string; imageKey: string }
  | { kind: "cloud"; storageId: string; imageKey: string };

/** The three discriminants of an `ImageRef`. */
export type ImageRefKind = ImageRef["kind"];

export const IMAGE_REF_KINDS: readonly ImageRefKind[] = ["url", "local", "cloud"] as const;

/** What an image component consumes: either a direct URL, or a Convex storage id to resolve. */
export interface ResolvedImageRef {
  /** Direct displayable URL (external URL or on-device uri), or null when none. */
  imageUrl: string | null;
  /** Convex `_storage` id to resolve to a signed URL on the client, or null when none. */
  imageStorageId: string | null;
}

/**
 * Resolve an `ImageRef` onto the `{ imageUrl, imageStorageId }` an image component consumes.
 * Generalizes mobile's `elementImageSource` so every surface resolves images identically.
 *   - `url`   → imageUrl = url
 *   - `local` → imageUrl = uri (device file/blob/object-URL)
 *   - `cloud` → imageStorageId = storageId (resolved to a signed URL by the platform image component)
 */
export function resolveImageRef(ref: ImageRef | null | undefined): ResolvedImageRef {
  if (!ref) return { imageUrl: null, imageStorageId: null };
  if (ref.kind === "url") return { imageUrl: ref.url, imageStorageId: null };
  if (ref.kind === "local") return { imageUrl: ref.uri, imageStorageId: null };
  return { imageUrl: null, imageStorageId: ref.storageId };
}

/**
 * Whether a tier may use a given `ImageRef` kind (REQ-011/016):
 *   - free → `url` + `local` only (no cloud upload).
 *   - paid → `url` + `local` + `cloud`.
 *
 * `cloud` is gated by the same paid lever as cloud sync (`can(tier, "cloud_sync")`); the
 * group-cosplay free exception (REQ-021) is enforced separately by `cloudStoragePolicy`, not here.
 */
export function canUseImageRefKind(
  tier: Tier | string | null | undefined,
  kind: ImageRefKind
): boolean {
  const normalized = normalizeTier(typeof tier === "string" ? tier : (tier ?? null));
  if (kind === "url" || kind === "local") return true;
  return can(normalized, "cloud_sync");
}

/**
 * Which attach options to surface for a tier, in display order. Free users get `url` + `local`;
 * paid users additionally get `cloud`. Callers render one affordance per returned kind.
 */
export function allowedImageSourcesForTier(tier: Tier | string | null | undefined): ImageRefKind[] {
  return IMAGE_REF_KINDS.filter((kind) => canUseImageRefKind(tier, kind));
}

/** Construct a `url` ImageRef. */
export function urlImageRef(url: string): Extract<ImageRef, { kind: "url" }> {
  return { kind: "url", url };
}

/** Construct a `local` ImageRef. */
export function localImageRef(uri: string, imageKey: string): Extract<ImageRef, { kind: "local" }> {
  return { kind: "local", uri, imageKey };
}

/** Construct a `cloud` ImageRef. */
export function cloudImageRef(
  storageId: string,
  imageKey: string
): Extract<ImageRef, { kind: "cloud" }> {
  return { kind: "cloud", storageId, imageKey };
}
