import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { checkLimitAndAddUsage, subtractUsageForStorageId } from "./storageUsage";
import { requireFeature } from "./lib/entitlements";
import { MAX_LENGTH, sanitizeAndLimit, sanitizeOptional } from "./lib/validation";
import { optionalIdentity, requireIdentity } from "./lib/authz";
import { getGroupMembership, isGroupMember } from "./lib/buildAccess";

const VALID_VISIBILITIES = ["private", "public"] as const;
const VALID_ROLES = ["admin", "member"] as const;

export const create = mutation({
  args: {
    userId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    // REQ-019: creating a group is a paid (cloud-hosted) action; joining stays free.
    await requireFeature(ctx, actorId, "group_create");
    if (args.imageStorageId) {
      await checkLimitAndAddUsage(ctx, actorId, args.imageStorageId);
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
      createdBy: actorId,
      visibility,
      createdAt: Date.now(),
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: actorId,
      role: "admin",
    });
    return await ctx.db.get(groupId);
  },
});

/**
 * One group. Takes no actor argument, so the visibility rule is written out;
 * it previously returned any group document, `private` included, to anyone.
 * Public groups stay readable without a session.
 */
export const get = query({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.id);
    if (!group) return null;
    if (group.visibility === "public") return group;
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return null;
    return (await isGroupMember(ctx, args.id, actorId)) ? group : null;
  },
});

/** Groups the acting user is a member of. `userId` is retained for deployed clients but ignored. */
export const listForUser = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const actorId = await optionalIdentity(ctx);
    if (!actorId) return [];
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", actorId))
      .collect();
    const groups = await Promise.all(memberships.map((m) => ctx.db.get(m.groupId)));
    return groups.filter((g): g is NonNullable<typeof g> => g != null);
  },
});

/**
 * Group with its member list and the acting user's role. Returns null when the
 * group is private and the caller is not a member — membership is established from
 * the session, so a caller-supplied id can no longer read a private group's roster.
 * `userId` is retained for deployed clients but ignored.
 */
export const getWithMembers = query({
  args: {
    groupId: v.id("groups"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await optionalIdentity(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const isMember = actorId ? members.some((m) => m.userId === actorId) : false;
    if (!isMember && group.visibility !== "public") return null;
    const myMembership = actorId ? members.find((m) => m.userId === actorId) : undefined;
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
        // Never fall back to `email`: this list is readable by every member (and by
        // anyone for a public group), which made it an email-harvesting surface.
        const username = u?.username?.trim();
        return {
          userId: m.userId,
          role: m.role,
          name:
            u?.name?.trim() ||
            u?.displayName?.trim() ||
            (username ? `@${username}` : null) ||
            "Unknown",
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
    userId: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    visibility: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const group = await ctx.db.get(args.id);
    if (!group) throw new Error("Group not found");
    const membership = await getGroupMembership(ctx, args.id, actorId);
    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized to update this group");
    }
    const newStorageId = args.imageStorageId;
    const oldStorageId = group.imageStorageId;
    if (newStorageId !== undefined && oldStorageId !== undefined && oldStorageId !== newStorageId) {
      await subtractUsageForStorageId(ctx, actorId, oldStorageId);
    }
    if (newStorageId !== undefined && newStorageId !== oldStorageId) {
      await checkLimitAndAddUsage(ctx, actorId, newStorageId);
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
  args: { groupId: v.id("groups"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");
    const membership = await getGroupMembership(ctx, args.groupId, actorId);
    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized to delete this group");
    }
    if (group.imageStorageId) {
      await subtractUsageForStorageId(ctx, actorId, group.imageStorageId);
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

/**
 * Add a member. Admin membership is established from the session: a caller-supplied
 * `userId` let anyone insert themselves into any group as `admin`, and the resulting
 * row is indistinguishable from a legitimate grant. `userId` is retained for
 * deployed clients but ignored; `newUserId` names the member being added and stays
 * required.
 */
export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.optional(v.string()),
    newUserId: v.string(),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const membership = await getGroupMembership(ctx, args.groupId, actorId);
    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can add members");
    }
    const existing = await getGroupMembership(ctx, args.groupId, args.newUserId);
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
    userId: v.optional(v.string()),
    removeUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const actorMembership = await getGroupMembership(ctx, args.groupId, actorId);
    if (!actorMembership) throw new Error("Not a member");
    const isAdmin = actorMembership.role === "admin";
    if (args.removeUserId !== actorId && !isAdmin) {
      throw new Error("Only admins can remove other members");
    }
    const target = await getGroupMembership(ctx, args.groupId, args.removeUserId);
    if (!target) return;
    await ctx.db.delete(target._id);
    if (args.removeUserId === actorId) {
      const buildsWithGroup = await ctx.db
        .query("builds")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .collect();
      const myBuilds = buildsWithGroup.filter((b) => b.userId === actorId);
      for (const b of myBuilds) {
        await ctx.db.patch(b._id, { groupId: undefined });
      }
    }
  },
});

export const setMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.optional(v.string()),
    targetUserId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await requireIdentity(ctx);
    const membership = await getGroupMembership(ctx, args.groupId, actorId);
    if (!membership || membership.role !== "admin") {
      throw new Error("Only admins can change roles");
    }
    if (!VALID_ROLES.includes(args.role as (typeof VALID_ROLES)[number])) {
      throw new Error("Invalid role");
    }
    const target = await getGroupMembership(ctx, args.groupId, args.targetUserId);
    if (!target) throw new Error("Member not found");
    await ctx.db.patch(target._id, { role: args.role });
  },
});
