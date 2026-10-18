/**
 * Build permission predicates.
 *
 * `userId` here is the **acting** user and must always come from
 * `lib/authz.requireIdentity`, never from a mutation argument. These functions
 * only compare the resource owner against whatever id they are handed, so passing
 * a caller-supplied id satisfies them for any build.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { deletionJob } from "./accountDeletion";

/** Guard against a pathological element graph; real trees are a handful of levels deep. */
const MAX_GRAPH_NODES = 200;

/** Returns true if the user can edit the build (owner or collaborator with role editor). */
export async function canUserEditBuild(
  ctx: QueryCtx | MutationCtx,
  buildId: Id<"builds">,
  userId: string
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build || (await deletionJob(ctx, build.userId))) return false;
  if (build.userId === userId) return true;
  const rows = await ctx.db
    .query("buildCollaborators")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const c = rows.find((r) => r.userId === userId);
  return c?.role === "editor";
}

/** Returns true if the user can view the build (owner, any collaborator, or public/unlisted). For mutations we only need to allow owner or collaborator for protected ops. */
export async function canUserViewBuild(
  ctx: QueryCtx | MutationCtx,
  buildId: Id<"builds">,
  userId: string
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build || (await deletionJob(ctx, build.userId))) return false;
  if (build.userId === userId) return true;
  const rows = await ctx.db
    .query("buildCollaborators")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  return rows.some((r) => r.userId === userId);
}

/**
 * The relationships that grant a viewer *read* access to a build and to the
 * elements hanging off it. One place, so `builds.get`, the element reads in
 * `cosplayNodes.ts` and the blob rule in `lib/mediaAccess.ts` cannot drift apart.
 *
 * A viewer is related to a build when they own it, collaborate on it, or belong to
 * the group the build was shared into — `builds.listByGroup` lists a group's builds
 * to its members, so the detail page behind those cards and their thumbnails have
 * to resolve for them too. Nothing here grants anything to anonymous or unrelated
 * callers; the public surfaces add their own `public` / `unlisted` branch on top.
 */

/** True when the build is served to link holders and anonymous visitors by design. */
export function isBuildPublic(build: Doc<"builds">): boolean {
  const visibility = build.visibility ?? "private";
  return visibility === "public" || visibility === "unlisted";
}

export async function isBuildCollaborator(
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

/**
 * The one `by_groupId_userId` lookup. Callers that only need "is this user in the
 * group" use `isGroupMember`; callers that gate on the role read `role` off the row.
 */
export async function getGroupMembership(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: string
): Promise<Doc<"groupMembers"> | null> {
  const group = await ctx.db.get(groupId);
  if (group && (await deletionJob(ctx, group.createdBy))) return null;
  return await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_userId", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

export async function isGroupMember(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  viewerId: string
): Promise<boolean> {
  return (await getGroupMembership(ctx, groupId, viewerId)) != null;
}

/** Membership in the group the build was shared into, if it was shared into one. */
export async function isBuildGroupMember(
  ctx: QueryCtx,
  build: Doc<"builds">,
  viewerId: string
): Promise<boolean> {
  if (!build.groupId) return false;
  return await isGroupMember(ctx, build.groupId, viewerId);
}

/** True when `viewerId` and `otherUserId` are members of at least one common group. */
export async function sharesAnyGroup(
  ctx: QueryCtx,
  viewerId: string,
  otherUserId: string
): Promise<boolean> {
  const viewerGroups = await ctx.db
    .query("groupMembers")
    .withIndex("by_userId", (q) => q.eq("userId", viewerId))
    .collect();
  if (viewerGroups.length === 0) return false;
  const viewerGroupIds = new Set<string>(viewerGroups.map((m) => m.groupId));
  const otherGroups = await ctx.db
    .query("groupMembers")
    .withIndex("by_userId", (q) => q.eq("userId", otherUserId))
    .collect();
  return otherGroups.some((m) => viewerGroupIds.has(m.groupId));
}

/**
 * Owner, collaborator or group co-member. Deliberately says nothing about
 * `public` / `unlisted` visibility — callers that serve anonymous visitors add
 * that branch themselves.
 */
export async function hasBuildRelationship(
  ctx: QueryCtx,
  build: Doc<"builds">,
  viewerId: string | null
): Promise<boolean> {
  if (!viewerId || (await deletionJob(ctx, build.userId))) return false;
  if (build.userId === viewerId) return true;
  if (await isBuildCollaborator(ctx, build._id, viewerId)) return true;
  return await isBuildGroupMember(ctx, build, viewerId);
}

/**
 * Walks up the element graph from `nodeId` and tests `predicate` against every
 * build the node or any of its ancestors hangs off. Elements nest and only a root
 * carries the build link, so the walk has to go up rather than only look at the
 * node's own `buildId`.
 *
 * Since Step 2c both relations live on the node row itself — `buildId` for build
 * membership and `parentNodeId` for nesting — so this is a single-parent walk. The
 * `buildCosplayLinks` / `cosplayNodeLinks` join tables are deprecated and no longer
 * written; reading them here would make the predicate answer from stale rows.
 */
export async function someAncestorBuild(
  ctx: QueryCtx,
  nodeId: Id<"cosplayNodes">,
  predicate: (build: Doc<"builds">) => boolean | Promise<boolean>
): Promise<boolean> {
  const seen = new Set<string>();
  let current: Id<"cosplayNodes"> | undefined = nodeId;

  while (current !== undefined && !seen.has(current) && seen.size <= MAX_GRAPH_NODES) {
    seen.add(current);
    const node: Doc<"cosplayNodes"> | null = await ctx.db.get(current);
    if (!node || (await deletionJob(ctx, node.userId))) return false;
    if (node.buildId) {
      const build = await ctx.db.get(node.buildId);
      if (build && (await predicate(build))) return true;
    }
    current = node.parentNodeId;
  }

  return false;
}

/**
 * Whether `viewerId` may read an element's own data (name, children, cost rollup).
 *
 * The owner always may; beyond that the element is readable to whoever is related
 * to a build it hangs off, because the authenticated explorer and inspector read
 * the tree one element at a time and collaborators and group co-members open that
 * page. It is deliberately *not* readable through a `public` / `unlisted` build:
 * the public viewer has its own paths (`builds.getPublicViewerBundle`,
 * `cosplayNodes.listBuildVisualNodes`) which apply the viewer-settings toggles.
 */
export async function canReadElementData(
  ctx: QueryCtx,
  node: Doc<"cosplayNodes">,
  viewerId: string | null
): Promise<boolean> {
  if (!viewerId || (await deletionJob(ctx, node.userId))) return false;
  if (node.userId === viewerId) return true;
  return await someAncestorBuild(
    ctx,
    node._id,
    async (build) => await hasBuildRelationship(ctx, build, viewerId)
  );
}
