import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { requireFeature } from "./lib/entitlements";
import { MAX_LENGTH, sanitizeAndLimit, sanitizeOptional } from "./lib/validation";

const VALID_VISIBILITIES = ["private", "public"] as const;
const VALID_ROLES = ["admin", "member"] as const;

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // REQ-019: creating a group is a paid (cloud-hosted) action; joining stays free.
    await requireFeature(ctx, args.userId, "group_create");
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, args.imageStorageId);
    }
    const name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
    const description = sanitizeOptional(args.description, MAX_LENGTH.notes, "Description");
    const visibility: "private" | "public" = VALID_VISIBILITIES.includes(
      args.visibility as (typeof VALID_VISIBILITIES)[number]
    )
      ? (args.visibility as "private" | "public")
      : "private";
    const groupId = await ctx.db.insert("groups", {
      name,
      description,
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      createdBy: args.userId,
      visibility,
      createdAt: Date.now(),
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: args.userId,
      role: "admin",
    });
    return await ctx.db.get(groupId);
  },
});

export const get = query({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** List groups the user is a member of. */
export const listForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const groups = await Promise.all(memberships.map((m) => ctx.db.get(m.groupId)));
    return groups.filter((g): g is NonNullable<typeof g> => g != null);
  },
});

/** Get group with member list and current user's role. Returns null if group not found or not visible to user. */
export const getWithMembers = query({
  args: {
    groupId: v.id("groups"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const isMember = args.userId ? members.some((m) => m.userId === args.userId) : false;
    if (!isMember && group.visibility !== "public") return null;
    const myMembership = args.userId ? members.find((m) => m.userId === args.userId) : undefined;
    const memberUserIds = members.map((m) => m.userId);
    const users = await Promise.all(
      memberUserIds.map((id) =>
        ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", id))
          .unique()
      )
    );
    return {
      group,
      members: members.map((m) => {
        const u = users.find((x) => x?.externalId === m.userId);
        return {
          userId: m.userId,
          role: m.role,
          name: u?.name ?? u?.displayName ?? u?.email ?? "Unknown",
          image: u?.image,
          imageStorageId: u?.imageStorageId,
        };
      }),
      myRole: myMembership?.role,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("groups"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Group not found");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) => q.eq("groupId", args.id).eq("userId", args.userId))
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized to update this group");
    }
    const newStorageId = args.imageStorageId;
    const oldStorageId = group.imageStorageId;
    if (oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, args.userId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, args.userId, newStorageId);
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = sanitizeAndLimit(args.name, MAX_LENGTH.name, "Name");
    if (args.description !== undefined)
      patch.description = sanitizeOptional(args.description, MAX_LENGTH.notes, "Description");
    if (args.imageUrl !== undefined) patch.imageUrl = args.imageUrl;
    if (args.imageStorageId !== undefined) patch.imageStorageId = args.imageStorageId;
    if (
      args.visibility !== undefined &&
      VALID_VISIBILITIES.includes(args.visibility as (typeof VALID_VISIBILITIES)[number])
    ) {
      patch.visibility = args.visibility;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, patch);
    }
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { groupId: v.id("groups"), userId: v.string() },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized to delete this group");
    }
    if (group.imageStorageId) {
      await subtractUsageForStorageId(ctx, args.userId, group.imageStorageId);
    }
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    const buildsWithGroup = await ctx.db
      .query("builds")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const b of buildsWithGroup) {
      await ctx.db.patch(b._id, { groupId: undefined });
    }
    const days = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const d of days) await ctx.db.delete(d._id);
    await ctx.db.delete(args.groupId);
  },
});

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.string(),
    newUserId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can add members");
    }
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.newUserId)
      )
      .unique();
    if (existing) throw new Error("User is already a member");
    const role: "admin" | "member" = VALID_ROLES.includes(args.role as (typeof VALID_ROLES)[number])
      ? (args.role as "admin" | "member")
      : "member";
    await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.newUserId,
      role,
    });
  },
});

export const removeMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.string(),
    removeUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const actorMembership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!actorMembership) throw new Error("Not a member");
    const isAdmin = actorMembership.role === "admin";
    if (args.removeUserId !== args.userId && !isAdmin) {
      throw new Error("Only admins can remove other members");
    }
    const target = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.removeUserId)
      )
      .unique();
    if (!target) return;
    await ctx.db.delete(target._id);
    if (args.removeUserId === args.userId) {
      const buildsWithGroup = await ctx.db
        .query("builds")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .collect();
      const myBuilds = buildsWithGroup.filter((b) => b.userId === args.userId);
      for (const b of myBuilds) {
        await ctx.db.patch(b._id, { groupId: undefined });
      }
    }
  },
});

export const setMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.string(),
    targetUserId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can change roles");
    }
    if (!VALID_ROLES.includes(args.role as (typeof VALID_ROLES)[number])) {
      throw new Error("Invalid role");
    }
    const target = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.targetUserId)
      )
      .unique();
    if (!target) throw new Error("Member not found");
    await ctx.db.patch(target._id, { role: args.role });
  },
});
