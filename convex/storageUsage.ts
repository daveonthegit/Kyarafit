/**
 * Helpers to track user storage usage (currentUsageMb) when files are
 * attached to or removed from entities (closetItems, builds, conventions,
 * buildReferenceImages, buildProcessPictures).
 */
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { effectiveStorageLimitMb } from "@kyarafit/design-system/domain/accessPolicy";

const BYTES_PER_MB = 1024 * 1024;

/** Get file size in MB from Convex storage metadata. Returns 0 if missing. */
export async function getStorageSizeMb(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<number> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta || typeof meta.size !== "number") return 0;
  return meta.size / BYTES_PER_MB;
}

/** Add deltaMb to user's currentUsageMb (externalId = Better Auth subject). Clamps to >= 0. */
export async function addUsageDelta(
  ctx: MutationCtx,
  externalId: string,
  deltaMb: number
): Promise<void> {
  if (deltaMb === 0) return;
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
  if (!user) return;
  const next = Math.max(0, user.currentUsageMb + deltaMb);
  await ctx.db.patch(user._id, { currentUsageMb: next });
}

/**
 * If storageId is set, get its size in MB, check user is under limit, add to usage.
 * Throws if over limit. Call when attaching a new file to an entity.
 */
export async function checkLimitAndAddUsage(
  ctx: MutationCtx,
  externalId: string,
  storageId: Id<"_storage">
): Promise<void> {
  const sizeMb = await getStorageSizeMb(ctx, storageId);
  if (sizeMb <= 0) return;

  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
    .unique();
  if (!user) return;

  // Role-aware, enforced from the DB row: owners get the unlimited sentinel cap (never trusted from
  // client input). Everyone else keeps their tier's bounded cap.
  const limitMb = effectiveStorageLimitMb(user.tier, user.role);
  if (limitMb >= 0 && user.currentUsageMb + sizeMb > limitMb) {
    throw new Error(
      `Storage limit reached (${user.currentUsageMb.toFixed(1)} / ${limitMb} MB). Upgrade to upload more.`
    );
  }

  await ctx.db.patch(user._id, {
    currentUsageMb: user.currentUsageMb + sizeMb,
  });
}

/**
 * Subtract usage for a storage ID (e.g. when removing or replacing an image).
 * Call before deleting the entity or before replacing imageStorageId.
 */
export async function subtractUsageForStorageId(
  ctx: MutationCtx,
  externalId: string,
  storageId: Id<"_storage"> | undefined
): Promise<void> {
  if (!storageId) return;
  const sizeMb = await getStorageSizeMb(ctx, storageId);
  if (sizeMb > 0) await addUsageDelta(ctx, externalId, -sizeMb);
}
