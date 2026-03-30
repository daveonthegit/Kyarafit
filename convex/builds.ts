import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { canUserEditBuild } from "./lib/buildAccess";
import { deriveNodeSummary } from "./cosplayNodes";
import { deriveBuildBlendedProgress, deriveStatusProgress } from "./lib/workflowProgress";
import { getBuildScopedWorkflow } from "./workflow";
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
          ...b,
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
          ...b,
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
          ...b,
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
  },
  handler: async (ctx, args) => {
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
  },
});

export const update = mutation({
  args: {
    id: v.id("builds"),
    userId: v.string(),
    name: v.optional(v.string()),
    character: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    imageFocalX: v.optional(v.number()),
    imageFocalY: v.optional(v.number()),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    visibility: v.optional(v.string()),
    shareToken: v.optional(v.union(v.string(), v.null())),
    groupId: v.optional(v.union(v.id("groups"), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, userId, ...fields } = args;
    const build = await ctx.db.get(id);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, id, userId);
    if (!canEdit) throw new Error("Not authorized to update this build");
    const newStorageId = fields.imageStorageId;
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
      } else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
    return await ctx.db.get(id);
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
  },
  handler: async (ctx, args) => {
    if (!VALID_STATUSES.includes(args.status as (typeof VALID_STATUSES)[number])) {
      throw new Error("Invalid status");
    }
    for (const id of args.ids) {
      const build = await ctx.db.get(id);
      if (!build || build.userId !== args.userId) continue;
      await ctx.db.patch(id, { status: args.status });
    }
  },
});

export const getNodes = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => await getBuildRootNodeIds(ctx, args.buildId),
});

export const getItems = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => await getBuildRootNodeIds(ctx, args.buildId),
});

/** Returns aggregated summary for one build (status, progress, dates, linked items, budget). Used by Summary dashboard. */
export const getSummary = query({
  args: {
    buildId: v.id("builds"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build || build.userId !== args.userId) return null;

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
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");

    await addBuildRootLinks(ctx, args.userId, args.buildId, args.cosplayNodeIds);
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
