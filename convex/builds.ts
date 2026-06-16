import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { canUserEditBuild } from "./lib/buildAccess";
import { canReadBuildWorkflowData, resolvedPublicViewerSettings } from "./lib/buildPublicViewer";
import { entityKey, getWorkflowItemsByAttachmentKey } from "./lib/workflowDomain";
import { workflowTasksForBuildOwner } from "./buildTasks";
import { computeBuildVisualNodesList, deriveNodeSummary } from "./cosplayNodes";
import { deriveBuildBlendedProgress, deriveStatusProgress } from "./lib/workflowProgress";
import { getBuildScopedWorkflow } from "./workflow";
import { idempotentRecord, idempotentReplay, runIdempotent } from "./lib/idempotency";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeString,
  validateDateString,
} from "./lib/validation";

const VALID_STATUSES = ["idea", "wip", "ready", "archived"] as const;
const VALID_VISIBILITIES = ["private", "unlisted", "public"] as const;

function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Public viewer payload: no owner/collaborator identifiers, secrets, or sync-only fields. */
function snapshotBuildForPublicViewer(
  build: Doc<"builds">,
  metrics: {
    tasksTotal: number;
    tasksChecked: number;
    progress: number;
    workflowProgressPercent: number;
  }
) {
  return {
    _id: build._id,
    _creationTime: build._creationTime,
    name: build.name,
    character: build.character,
    status: build.status,
    notes: build.notes,
    imageUrl: build.imageUrl,
    imageStorageId: build.imageStorageId,
    imageFocalX: build.imageFocalX,
    imageFocalY: build.imageFocalY,
    budgetCents: build.budgetCents,
    targetDate: build.targetDate,
    manualProgressPercent: build.manualProgressPercent,
    visibility: build.visibility,
    groupId: build.groupId,
    publicViewerSettings: build.publicViewerSettings,
    ...metrics,
  };
}

/** Removes share/unlisted link token and offline sync metadata from build rows shown in public listings. */
function stripBuildSyncSecrets(b: Doc<"builds">) {
  const { shareToken: _st, clientId: _cid, version: _ver, ...rest } = b;
  return rest;
}

const sortByValidator = v.optional(
  v.union(v.literal("name"), v.literal("progress"), v.literal("targetDate"), v.literal("budget"))
);
const orderValidator = v.optional(v.union(v.literal("asc"), v.literal("desc")));
const legacyNodeIdValidator = v.union(v.id("cosplayNodes"), v.id("closetItems"));

async function getBuildRootLinks(
  ctx: MutationCtx | import("./_generated/server").QueryCtx,
  buildId: Doc<"builds">["_id"]
) {
  const links = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_buildId_sortOrder", (q) => q.eq("buildId", buildId))
    .collect();
  if (links.length > 0) return links;

  const legacyLinks = await ctx.db
    .query("buildItemLinks")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const resolved = [];
  for (let index = 0; index < legacyLinks.length; index += 1) {
    const migrated = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_legacyClosetItemId", (q) =>
        q.eq("legacyClosetItemId", legacyLinks[index].closetItemId)
      )
      .unique();
    if (!migrated) continue;
    resolved.push({
      _id: legacyLinks[index]._id,
      _creationTime: legacyLinks[index]._creationTime,
      userId: legacyLinks[index].userId,
      buildId: legacyLinks[index].buildId,
      cosplayNodeId: migrated._id,
      sortOrder: index,
    });
  }
  return resolved;
}

async function getBuildRootNodeIds(
  ctx: MutationCtx | import("./_generated/server").QueryCtx,
  buildId: Doc<"builds">["_id"]
) {
  const links = await getBuildRootLinks(ctx, buildId);
  return links.map((link) => link.cosplayNodeId);
}

async function resolveLegacyNodeIds(
  ctx: MutationCtx | import("./_generated/server").QueryCtx,
  userId: string | undefined,
  ids: Array<Id<"cosplayNodes"> | Id<"closetItems">>
) {
  const resolved: Id<"cosplayNodes">[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const direct = await ctx.db.get(rawId as Id<"cosplayNodes">);
    if (direct && "nodeType" in direct && (!userId || direct.userId === userId)) {
      if (!seen.has(direct._id)) {
        resolved.push(direct._id);
        seen.add(direct._id);
      }
      continue;
    }
    const migrated = await ctx.db
      .query("cosplayNodes")
      .withIndex("by_legacyClosetItemId", (q) =>
        q.eq("legacyClosetItemId", rawId as Id<"closetItems">)
      )
      .unique();
    if (migrated && (!userId || migrated.userId === userId) && !seen.has(migrated._id)) {
      resolved.push(migrated._id);
      seen.add(migrated._id);
    }
  }
  return resolved;
}

async function getBuildWorkflowMetrics(
  ctx: MutationCtx | import("./_generated/server").QueryCtx,
  build: Doc<"builds">
) {
  const scoped = await getBuildScopedWorkflow(
    ctx as import("./_generated/server").QueryCtx,
    build._id
  );
  const workflowItems = scoped?.items ?? [];
  const taskItems = workflowItems.filter((item) => item.kind === "task");
  const tasksChecked = taskItems.filter((item) => item.status === "done").length;
  const tasksTotal = taskItems.length;
  const workflowProgressPercent =
    tasksTotal > 0
      ? Math.round((tasksChecked / tasksTotal) * 100)
      : workflowItems.length > 0
        ? Math.round(
            workflowItems.reduce(
              (sum, item) =>
                sum +
                deriveStatusProgress({
                  status: item.status as never,
                  manualProgressPercent: item.manualProgressPercent,
                }),
              0
            ) / workflowItems.length
          )
        : 0;

  const links = await getBuildRootLinks(ctx, build._id);
  let totalCostCents = 0;
  const nodeProgressUnits: number[] = [];
  const visited = new Set<string>();
  for (const link of links) {
    const summary = await deriveNodeSummary(ctx, link.cosplayNodeId, build._id, visited);
    totalCostCents += summary.totalCostCents;
    nodeProgressUnits.push(summary.progressPercent);
  }
  const nodeProgressPercent =
    nodeProgressUnits.length > 0
      ? Math.round(
          nodeProgressUnits.reduce((sum, value) => sum + value, 0) / nodeProgressUnits.length
        )
      : undefined;
  const packingItems = (
    await ctx.db
      .query("packingListItems")
      .withIndex("by_userId", (q) => q.eq("userId", build.userId))
      .collect()
  ).filter((item) => item.buildId === build._id);
  const packingProgressPercent =
    packingItems.length > 0
      ? Math.round((packingItems.filter((item) => item.checked).length / packingItems.length) * 100)
      : undefined;
  const progress = deriveBuildBlendedProgress({
    manualProgressPercent: build.manualProgressPercent,
    workflowProgressPercent,
    nodeProgressPercent,
    packingProgressPercent,
  });

  return {
    tasksTotal,
    tasksChecked,
    workflowProgressPercent,
    packingProgressPercent,
    nodeProgressPercent,
    progress,
    totalCostCents,
  };
}

export const list = query({
  args: {
    userId: v.string(),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    sortBy: sortByValidator,
    order: orderValidator,
  },
  handler: async (ctx, args) => {
    const order = args.order ?? "asc";
    const sortBy = args.sortBy ?? "name";

    const statusFilter =
      args.status && VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])
        ? args.status
        : undefined;

    const builds = await (statusFilter
      ? ctx.db
          .query("builds")
          .withIndex("by_userId_status", (q) =>
            q.eq("userId", args.userId).eq("status", statusFilter)
          )
          .collect()
      : ctx.db
          .query("builds")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect());

    const withCounts = await Promise.all(
      builds.map(async (b) => ({
        ...b,
        ...(await getBuildWorkflowMetrics(ctx, b)),
      }))
    );

    let filtered = withCounts;
    const searchTrimmed = args.search?.trim();
    if (searchTrimmed) {
      const lower = searchTrimmed.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(lower) || (b.character ?? "").toLowerCase().includes(lower)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "progress":
          cmp = (a.progress ?? 0) - (b.progress ?? 0);
          break;
        case "targetDate": {
          const ad = a.targetDate ?? "";
          const bd = b.targetDate ?? "";
          cmp = ad.localeCompare(bd);
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        case "budget": {
          const ac = a.budgetCents ?? -1;
          const bc = b.budgetCents ?? -1;
          cmp = ac - bc;
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        default:
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
      }
      return order === "desc" ? -cmp : cmp;
    });

    return sorted.map(({ progress: _p, ...rest }) => rest);
  },
});

/** Returns the user's most recently created build (for home hero). Includes task counts. */
export const getMostRecentForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    if (builds.length === 0) return null;
    const sorted = [...builds].sort((a, b) => b._creationTime - a._creationTime);
    const build = sorted[0];
    const { tasksChecked, tasksTotal, progress } = await getBuildWorkflowMetrics(ctx, build);
    return {
      ...build,
      tasksTotal,
      tasksChecked,
      progress,
    };
  },
});

/**
 * Returns the build to show as "Current Focus" on home: user's selected focused build
 * if set and valid, otherwise the most recently created build. Includes task counts.
 */
export const getFocusedOrMostRecentForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.userId))
      .unique();

    let build: Doc<"builds"> | null = null;
    if (user?.focusedBuildId) {
      const candidate = await ctx.db.get(user.focusedBuildId);
      if (candidate && "name" in candidate && candidate.userId === args.userId)
        build = candidate as Doc<"builds">;
    }
    if (!build) {
      const builds = await ctx.db
        .query("builds")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
      if (builds.length === 0) return null;
      const sorted = [...builds].sort((a, b) => b._creationTime - a._creationTime);
      build = sorted[0];
    }

    const { tasksChecked, tasksTotal, progress } = await getBuildWorkflowMetrics(ctx, build);
    return {
      ...build,
      tasksTotal,
      tasksChecked,
      progress,
    };
  },
});

export const get = query({
  args: { id: v.id("builds") },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.id);
    if (!build) return null;
    const { tasksTotal, tasksChecked, progress, workflowProgressPercent } =
      await getBuildWorkflowMetrics(ctx, build);
    return {
      ...build,
      tasksTotal,
      tasksChecked,
      progress,
      workflowProgressPercent,
    };
  },
});

/** Get build by unlisted share token. Returns build with task counts if token matches. */
export const getByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db
      .query("builds")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .unique();
    if (!build) return null;
    const { tasksTotal, tasksChecked, progress, workflowProgressPercent } =
      await getBuildWorkflowMetrics(ctx, build);
    return {
      ...build,
      tasksTotal,
      tasksChecked,
      progress,
      workflowProgressPercent,
    };
  },
});

/**
 * Single payload for public share pages (`/b/[buildId]` when public, `/b/s/[token]` when unlisted).
 * Enforces access server-side; respects `publicViewerSettings` toggles.
 */
export const getPublicViewerBundle = query({
  args: {
    buildId: v.optional(v.id("builds")),
    shareToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.buildId && !args.shareToken) return null;

    let build: Doc<"builds"> | null = null;
    const shareTokenForAccess = args.shareToken;

    if (args.shareToken) {
      build = await ctx.db
        .query("builds")
        .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
        .unique();
    } else if (args.buildId) {
      build = await ctx.db.get(args.buildId);
      if (!build) return null;
      const vis = build.visibility ?? "private";
      if (vis !== "public") return null;
    }

    if (!build) return null;

    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;

    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: shareTokenForAccess ?? null,
    });
    if (!allowed) return null;

    const toggles = resolvedPublicViewerSettings(build);

    const { tasksTotal, tasksChecked, progress, workflowProgressPercent } =
      await getBuildWorkflowMetrics(ctx, build);

    const tasks =
      toggles.showTasks && allowed
        ? await workflowTasksForBuildOwner(ctx, build._id, build.userId)
        : [];

    const visualNodes =
      (toggles.showExplorer || toggles.showVisualBoard) && allowed
        ? await computeBuildVisualNodesList(ctx, build._id)
        : [];

    const summary =
      toggles.showSummary && allowed ? await computeBuildSummaryPayload(ctx, build) : null;

    const rootNodeIds =
      toggles.showExplorer && allowed ? await getBuildRootNodeIds(ctx, build._id) : [];

    let referenceImages: Doc<"buildReferenceImages">[] = [];
    let processPictures: Doc<"buildProcessPictures">[] = [];
    if (allowed && toggles.showVisualBoard) {
      referenceImages = (
        await ctx.db
          .query("buildReferenceImages")
          .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
          .collect()
      ).sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
      processPictures = (
        await ctx.db
          .query("buildProcessPictures")
          .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
          .collect()
      ).sort((a, b) => a.sortOrder - b.sortOrder || a._creationTime - b._creationTime);
    }

    let collaborators: Array<{
      collaboratorId: Id<"buildCollaborators">;
      role: string;
      username: string | null;
      displayLabel: string;
    }> = [];
    if (allowed && toggles.showCollaborators) {
      const rows = await ctx.db
        .query("buildCollaborators")
        .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
        .collect();
      collaborators = await Promise.all(
        rows.map(async (r) => {
          const user = await ctx.db
            .query("users")
            .withIndex("by_externalId", (q) => q.eq("externalId", r.userId))
            .unique();
          const username = user?.username?.trim() || null;
          const displayLabel =
            username != null
              ? `@${username}`
              : user?.displayName?.trim() || user?.name?.trim() || "Collaborator";
          return {
            collaboratorId: r._id,
            role: r.role,
            username,
            displayLabel,
          };
        })
      );
    }

    return {
      build: snapshotBuildForPublicViewer(build, {
        tasksTotal,
        tasksChecked,
        progress,
        workflowProgressPercent,
      }),
      togglesResolved: toggles,
      tasks,
      visualNodes,
      summary,
      rootNodeIds,
      referenceImages,
      processPictures,
      collaborators,
    };
  },
});

/** List public builds for a user (for public profile page). */
export const listPublicByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const publicOnly = builds.filter((b) => b.visibility === "public");
    return await Promise.all(
      publicOnly.map(async (b) => {
        return {
          ...stripBuildSyncSecrets(b),
          ...(await getBuildWorkflowMetrics(ctx, b)),
        };
      })
    );
  },
});

/** List builds in a group (for group page). Returns builds with task counts. */
export const listByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    return await Promise.all(
      builds.map(async (b) => {
        return {
          ...b,
          ...(await getBuildWorkflowMetrics(ctx, b)),
        };
      })
    );
  },
});

/** Discover: recent public builds, optionally limited. Returns builds with task counts and owner username. */
export const listDiscover = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_visibility", (q) => q.eq("visibility", "public"))
      .collect();
    const sorted = [...builds].sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
    const limited = args.limit ? sorted.slice(0, args.limit) : sorted;
    const withDetails = await Promise.all(
      limited.map(async (b) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", b.userId))
          .unique();
        return {
          ...stripBuildSyncSecrets(b),
          ...(await getBuildWorkflowMetrics(ctx, b)),
          ownerUsername: user?.username ?? null,
          ownerName: user?.displayName ?? user?.name ?? null,
        };
      })
    );
    return withDetails;
  },
});

/** Feed: public builds from people the current user follows. */
export const listFeedFromFollowing = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    const followingIds = Array.from(new Set(following.map((f) => f.followingId)));
    if (followingIds.length === 0) return [];
    const allPublic: Array<Doc<"builds">> = [];
    for (const uid of followingIds) {
      const userBuilds = await ctx.db
        .query("builds")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .collect();
      allPublic.push(...userBuilds.filter((b) => b.visibility === "public"));
    }
    const sorted = [...allPublic].sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
    const limited = args.limit ? sorted.slice(0, args.limit) : sorted;
    return await Promise.all(
      limited.map(async (b) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", b.userId))
          .unique();
        return {
          ...stripBuildSyncSecrets(b),
          ...(await getBuildWorkflowMetrics(ctx, b)),
          ownerUsername: user?.username ?? null,
          ownerName: user?.displayName ?? user?.name ?? null,
        };
      })
    );
  },
});

/** List builds shared with the current user (as collaborator). For "Shared with me" on Builds page. */
export const listSharedWithUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const buildIds = rows.map((r) => r.buildId);
    const withDetails = await Promise.all(
      buildIds.map(async (buildId) => {
        const build = await ctx.db.get(buildId);
        if (!build) return null;
        const row = rows.find((r) => r.buildId === buildId);
        return {
          ...build,
          ...(await getBuildWorkflowMetrics(ctx, build)),
          myRole: row?.role ?? null,
        };
      })
    );
    return withDetails.filter((b): b is NonNullable<typeof b> => b != null);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    character: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    visibility: v.optional(v.string()),
    /** Offline replay dedupe key (optional); see convex/lib/idempotency.ts. */
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    runIdempotent(ctx, args.idempotencyKey, args.userId, async () => {
      if (args.imageStorageId) {
        await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
      }
      const name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
      const character = sanitizeOptional(args.character, MAX_LENGTH.character, "Character");
      const notes = sanitizeOptional(args.notes, MAX_LENGTH.notes, "Notes");
      const status = VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])
        ? sanitizeString(args.status)
        : "idea";
      const targetDate = args.targetDate
        ? validateDateString(args.targetDate, "Target date")
        : undefined;
      const visibility = VALID_VISIBILITIES.includes(
        args.visibility as (typeof VALID_VISIBILITIES)[number]
      )
        ? args.visibility
        : "private";
      const shareToken = visibility === "unlisted" ? generateShareToken() : undefined;
      const id = await ctx.db.insert("builds", {
        userId: args.userId,
        name,
        character,
        status,
        notes,
        imageUrl: args.imageUrl,
        imageStorageId: args.imageStorageId,
        budgetCents: args.budgetCents,
        targetDate,
        visibility,
        shareToken,
      });
      return await ctx.db.get(id);
    }),
});

export const update = mutation({
  args: {
    id: v.id("builds"),
    userId: v.string(),
    name: v.optional(v.string()),
    character: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    imageFocalX: v.optional(v.number()),
    imageFocalY: v.optional(v.number()),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    visibility: v.optional(v.string()),
    shareToken: v.optional(v.union(v.string(), v.null())),
    groupId: v.optional(v.union(v.id("groups"), v.null())),
    publicViewerSettings: v.optional(
      v.object({
        showExplorer: v.optional(v.boolean()),
        showTasks: v.optional(v.boolean()),
        showVisualBoard: v.optional(v.boolean()),
        showSummary: v.optional(v.boolean()),
        showNotes: v.optional(v.boolean()),
        showCollaborators: v.optional(v.boolean()),
      })
    ),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, userId, idempotencyKey, ...fields } = args;
    const replay = await idempotentReplay(ctx, idempotencyKey);
    if (replay.hit) return replay.result as Doc<"builds"> | null;
    const build = await ctx.db.get(id);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, id, userId);
    if (!canEdit) throw new Error("Not authorized to update this build");
    const newStorageId = fields.imageStorageId ?? undefined;
    const oldStorageId = build.imageStorageId;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, userId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, userId, newStorageId);
    }
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (k === "name") patch.name = sanitizeAndLimit(val as string, MAX_LENGTH.name, "Name");
      else if (k === "character")
        patch.character = sanitizeOptional(val as string, MAX_LENGTH.character, "Character");
      else if (k === "notes")
        patch.notes = sanitizeOptional(val as string, MAX_LENGTH.notes, "Notes");
      else if (k === "status") {
        if (VALID_STATUSES.includes(val as (typeof VALID_STATUSES)[number])) {
          patch.status = sanitizeString(val as string);
        }
      } else if (k === "targetDate")
        patch.targetDate = validateDateString(val as string, "Target date");
      else if (k === "imageUrl")
        patch.imageUrl = sanitizeOptional(val as string | undefined, MAX_LENGTH.url, "Image URL");
      else if (k === "imageStorageId") patch.imageStorageId = val === null ? undefined : val;
      else if (k === "imageFocalX" && typeof val === "number")
        patch.imageFocalX = Math.max(0, Math.min(1, val));
      else if (k === "imageFocalY" && typeof val === "number")
        patch.imageFocalY = Math.max(0, Math.min(1, val));
      else if (k === "visibility") {
        if (VALID_VISIBILITIES.includes(val as (typeof VALID_VISIBILITIES)[number])) {
          patch.visibility = val;
          if (val === "unlisted" && build.shareToken == null) {
            (patch as Record<string, unknown>).shareToken = generateShareToken();
          } else if (val !== "unlisted") {
            (patch as Record<string, unknown>).shareToken = undefined;
          }
        }
      } else if (k === "shareToken") {
        patch.shareToken = val === null || val === "" ? undefined : val;
      } else if (k === "groupId") {
        patch.groupId = val === null || val === "" ? undefined : val;
      } else if (k === "publicViewerSettings" && val && typeof val === "object") {
        const prev = build.publicViewerSettings ?? {};
        const incoming = val as Record<string, boolean | undefined>;
        patch.publicViewerSettings = {
          ...prev,
          ...(incoming.showExplorer !== undefined ? { showExplorer: incoming.showExplorer } : {}),
          ...(incoming.showTasks !== undefined ? { showTasks: incoming.showTasks } : {}),
          ...(incoming.showVisualBoard !== undefined
            ? { showVisualBoard: incoming.showVisualBoard }
            : {}),
          ...(incoming.showSummary !== undefined ? { showSummary: incoming.showSummary } : {}),
          ...(incoming.showNotes !== undefined ? { showNotes: incoming.showNotes } : {}),
          ...(incoming.showCollaborators !== undefined
            ? { showCollaborators: incoming.showCollaborators }
            : {}),
        };
      } else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return idempotentRecord(ctx, idempotencyKey, userId, await ctx.db.get(id));
  },
});

/** Set or clear build's group. User must own the build and be a member of the group (if setting). */
export const setGroupId = mutation({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
    groupId: v.optional(v.union(v.id("groups"), v.null())),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const newGroupId =
      args.groupId === null || args.groupId === undefined ? undefined : args.groupId;
    if (newGroupId) {
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_userId", (q) =>
          q.eq("groupId", newGroupId).eq("userId", args.userId)
        )
        .unique();
      if (!membership) throw new Error("You must be a member of the group to add this build");
    }
    await ctx.db.patch(args.buildId, { groupId: newGroupId });
    return await ctx.db.get(args.buildId);
  },
});

export const remove = mutation({
  args: { id: v.id("builds"), userId: v.string() },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.id);
    if (!build || build.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    await subtractUsageForStorageId(ctx, args.userId, build.imageStorageId);
    const refImages = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const r of refImages) {
      await subtractUsageForStorageId(ctx, args.userId, r.imageStorageId);
    }
    const processPics = await ctx.db
      .query("buildProcessPictures")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const p of processPics) {
      await subtractUsageForStorageId(ctx, args.userId, p.imageStorageId);
    }
    // Cascade: delete legacy tasks, workflow attachments/items, root links, and build-node states.
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);
    const workflowAttachments = (
      await ctx.db
        .query("workflowAttachments")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((attachment) => attachment.entityType === "build" && attachment.entityId === args.id);
    for (const attachment of workflowAttachments) {
      const workflowItem = await ctx.db.get(attachment.workflowItemId);
      await ctx.db.delete(attachment._id);
      if (workflowItem?.scopeKind === "build_specific") {
        await ctx.db.delete(workflowItem._id);
      }
    }

    const legacyLinks = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const l of legacyLinks) await ctx.db.delete(l._id);
    const links = await ctx.db
      .query("buildCosplayLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    const buildNodeStates = await ctx.db
      .query("buildNodeStates")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const state of buildNodeStates) await ctx.db.delete(state._id);

    for (const r of refImages) await ctx.db.delete(r._id);
    for (const p of processPics) await ctx.db.delete(p._id);
    await ctx.db.delete(args.id);
  },
});

/** Delete multiple builds (cascade tasks + links). Authorized per build. */
export const removeMany = mutation({
  args: {
    ids: v.array(v.id("builds")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      const build = await ctx.db.get(id);
      if (!build || build.userId !== args.userId) continue;
      await subtractUsageForStorageId(ctx, args.userId, build.imageStorageId);
      const refImages = await ctx.db
        .query("buildReferenceImages")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const r of refImages) {
        await subtractUsageForStorageId(ctx, args.userId, r.imageStorageId);
        await ctx.db.delete(r._id);
      }
      const processPics = await ctx.db
        .query("buildProcessPictures")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const p of processPics) {
        await subtractUsageForStorageId(ctx, args.userId, p.imageStorageId);
        await ctx.db.delete(p._id);
      }
      const tasks = await ctx.db
        .query("buildTasks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const t of tasks) await ctx.db.delete(t._id);
      const workflowAttachments = (
        await ctx.db
          .query("workflowAttachments")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      ).filter((attachment) => attachment.entityType === "build" && attachment.entityId === id);
      for (const attachment of workflowAttachments) {
        const workflowItem = await ctx.db.get(attachment.workflowItemId);
        await ctx.db.delete(attachment._id);
        if (workflowItem?.scopeKind === "build_specific") {
          await ctx.db.delete(workflowItem._id);
        }
      }
      const legacyLinks = await ctx.db
        .query("buildItemLinks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const l of legacyLinks) await ctx.db.delete(l._id);
      const links = await ctx.db
        .query("buildCosplayLinks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const l of links) await ctx.db.delete(l._id);
      const buildNodeStates = await ctx.db
        .query("buildNodeStates")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const state of buildNodeStates) await ctx.db.delete(state._id);
      await ctx.db.delete(id);
    }
  },
});

/** Set status for multiple builds. Authorized per build. */
export const updateStatusMany = mutation({
  args: {
    ids: v.array(v.id("builds")),
    userId: v.string(),
    status: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return;
    if (!VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])) {
      throw new Error("Invalid status");
    }
    for (const id of args.ids) {
      const build = await ctx.db.get(id);
      if (!build || build.userId !== args.userId) continue;
      await ctx.db.patch(id, { status: args.status });
    }
    await idempotentRecord(ctx, args.idempotencyKey, args.userId, undefined);
  },
});

export const getNodes = query({
  args: { buildId: v.id("builds"), shareToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return [];
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: args.shareToken ?? null,
    });
    if (!allowed) return [];
    return await getBuildRootNodeIds(ctx, args.buildId);
  },
});

export const getItems = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => await getBuildRootNodeIds(ctx, args.buildId),
});

async function computeBuildSummaryPayload(
  ctx: import("./_generated/server").QueryCtx,
  build: Doc<"builds">
) {
  const {
    tasksChecked,
    tasksTotal,
    progress: progressPercent,
    totalCostCents,
  } = await getBuildWorkflowMetrics(ctx, build);

  const links = await getBuildRootLinks(ctx, build._id);
  let linkedItemCount = links.length;
  let linkedItemsCompleteCount = 0;
  const visited = new Set<string>();
  for (const link of links) {
    const summary = await deriveNodeSummary(ctx, link.cosplayNodeId, build._id, visited);
    if (summary.overallBucket === "complete") linkedItemsCompleteCount += 1;
  }

  const createdMs = (build as { _creationTime?: number })._creationTime ?? Date.now();
  const createdDate = new Date(createdMs).toISOString().slice(0, 10);
  const now = Date.now();
  const elapsedMs = now - createdMs;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  let remainingDays: number | null = null;
  if (build.targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetStart = new Date(build.targetDate);
    targetStart.setHours(0, 0, 0, 0);
    remainingDays = Math.ceil((targetStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const budgetCents = build.budgetCents ?? null;
  const budgetDifferenceCents = budgetCents != null ? budgetCents - totalCostCents : null;

  return {
    status: build.status,
    progressPercent,
    tasksChecked,
    tasksTotal,
    createdDate,
    targetDate: build.targetDate ?? null,
    elapsedDays,
    remainingDays,
    linkedItemCount,
    linkedItemsCompleteCount,
    totalCostCents,
    budgetCents,
    budgetDifferenceCents,
  };
}

/** Returns aggregated summary for one build (status, progress, dates, linked items, budget). Used by Summary dashboard. */
export const getSummary = query({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) return null;
    return await computeBuildSummaryPayload(ctx, build);
  },
});

/** Returns builds with their tasks and linked cosplay-node IDs — used by mobile sync. */
export const listWithDetails = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return await Promise.all(
      builds.map(async (b) => {
        const links = await getBuildRootLinks(ctx, b._id);
        const scoped = await getBuildScopedWorkflow(ctx, b._id);
        return {
          ...b,
          tasks: (scoped?.items ?? [])
            .filter((item) => item.kind === "task")
            .map((item) => ({
              _id: item._id,
              buildId: b._id,
              label: item.title,
              sortOrder: item.sortOrder,
              checked: item.status === "done",
              dueDate: item.dueDate,
            })),
          workflowItems: scoped?.items ?? [],
          linkedNodeIds: links.map((l) => l.cosplayNodeId as string),
        };
      })
    );
  },
});
async function replaceBuildRootLinks(
  ctx: MutationCtx,
  userId: string,
  buildId: Id<"builds">,
  cosplayNodeIds: Id<"cosplayNodes">[]
) {
  const existing = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  for (const link of existing) {
    await ctx.db.delete(link._id);
  }
  for (let index = 0; index < cosplayNodeIds.length; index += 1) {
    const cosplayNodeId = cosplayNodeIds[index];
    await ctx.db.insert("buildCosplayLinks", {
      userId,
      buildId,
      cosplayNodeId,
      sortOrder: index,
    });
  }
}

async function addBuildRootLinks(
  ctx: MutationCtx,
  userId: string,
  buildId: Id<"builds">,
  cosplayNodeIds: Id<"cosplayNodes">[]
) {
  const existing = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const existingIds = new Set(existing.map((link) => link.cosplayNodeId));
  let nextSortOrder = existing.length;
  for (const cosplayNodeId of Array.from(new Set(cosplayNodeIds))) {
    if (existingIds.has(cosplayNodeId)) continue;
    const node = await ctx.db.get(cosplayNodeId);
    if (!node || node.userId !== userId) continue;
    await ctx.db.insert("buildCosplayLinks", {
      userId,
      buildId,
      cosplayNodeId,
      sortOrder: nextSortOrder++,
    });
  }
}

async function removeBuildRootLink(
  ctx: MutationCtx,
  userId: string,
  buildId: Id<"builds">,
  cosplayNodeId: Id<"cosplayNodes">
) {
  const build = await ctx.db.get(buildId);
  if (!build) throw new Error("Build not found");
  const canEdit = await canUserEditBuild(ctx, buildId, userId);
  if (!canEdit) throw new Error("Not authorized");
  const node = await ctx.db.get(cosplayNodeId);
  if (!node || node.userId !== userId) {
    throw new Error("Not found or not authorized");
  }

  const links = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  for (const link of links) {
    if (link.buildId === buildId) await ctx.db.delete(link._id);
  }
}

async function listBuildsUsingNode(
  ctx: import("./_generated/server").QueryCtx,
  cosplayNodeId: Id<"cosplayNodes">
) {
  const links = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_cosplayNodeId", (q) => q.eq("cosplayNodeId", cosplayNodeId))
    .collect();
  const buildIds = Array.from(new Set(links.map((link) => link.buildId)));
  const builds = await Promise.all(buildIds.map((buildId) => ctx.db.get(buildId)));
  return builds.flatMap((build) =>
    build && "name" in build
      ? [
          {
            _id: build._id,
            name: build.name,
            imageStorageId: build.imageStorageId,
            imageUrl: build.imageUrl,
            character: build.character,
          },
        ]
      : []
  );
}

export const linkNodes = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeIds: v.array(v.id("cosplayNodes")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");

    const validIds: Id<"cosplayNodes">[] = [];
    for (const cosplayNodeId of Array.from(new Set(args.cosplayNodeIds))) {
      const node = await ctx.db.get(cosplayNodeId);
      if (node && node.userId === args.userId) validIds.push(cosplayNodeId);
    }
    await replaceBuildRootLinks(ctx, args.userId, args.buildId, validIds);
  },
});

/** Re-order root-linked cosplay nodes for a build (outline tab drag). */
export const reorderRootLinks = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    orderedCosplayNodeIds: v.array(v.id("cosplayNodes")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");

    const links = await ctx.db
      .query("buildCosplayLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();

    const linkByNode = new Map<string, (typeof links)[number]>();
    for (const link of links) {
      linkByNode.set(link.cosplayNodeId as string, link);
    }

    const seen = new Set<string>();
    const orderedUnique: Id<"cosplayNodes">[] = [];
    for (const id of args.orderedCosplayNodeIds) {
      const key = id as string;
      if (seen.has(key)) continue;
      seen.add(key);
      orderedUnique.push(id);
    }

    if (orderedUnique.length !== linkByNode.size) {
      throw new Error("Ordered nodes must match existing root links");
    }
    for (const id of orderedUnique) {
      if (!linkByNode.has(id as string)) {
        throw new Error("Unknown cosplay node for this build");
      }
    }

    for (let i = 0; i < orderedUnique.length; i++) {
      const nodeId = orderedUnique[i];
      const link = linkByNode.get(nodeId as string);
      if (!link) continue;
      await ctx.db.patch(link._id, { sortOrder: i });
    }
    return orderedUnique.length;
  },
});

/** Clone an outfit owned by the caller: new private build + linked nodes, per-build state, galleries, and planner tasks. */
export const duplicate = mutation({
  args: {
    userId: v.string(),
    sourceBuildId: v.id("builds"),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return replay.result as Id<"builds">;
    const source = await ctx.db.get(args.sourceBuildId);
    if (!source) throw new Error("Build not found");
    if (source.userId !== args.userId) {
      throw new Error("Only the outfit owner can duplicate it");
    }

    const dupName = sanitizeAndLimit(`${source.name} (copy)`, MAX_LENGTH.name, "Name");

    const newBuildId = await ctx.db.insert("builds", {
      userId: args.userId,
      name: dupName,
      character: source.character,
      status: "idea",
      notes: source.notes,
      imageUrl: source.imageUrl,
      imageStorageId: source.imageStorageId,
      imageFocalX: source.imageFocalX,
      imageFocalY: source.imageFocalY,
      budgetCents: source.budgetCents,
      targetDate: source.targetDate,
      visibility: "private",
      manualProgressPercent: undefined,
      shareToken: undefined,
    });

    const links = await ctx.db
      .query("buildCosplayLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.sourceBuildId))
      .collect();
    for (const link of links) {
      await ctx.db.insert("buildCosplayLinks", {
        userId: args.userId,
        buildId: newBuildId,
        cosplayNodeId: link.cosplayNodeId,
        sortOrder: link.sortOrder,
      });
    }

    const states = await ctx.db
      .query("buildNodeStates")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.sourceBuildId))
      .collect();
    for (const s of states) {
      await ctx.db.insert("buildNodeStates", {
        userId: args.userId,
        buildId: newBuildId,
        cosplayNodeId: s.cosplayNodeId,
        purchaseStatus: s.purchaseStatus,
        buildStatus: s.buildStatus,
        materialStatus: s.materialStatus,
        manualOverallBucket: s.manualOverallBucket,
        pricingMode: s.pricingMode,
        directCostCents: s.directCostCents,
        unitCostCents: s.unitCostCents,
        quantity: s.quantity,
        unit: s.unit,
        purchasedAt: s.purchasedAt,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      });
    }

    const refImgs = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.sourceBuildId))
      .collect();
    for (const r of [...refImgs].sort((a, b) => a.sortOrder - b.sortOrder)) {
      await ctx.db.insert("buildReferenceImages", {
        userId: args.userId,
        buildId: newBuildId,
        imageStorageId: r.imageStorageId,
        imageUrl: r.imageUrl,
        sortOrder: r.sortOrder,
      });
    }

    const proc = await ctx.db
      .query("buildProcessPictures")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.sourceBuildId))
      .collect();
    for (const p of [...proc].sort((a, b) => a.sortOrder - b.sortOrder)) {
      await ctx.db.insert("buildProcessPictures", {
        userId: args.userId,
        buildId: newBuildId,
        imageStorageId: p.imageStorageId,
        imageUrl: p.imageUrl,
        sortOrder: p.sortOrder,
      });
    }

    const scoped = await getWorkflowItemsByAttachmentKey(
      ctx,
      args.userId,
      [entityKey("build", args.sourceBuildId)],
      args.sourceBuildId
    );
    const sourceIdStr = args.sourceBuildId as string;
    const taskItems = scoped.items.filter((item) => item.kind === "task");
    for (const item of taskItems) {
      if (item.parentId) continue;

      const itemAtts = scoped.attachments.filter((a) => a.workflowItemId === item._id);
      const buildPrimary = itemAtts.find(
        (a) =>
          a.entityType === "build" && String(a.entityId) === sourceIdStr && a.role === "primary"
      );
      if (!buildPrimary) continue;

      const nodeAtt = itemAtts.find((a) => a.entityType === "cosplayNode");

      const newItemId = await ctx.db.insert("workflowItems", {
        userId: args.userId,
        title: item.title,
        notes: item.notes,
        kind: "task",
        category: item.category,
        status: "not_started",
        parentId: undefined,
        ancestorIds: [],
        sortOrder: item.sortOrder,
        scopeKind: "build_specific",
        sourceKind: item.sourceKind,
        priority: item.priority,
        startDate: item.startDate,
        targetDate: item.targetDate,
        dueDate: item.dueDate,
        reminders: item.reminders,
        weight: item.weight,
        manualProgressPercent: undefined,
        estimatedMinutes: item.estimatedMinutes,
        actualMinutes: undefined,
        estimatedCostCents: item.estimatedCostCents,
        actualCostCents: undefined,
      });

      await ctx.db.insert("workflowAttachments", {
        userId: args.userId,
        workflowItemId: newItemId,
        entityType: "build",
        entityId: newBuildId as string,
        entityKey: entityKey("build", newBuildId),
        role: "primary",
      });

      if (nodeAtt) {
        await ctx.db.insert("workflowAttachments", {
          userId: args.userId,
          workflowItemId: newItemId,
          entityType: "cosplayNode",
          entityId: nodeAtt.entityId,
          entityKey: entityKey("cosplayNode", nodeAtt.entityId as Id<"cosplayNodes">),
          role: "progress_source",
          buildContextId: newBuildId,
        });
      }
    }

    return idempotentRecord(ctx, args.idempotencyKey, args.userId, newBuildId);
  },
});

export const linkItems = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(legacyNodeIdValidator),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const validIds = await resolveLegacyNodeIds(ctx, args.userId, args.closetItemIds);
    await replaceBuildRootLinks(ctx, args.userId, args.buildId, validIds);
  },
});

export const addNodesToBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeIds: v.array(v.id("cosplayNodes")),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replay = await idempotentReplay(ctx, args.idempotencyKey);
    if (replay.hit) return;
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");

    await addBuildRootLinks(ctx, args.userId, args.buildId, args.cosplayNodeIds);
    await idempotentRecord(ctx, args.idempotencyKey, args.userId, undefined);
  },
});

export const addItemsToBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(legacyNodeIdValidator),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const resolvedIds = await resolveLegacyNodeIds(ctx, args.userId, args.closetItemIds);
    await addBuildRootLinks(ctx, args.userId, args.buildId, resolvedIds);
  },
});

export const removeNodeFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeId: v.id("cosplayNodes"),
  },
  handler: async (ctx, args) =>
    await removeBuildRootLink(ctx, args.userId, args.buildId, args.cosplayNodeId),
});

export const removeItemFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemId: legacyNodeIdValidator,
  },
  handler: async (ctx, args) => {
    const [resolvedId] = await resolveLegacyNodeIds(ctx, args.userId, [args.closetItemId]);
    if (!resolvedId) return;
    await removeBuildRootLink(ctx, args.userId, args.buildId, resolvedId);
  },
});

export const removeNodesFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeIds: v.array(v.id("cosplayNodes")),
  },
  handler: async (ctx, args) => {
    for (const cosplayNodeId of args.cosplayNodeIds) {
      await removeBuildRootLink(ctx, args.userId, args.buildId, cosplayNodeId);
    }
  },
});

export const removeItemsFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(legacyNodeIdValidator),
  },
  handler: async (ctx, args) => {
    const resolvedIds = await resolveLegacyNodeIds(ctx, args.userId, args.closetItemIds);
    for (const cosplayNodeId of resolvedIds) {
      await removeBuildRootLink(ctx, args.userId, args.buildId, cosplayNodeId);
    }
  },
});

export const getBuildsUsingNode = query({
  args: { cosplayNodeId: v.id("cosplayNodes") },
  handler: async (ctx, args) => await listBuildsUsingNode(ctx, args.cosplayNodeId),
});

export const getBuildsUsingClosetItem = query({
  args: { closetItemId: legacyNodeIdValidator },
  handler: async (ctx, args) => {
    const [resolvedId] = await resolveLegacyNodeIds(ctx, undefined, [args.closetItemId]);
    if (!resolvedId) return [];
    return await listBuildsUsingNode(ctx, resolvedId);
  },
});
