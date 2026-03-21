import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { canUserEditBuild } from "./lib/buildAccess";
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
      builds.map(async (b) => {
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const tasksChecked = tasks.filter((t) => t.checked).length;
        const tasksTotal = tasks.length;
        const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;
        const links = await ctx.db
          .query("buildItemLinks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        let totalCostCents = 0;
        for (const link of links) {
          const item = await ctx.db.get(link.closetItemId);
          if (item?.costCents != null) totalCostCents += item.costCents;
        }
        return {
          ...b,
          tasksTotal,
          tasksChecked,
          progress,
          totalCostCents,
        };
      })
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
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    const tasksChecked = tasks.filter((t) => t.checked).length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;
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

    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    const tasksChecked = tasks.filter((t) => t.checked).length;
    const tasksTotal = tasks.length;
    const progress = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;
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
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    return {
      ...build,
      tasksTotal: tasks.length,
      tasksChecked: tasks.filter((t) => t.checked).length,
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
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    return {
      ...build,
      tasksTotal: tasks.length,
      tasksChecked: tasks.filter((t) => t.checked).length,
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
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        return {
          ...b,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
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
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        return {
          ...b,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
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
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", b.userId))
          .unique();
        return {
          ...b,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
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
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const user = await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", b.userId))
          .unique();
        return {
          ...b,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
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
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
          .collect();
        const row = rows.find((r) => r.buildId === buildId);
        return {
          ...build,
          tasksTotal: tasks.length,
          tasksChecked: tasks.filter((t) => t.checked).length,
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
    // Cascade: delete tasks and item links
    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const t of tasks) await ctx.db.delete(t._id);

    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.id))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);

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
      const links = await ctx.db
        .query("buildItemLinks")
        .withIndex("by_buildId", (q) => q.eq("buildId", id))
        .collect();
      for (const l of links) await ctx.db.delete(l._id);
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

export const getItems = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    return links.map((l) => l.closetItemId);
  },
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

    const tasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    const tasksChecked = tasks.filter((t) => t.checked).length;
    const tasksTotal = tasks.length;
    const progressPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", build._id))
      .collect();
    let linkedItemCount = links.length;
    let linkedItemsCompleteCount = 0;
    let totalCostCents = 0;
    for (const link of links) {
      const item = await ctx.db.get(link.closetItemId);
      if (item) {
        if (item.status === "complete") linkedItemsCompleteCount += 1;
        totalCostCents += item.costCents ?? 0;
      }
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

/** Returns builds with their tasks and linked closet-item IDs — used by mobile sync. */
export const listWithDetails = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return await Promise.all(
      builds.map(async (b) => {
        const tasks = await ctx.db
          .query("buildTasks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        const links = await ctx.db
          .query("buildItemLinks")
          .withIndex("by_buildId", (q) => q.eq("buildId", b._id))
          .collect();
        return {
          ...b,
          tasks,
          linkedItemIds: links.map((l) => l.closetItemId as string),
        };
      })
    );
  },
});

export const linkItems = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(v.id("closetItems")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const uniqueRequestedIds = Array.from(new Set(args.closetItemIds));
    const existing = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const newIds = new Set(uniqueRequestedIds);
    // For items being unlinked: delete their build tasks and clear completionTaskId
    for (const l of existing) {
      if (newIds.has(l.closetItemId)) continue;
      const item = await ctx.db.get(l.closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const tasksForItem = await ctx.db
        .query("buildTasks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", l.closetItemId))
        .collect();
      const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
      for (const task of tasksInBuild) await ctx.db.delete(task._id);
      if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
        await ctx.db.patch(l.closetItemId, { completionTaskId: undefined });
      }
    }
    // Remove existing links
    for (const l of existing) await ctx.db.delete(l._id);

    // Only link items that exist and belong to the user (avoid orphan links and auth bypass)
    const validIds: typeof args.closetItemIds = [];
    for (const closetItemId of uniqueRequestedIds) {
      const item = await ctx.db.get(closetItemId);
      if (item && item.userId === args.userId) validIds.push(closetItemId);
    }

    // Create new links (one per valid item, no duplicates)
    for (const closetItemId of validIds) {
      await ctx.db.insert("buildItemLinks", {
        userId: args.userId,
        buildId: args.buildId,
        closetItemId,
      });
    }

    // Auto-create a completion task in this build for each linked item that doesn't already have one in this build
    const existingTasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const itemIdsWithTaskInBuild = new Set(
      existingTasks
        .map((t) => t.closetItemId)
        .filter((id): id is NonNullable<typeof id> => id != null)
    );
    let nextSortOrder = existingTasks.length;
    for (const closetItemId of validIds) {
      if (itemIdsWithTaskInBuild.has(closetItemId)) continue;
      const item = await ctx.db.get(closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const taskId = await ctx.db.insert("buildTasks", {
        userId: args.userId,
        buildId: args.buildId,
        label: `Complete ${item.name}`,
        closetItemId,
        sortOrder: nextSortOrder++,
        checked: false,
      });
      itemIdsWithTaskInBuild.add(closetItemId);
      let shouldSetCompletionTask: boolean;
      if (!item.completionTaskId) {
        shouldSetCompletionTask = true;
      } else {
        const existingTask = await ctx.db.get(item.completionTaskId);
        shouldSetCompletionTask = !existingTask || existingTask.userId !== args.userId;
      }
      if (shouldSetCompletionTask) {
        await ctx.db.patch(closetItemId, { completionTaskId: taskId });
      }
    }
  },
});

/** Add closet items to a build (merge with existing links). Does not remove current links. */
export const addItemsToBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(v.id("closetItems")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const existing = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const existingIds = new Set(existing.map((l) => l.closetItemId));
    const uniqueToAdd = Array.from(
      new Set(args.closetItemIds.filter((id) => !existingIds.has(id)))
    );
    // Only add items that exist and belong to the user
    const toAdd: typeof args.closetItemIds = [];
    for (const closetItemId of uniqueToAdd) {
      const item = await ctx.db.get(closetItemId);
      if (item && item.userId === args.userId) toAdd.push(closetItemId);
    }
    if (toAdd.length === 0) return;

    for (const closetItemId of toAdd) {
      await ctx.db.insert("buildItemLinks", {
        userId: args.userId,
        buildId: args.buildId,
        closetItemId,
      });
    }

    const existingTasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_buildId", (q) => q.eq("buildId", args.buildId))
      .collect();
    const itemIdsWithTaskInBuild = new Set(
      existingTasks
        .map((t) => t.closetItemId)
        .filter((id): id is NonNullable<typeof id> => id != null)
    );
    let nextSortOrder = existingTasks.length;
    for (const closetItemId of toAdd) {
      if (itemIdsWithTaskInBuild.has(closetItemId)) continue;
      const item = await ctx.db.get(closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const taskId = await ctx.db.insert("buildTasks", {
        userId: args.userId,
        buildId: args.buildId,
        label: `Complete ${item.name}`,
        closetItemId,
        sortOrder: nextSortOrder++,
        checked: false,
      });
      itemIdsWithTaskInBuild.add(closetItemId);
      let shouldSetCompletionTask: boolean;
      if (!item.completionTaskId) {
        shouldSetCompletionTask = true;
      } else {
        const existingTask = await ctx.db.get(item.completionTaskId);
        shouldSetCompletionTask = !existingTask || existingTask.userId !== args.userId;
      }
      if (shouldSetCompletionTask) {
        await ctx.db.patch(closetItemId, { completionTaskId: taskId });
      }
    }
  },
});

/** Remove a closet item from a build (delete the buildItemLink). Clears item's completionTaskId if that task belongs to this build. */
export const removeItemFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemId: v.id("closetItems"),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    const item = await ctx.db.get(args.closetItemId);
    if (!item || item.userId !== args.userId) {
      throw new Error("Not found or not authorized");
    }
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    for (const link of links) {
      if (link.buildId === args.buildId) {
        await ctx.db.delete(link._id);
        break;
      }
    }
    // Delete all tasks in this build that reference this closet item; clear completionTaskId if it was one of them
    const tasksForItem = await ctx.db
      .query("buildTasks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
    for (const task of tasksInBuild) {
      await ctx.db.delete(task._id);
    }
    if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
      await ctx.db.patch(args.closetItemId, { completionTaskId: undefined });
    }
  },
});

/** Remove multiple closet items from a build. Deletes all build tasks for each item in this build and clears completionTaskId when relevant. */
export const removeItemsFromBuild = mutation({
  args: {
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemIds: v.array(v.id("closetItems")),
  },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) throw new Error("Build not found");
    const canEdit = await canUserEditBuild(ctx, args.buildId, args.userId);
    if (!canEdit) throw new Error("Not authorized");
    for (const closetItemId of args.closetItemIds) {
      const item = await ctx.db.get(closetItemId);
      if (!item || item.userId !== args.userId) continue;
      const links = await ctx.db
        .query("buildItemLinks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", closetItemId))
        .collect();
      for (const link of links) {
        if (link.buildId === args.buildId) {
          await ctx.db.delete(link._id);
          break;
        }
      }
      // Delete all tasks in this build that reference this closet item; clear completionTaskId if it was one of them
      const tasksForItem = await ctx.db
        .query("buildTasks")
        .withIndex("by_closetItemId", (q) => q.eq("closetItemId", closetItemId))
        .collect();
      const tasksInBuild = tasksForItem.filter((t) => t.buildId === args.buildId);
      for (const task of tasksInBuild) {
        await ctx.db.delete(task._id);
      }
      if (item.completionTaskId && tasksInBuild.some((t) => t._id === item.completionTaskId)) {
        await ctx.db.patch(closetItemId, { completionTaskId: undefined });
      }
    }
  },
});

/** Returns build ids and names that link to this closet item (for closet item detail). Deduplicated by build id. */
export const getBuildsUsingClosetItem = query({
  args: { closetItemId: v.id("closetItems") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("buildItemLinks")
      .withIndex("by_closetItemId", (q) => q.eq("closetItemId", args.closetItemId))
      .collect();
    const buildIds = Array.from(new Set(links.map((l) => l.buildId)));
    const builds = await Promise.all(buildIds.map((buildId) => ctx.db.get(buildId)));
    return builds.flatMap((b) =>
      b && "name" in b
        ? [
            {
              _id: b._id,
              name: b.name,
              imageStorageId: b.imageStorageId,
              imageUrl: b.imageUrl,
              character: b.character,
            },
          ]
        : []
    );
  },
});
