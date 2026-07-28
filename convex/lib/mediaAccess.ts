/**
 * Ownership/visibility check for Convex storage ids, used by `files.getUrl`.
 *
 * Storage ids are not a security boundary: they are returned on builds, elements,
 * conventions, reference images, process pictures, group and user rows, so anyone
 * who can read one of those rows learns the id. `getUrl` therefore has to decide
 * for itself whether the caller may see the blob.
 *
 * The rule is "resolve the storage id back to the row that references it, then
 * apply that row's visibility". This is deliberately the existing access model
 * expressed for blobs — it does not introduce a new one. The blob is readable when:
 *
 * - the caller owns the referencing row; or
 * - the referencing row is reachable through a surface that is public by design
 *   (a `public` or `unlisted` build and its reference/process images and element
 *   images, a `public` profile, a `public` group); or
 *   `unlisted` is treated as readable to match `getPublicViewerBundle`, which
 *   serves unlisted builds to anonymous share-link holders that then resolve each
 *   image through `getUrl` without a token.
 * - the caller is related to the owning build — collaborator or member of the group
 *   the build was shared into (`lib/buildAccess.hasBuildRelationship`), which is the
 *   same set of callers that can read the build itself through `builds.get`; or
 * - for a profile picture, the caller shares a group with that user, because the
 *   group roster renders every member's avatar.
 *
 * A storage id can be referenced by more than one row: `builds.duplicate` copies
 * `imageStorageId` onto the new (private) build and clones the reference-image and
 * process-picture rows verbatim. So every referencing row is considered, and access
 * is granted when *any* of them grants it. A blob that is referenced but by no row
 * that grants access is denied — it must not fall through to the unattached-blob
 * rule below.
 *
 * A blob that no row references is readable by any *authenticated* caller. That
 * is required by the creation flow: every "new build/convention/element" modal
 * uploads first and previews the blob via `getUrl` before the owning row exists,
 * so a strict deny would break image upload in all four modals. It is a known,
 * documented residual — narrowing it needs an owner-indexed media table, which is
 * part of the open media-access-model decision and out of scope here.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  hasBuildRelationship,
  isBuildPublic,
  isGroupMember,
  sharesAnyGroup,
  someAncestorBuild,
} from "./buildAccess";

async function canReadBuildMedia(
  ctx: QueryCtx,
  build: Doc<"builds">,
  viewerId: string | null
): Promise<boolean> {
  if (isBuildPublic(build)) return true;
  return await hasBuildRelationship(ctx, build, viewerId);
}

async function canReadBuildMediaById(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  viewerId: string | null
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build) return false;
  return await canReadBuildMedia(ctx, build, viewerId);
}

/**
 * True when the element (or any of its ancestors) hangs off a build that is public
 * by design, or off one the viewer is related to. Public build pages render the
 * element tree including nested descendants, and so does the authenticated
 * explorer, so the check walks up the graph rather than only looking at the
 * element's own build links.
 */
async function canReadNodeMedia(
  ctx: QueryCtx,
  nodeId: Id<"cosplayNodes">,
  viewerId: string | null
): Promise<boolean> {
  return await someAncestorBuild(ctx, nodeId, async (build) => {
    if (isBuildPublic(build)) return true;
    return await hasBuildRelationship(ctx, build, viewerId);
  });
}

/**
 * Whether `viewerId` (null when unauthenticated) may resolve `storageId` to a URL.
 * See the module comment for the rule and its one documented residual.
 */
export async function canReadStorageId(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  viewerId: string | null
): Promise<boolean> {
  let referenced = false;

  const builds = await ctx.db
    .query("builds")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= builds.length > 0;
  for (const build of builds) {
    if (await canReadBuildMedia(ctx, build, viewerId)) return true;
  }

  const referenceImages = await ctx.db
    .query("buildReferenceImages")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= referenceImages.length > 0;
  for (const referenceImage of referenceImages) {
    if (viewerId && referenceImage.userId === viewerId) return true;
    if (await canReadBuildMediaById(ctx, referenceImage.buildId, viewerId)) return true;
  }

  const processPictures = await ctx.db
    .query("buildProcessPictures")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= processPictures.length > 0;
  for (const processPicture of processPictures) {
    if (viewerId && processPicture.userId === viewerId) return true;
    if (await canReadBuildMediaById(ctx, processPicture.buildId, viewerId)) return true;
  }

  const nodes = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= nodes.length > 0;
  for (const node of nodes) {
    if (viewerId && node.userId === viewerId) return true;
    if (await canReadNodeMedia(ctx, node._id, viewerId)) return true;
  }

  // Legacy closet items predate the element graph and have no public surface.
  const closetItems = await ctx.db
    .query("closetItems")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= closetItems.length > 0;
  if (viewerId && closetItems.some((item) => item.userId === viewerId)) return true;

  // Conventions are private throughout the product: name, location and dates are
  // never rendered on a public surface, so neither is the cover image.
  const conventions = await ctx.db
    .query("conventions")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= conventions.length > 0;
  if (viewerId && conventions.some((convention) => convention.userId === viewerId)) return true;

  const users = await ctx.db
    .query("users")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= users.length > 0;
  for (const user of users) {
    if (user.profileVisibility === "public") return true;
    if (!viewerId) continue;
    if (user.externalId === viewerId) return true;
    // The group roster renders every member's avatar, and `profileVisibility` is
    // unset by default, so co-membership has to grant the avatar.
    if (await sharesAnyGroup(ctx, viewerId, user.externalId)) return true;
  }

  const groups = await ctx.db
    .query("groups")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .collect();
  referenced ||= groups.length > 0;
  for (const group of groups) {
    if (group.visibility === "public") return true;
    if (viewerId && (await isGroupMember(ctx, group._id, viewerId))) return true;
  }

  // Referenced, but by no row that grants access.
  if (referenced) return false;

  // Unattached blob — see the module comment. Authentication is required.
  return viewerId != null;
}
