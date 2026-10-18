import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  hasBuildRelationship,
  sharesAnyGroup,
  isGroupMember,
  someAncestorBuild,
} from "./buildAccess";

/** All references, including tombstones, so private/deleted assets never become pending previews. */
export async function storageReferences(ctx: QueryCtx, storageId: Id<"_storage">) {
  const builds = await ctx.db
    .query("builds")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const nodes = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const references = await ctx.db
    .query("buildReferenceImages")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const pictures = await ctx.db
    .query("buildProcessPictures")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const conventions = await ctx.db
    .query("conventions")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const closet = await ctx.db
    .query("closetItems")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const users = await ctx.db
    .query("users")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  const indexed = await ctx.db
    .query("progressMediaReferences")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .collect();
  const progress = (await Promise.all(indexed.map((r) => ctx.db.get(r.progressUpdateId)))).filter(
    (r) => r !== null
  );
  // Compatibility bridge for installed data, not an authorization backfill. New writes maintain
  // the reverse index. Only unindexed legacy rows enter the read set; the bounded
  // files.indexLegacyProgress job drains this bridge before high-volume deployment.
  const legacy = await ctx.db
    .query("buildProgressUpdates")
    .withIndex("by_mediaIndexed", (q) => q.eq("mediaIndexed", undefined))
    .collect();
  progress.push(
    ...legacy.filter((row) =>
      row.imageRefs.some((ref) => ref.kind === "cloud" && ref.storageId === storageId)
    )
  );
  return { builds, nodes, references, pictures, conventions, closet, users, groups, progress };
}

export type StorageReferences = Awaited<ReturnType<typeof storageReferences>>;
export function hasLiveReferences(refs: StorageReferences): boolean {
  return Object.values(refs).some((rows) =>
    rows.some((row) => !("deletedAt" in row) || row.deletedAt == null)
  );
}

/** Readable public bytes are NOT permission to attach somebody else's asset. */
export async function canAttachReferencedStorage(
  ctx: QueryCtx,
  refs: StorageReferences,
  actorId: string
): Promise<boolean> {
  for (const build of refs.builds) {
    if (build.deletedAt == null && (await hasBuildRelationship(ctx, build, actorId))) return true;
  }
  for (const node of refs.nodes) {
    if (node.deletedAt != null) continue;
    if (
      node.userId === actorId ||
      (await someAncestorBuild(ctx, node._id, (b) => hasBuildRelationship(ctx, b, actorId)))
    )
      return true;
  }
  for (const row of [...refs.references, ...refs.pictures, ...refs.progress]) {
    if (row.deletedAt != null) continue;
    if (row.userId === actorId) return true;
    const build = await ctx.db.get(row.buildId);
    if (build && build.deletedAt == null && (await hasBuildRelationship(ctx, build, actorId)))
      return true;
  }
  if (
    [...refs.conventions, ...refs.closet].some((r) => r.deletedAt == null && r.userId === actorId)
  )
    return true;
  for (const user of refs.users) {
    if (user.externalId === actorId || (await sharesAnyGroup(ctx, actorId, user.externalId)))
      return true;
  }
  for (const group of refs.groups) if (await isGroupMember(ctx, group._id, actorId)) return true;
  return false;
}

/** Own references are used for the legacy accounting bridge, never to claim unknown blobs. */
export function hasOwnLiveReference(refs: StorageReferences, actorId: string): boolean {
  return ownLiveReferenceCount(refs, actorId) > 0;
}

export function ownLiveReferenceCount(refs: StorageReferences, actorId: string): number {
  return Object.values(refs).reduce(
    (count, rows) =>
      count +
      rows.filter(
        (row) =>
          (!("deletedAt" in row) || row.deletedAt == null) &&
          (("userId" in row && row.userId === actorId) ||
            ("externalId" in row && row.externalId === actorId) ||
            ("createdBy" in row && row.createdBy === actorId))
      ).length,
    0
  );
}
