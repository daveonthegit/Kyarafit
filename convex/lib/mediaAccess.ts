import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  hasBuildRelationship,
  isBuildPublic,
  isGroupMember,
  sharesAnyGroup,
  someAncestorBuild,
} from "./buildAccess";
import { storageReferences } from "./storageReferences";
import { storageClaim } from "./storageOwnership";
import { deletionJob } from "./deletionReferences";

/**
 * Authorization applies to discovery, not capability-byte serving. Any live reference can grant
 * discovery (duplicates/shared thumbnails). Private progress images do NOT inherit public-build
 * visibility: only explicit feed publication, ownership, or a collaborator/group relationship.
 * A pending blob is discoverable only by its verified uploader, until attachment or expiry.
 */
export async function canReadStorageId(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  viewerId: string | null
): Promise<boolean> {
  if (viewerId) {
    const subject = viewerId;
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", subject))
      .unique();
    if (!user) viewerId = null;
  }
  const accounts = new Map<string, Promise<boolean>>();
  const active = (subject: string) => {
    let checked = accounts.get(subject);
    if (!checked) {
      checked = deletionJob(ctx, subject).then((job) => !job);
      accounts.set(subject, checked);
    }
    return checked;
  };
  const refs = await storageReferences(ctx, storageId);
  const claim = await storageClaim(ctx, storageId);
  for (const build of refs.builds) {
    if (!(await active(build.userId))) continue;
    if (
      build.deletedAt == null &&
      (isBuildPublic(build) || (await hasBuildRelationship(ctx, build, viewerId)))
    )
      return true;
  }
  for (const row of [...refs.references, ...refs.pictures]) {
    if (row.deletedAt != null || !(await active(row.userId))) continue;
    if (viewerId && row.userId === viewerId) return true;
    const build = await ctx.db.get(row.buildId);
    if (
      build &&
      build.deletedAt == null &&
      (await active(build.userId)) &&
      (isBuildPublic(build) || (await hasBuildRelationship(ctx, build, viewerId)))
    )
      return true;
  }
  for (const node of refs.nodes) {
    if (node.deletedAt != null || !(await active(node.userId))) continue;
    if (viewerId && node.userId === viewerId) return true;
    if (
      await someAncestorBuild(
        ctx,
        node._id,
        async (build) =>
          build.deletedAt == null &&
          (await active(build.userId)) &&
          (isBuildPublic(build) || (await hasBuildRelationship(ctx, build, viewerId)))
      )
    )
      return true;
  }
  if (
    viewerId &&
    [...refs.closet, ...refs.conventions].some(
      (row) => row.deletedAt == null && row.userId === viewerId
    )
  )
    return true;
  for (const user of refs.users) {
    if (!(await active(user.externalId))) continue;
    if (user.profileVisibility === "public") return true;
    if (
      viewerId &&
      (user.externalId === viewerId || (await sharesAnyGroup(ctx, viewerId, user.externalId)))
    )
      return true;
  }
  for (const group of refs.groups) {
    if (!(await active(group.createdBy))) continue;
    if (
      group.visibility === "public" ||
      (viewerId && (await isGroupMember(ctx, group._id, viewerId)))
    )
      return true;
  }
  for (const row of refs.progress) {
    if (row.deletedAt != null || !(await active(row.userId))) continue;
    if (row.publishedToFeed || (viewerId && row.userId === viewerId)) return true;
    const build = await ctx.db.get(row.buildId);
    if (
      viewerId &&
      build &&
      build.deletedAt == null &&
      (await hasBuildRelationship(ctx, build, viewerId))
    )
      return true;
  }
  // Even a tombstone counts as a reference: never reopen it as a pending preview.
  if (Object.values(refs).some((rows) => rows.length > 0)) return false;
  return !!(
    viewerId &&
    claim?.userId === viewerId &&
    !claim.attached &&
    claim.expiresAt > Date.now()
  );
}
