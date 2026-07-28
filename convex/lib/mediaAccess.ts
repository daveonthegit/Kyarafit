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
 * - the caller is a collaborator on the owning build.
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

/** Guard against a pathological element graph; real trees are a handful of levels deep. */
const MAX_GRAPH_NODES = 200;

async function isBuildCollaborator(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  viewerId: string
): Promise<boolean> {
  const rows = await ctx.db
    .query("buildCollaborators")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  return rows.some((r) => r.userId === viewerId);
}

/** True when the build is served to link holders and anonymous visitors by design. */
function isBuildPublic(build: Doc<"builds">): boolean {
  const visibility = build.visibility ?? "private";
  return visibility === "public" || visibility === "unlisted";
}

async function canReadBuildMedia(
  ctx: QueryCtx,
  buildId: Id<"builds">,
  viewerId: string | null
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build) return false;
  if (isBuildPublic(build)) return true;
  if (!viewerId) return false;
  if (build.userId === viewerId) return true;
  return await isBuildCollaborator(ctx, buildId, viewerId);
}

/**
 * True when the element (or any of its ancestors) is attached to a build that is
 * public by design. Public build pages render the element tree, including nested
 * descendants, so the check has to walk up the graph rather than only look at the
 * element's own build links.
 */
async function isNodeOnPublicBuild(ctx: QueryCtx, nodeId: Id<"cosplayNodes">): Promise<boolean> {
  const seen = new Set<string>([nodeId]);
  let frontier: Id<"cosplayNodes">[] = [nodeId];

  while (frontier.length > 0 && seen.size <= MAX_GRAPH_NODES) {
    const next: Id<"cosplayNodes">[] = [];
    for (const current of frontier) {
      const buildLinks = await ctx.db
        .query("buildCosplayLinks")
        .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", current))
        .collect();
      for (const link of buildLinks) {
        const build = await ctx.db.get(link.buildId);
        if (build && isBuildPublic(build)) return true;
      }

      const parentLinks = await ctx.db
        .query("cosplayNodeLinks")
        .withIndex("by_childNodeId", (q) => q.eq("childNodeId", current))
        .collect();
      for (const link of parentLinks) {
        if (seen.has(link.parentNodeId)) continue;
        seen.add(link.parentNodeId);
        next.push(link.parentNodeId);
      }
    }
    frontier = next;
  }

  return false;
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
  const build = await ctx.db
    .query("builds")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (build) return await canReadBuildMedia(ctx, build._id, viewerId);

  const referenceImage = await ctx.db
    .query("buildReferenceImages")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (referenceImage) {
    if (viewerId && referenceImage.userId === viewerId) return true;
    return await canReadBuildMedia(ctx, referenceImage.buildId, viewerId);
  }

  const processPicture = await ctx.db
    .query("buildProcessPictures")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (processPicture) {
    if (viewerId && processPicture.userId === viewerId) return true;
    return await canReadBuildMedia(ctx, processPicture.buildId, viewerId);
  }

  const node = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (node) {
    if (viewerId && node.userId === viewerId) return true;
    return await isNodeOnPublicBuild(ctx, node._id);
  }

  // Legacy closet items predate the element graph and have no public surface.
  const closetItem = await ctx.db
    .query("closetItems")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (closetItem) return viewerId != null && closetItem.userId === viewerId;

  // Conventions are private throughout the product: name, location and dates are
  // never rendered on a public surface, so neither is the cover image.
  const convention = await ctx.db
    .query("conventions")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (convention) return viewerId != null && convention.userId === viewerId;

  const user = await ctx.db
    .query("users")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (user) {
    if (user.profileVisibility === "public") return true;
    return viewerId != null && user.externalId === viewerId;
  }

  const group = await ctx.db
    .query("groups")
    .withIndex("by_imageStorageId", (q) => q.eq("imageStorageId", storageId))
    .first();
  if (group) {
    if (group.visibility === "public") return true;
    if (!viewerId) return false;
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) => q.eq("groupId", group._id).eq("userId", viewerId))
      .unique();
    return membership != null;
  }

  // Unattached blob — see the module comment. Authentication is required.
  return viewerId != null;
}
