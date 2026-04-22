import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Resolved toggles: missing keys default to true (show section). */
export function resolvedPublicViewerSettings(build: Doc<"builds">) {
  const p = build.publicViewerSettings ?? {};
  return {
    showExplorer: p.showExplorer !== false,
    showTasks: p.showTasks !== false,
    showVisualBoard: p.showVisualBoard !== false,
    showSummary: p.showSummary !== false,
    showNotes: p.showNotes !== false,
    showCollaborators: p.showCollaborators !== false,
  };
}

/**
 * Whether workflow/task/visual-node/image list data may be read for this build.
 * Optional shareToken must match the build for unlisted visibility when viewer is not owner/collaborator.
 */
export async function canReadBuildWorkflowData(
  ctx: QueryCtx,
  build: Doc<"builds">,
  opts: { viewerUserId?: string | null; shareToken?: string | null }
): Promise<boolean> {
  if (opts.viewerUserId && build.userId === opts.viewerUserId) return true;
  if (opts.viewerUserId) {
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    if (rows.some((r) => r.userId === opts.viewerUserId)) return true;
  }
  const vis = build.visibility ?? "private";
  if (vis === "public") return true;
  if (vis === "unlisted" && opts.shareToken && build.shareToken === opts.shareToken) return true;
  return false;
}
