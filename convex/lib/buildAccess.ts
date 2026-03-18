import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Returns true if the user can edit the build (owner or collaborator with role editor). */
export async function canUserEditBuild(
  ctx: MutationCtx,
  buildId: Id<"builds">,
  userId: string
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build) return false;
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
  ctx: MutationCtx,
  buildId: Id<"builds">,
  userId: string
): Promise<boolean> {
  const build = await ctx.db.get(buildId);
  if (!build) return false;
  if (build.userId === userId) return true;
  const rows = await ctx.db
    .query("buildCollaborators")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  return rows.some((r) => r.userId === userId);
}
