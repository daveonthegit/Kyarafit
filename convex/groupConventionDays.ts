import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateDateString } from "./lib/validation";

/** List selected convention days for a group (optionally for one convention). */
export const listForGroup = query({
  args: {
    groupId: v.id("groups"),
    conventionId: v.optional(v.id("conventions")),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    if (args.conventionId) {
      return all.filter((d) => d.conventionId === args.conventionId);
    }
    return all;
  },
});

/** List groups that have selected days for this convention (for convention page "groups at this con"). */
export const listGroupsForConvention = query({
  args: { conventionId: v.id("conventions") },
  handler: async (ctx, args) => {
    const days = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_conventionId", (q) => q.eq("conventionId", args.conventionId))
      .collect();
    const groupIds = Array.from(new Set(days.map((d) => d.groupId)));
    const groups = await Promise.all(groupIds.map((id) => ctx.db.get(id)));
    return groups.filter((g): g is NonNullable<typeof g> => g != null);
  },
});

/** List selected days grouped by convention (for group page). Returns convention name and dates. */
export const listForGroupWithConventions = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const days = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const byConvention = new Map<
      string,
      { conventionId: string; conventionName: string; startDate: string; endDate: string; dates: string[] }
    >();
    for (const d of days) {
      const key = d.conventionId;
      if (!byConvention.has(key)) {
        const con = await ctx.db.get(d.conventionId);
        byConvention.set(key, {
          conventionId: key,
          conventionName: con?.name ?? "Unknown",
          startDate: con?.startDate ?? "",
          endDate: con?.endDate ?? "",
          dates: [],
        });
      }
      byConvention.get(key)!.dates.push(d.date);
    }
    return Array.from(byConvention.values()).map((v) => ({
      ...v,
      dates: v.dates.sort(),
    }));
  },
});

/** Set which days of a convention the group is doing the cosplay. Replaces existing days for this group+convention. Caller must be group admin. Dates must be YYYY-MM-DD; optionally validated against convention start/end. */
export const setDays = mutation({
  args: {
    groupId: v.id("groups"),
    conventionId: v.id("conventions"),
    userId: v.string(),
    dates: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Only group admins can set convention days");
    }
    const convention = await ctx.db.get(args.conventionId);
    if (!convention) throw new Error("Convention not found");
    const start = convention.startDate;
    const end = convention.endDate;

    const validatedDates: string[] = [];
    for (const d of args.dates) {
      const date = validateDateString(d, "Date");
      if (date < start || date > end) {
        throw new Error(`Date ${date} is outside convention range ${start}–${end}`);
      }
      validatedDates.push(date);
    }
    const uniqueDates = Array.from(new Set(validatedDates)).sort();

    const existing = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const toDelete = existing.filter(
      (e) => e.conventionId === args.conventionId
    );
    for (const row of toDelete) await ctx.db.delete(row._id);

    for (const date of uniqueDates) {
      await ctx.db.insert("groupConventionDays", {
        groupId: args.groupId,
        conventionId: args.conventionId,
        date,
      });
    }
    return uniqueDates;
  },
});

/** Add one day. Caller must be group admin. */
export const addDay = mutation({
  args: {
    groupId: v.id("groups"),
    conventionId: v.id("conventions"),
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Only group admins can add convention days");
    }
    const convention = await ctx.db.get(args.conventionId);
    if (!convention) throw new Error("Convention not found");
    const date = validateDateString(args.date, "Date");
    if (date < convention.startDate || date > convention.endDate) {
      throw new Error(
        `Date must be within convention range ${convention.startDate}–${convention.endDate}`
      );
    }
    const existing = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId_conventionId_date", (q) =>
        q
          .eq("groupId", args.groupId)
          .eq("conventionId", args.conventionId)
          .eq("date", date)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("groupConventionDays", {
      groupId: args.groupId,
      conventionId: args.conventionId,
      date,
    });
  },
});

/** Remove one day. Caller must be group admin. */
export const removeDay = mutation({
  args: {
    groupId: v.id("groups"),
    conventionId: v.id("conventions"),
    userId: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.userId)
      )
      .unique();
    if (!membership || membership.role !== "admin") {
      throw new Error("Only group admins can remove convention days");
    }
    const date = validateDateString(args.date, "Date");
    const row = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId_conventionId_date", (q) =>
        q
          .eq("groupId", args.groupId)
          .eq("conventionId", args.conventionId)
          .eq("date", date)
      )
      .unique();
    if (row) await ctx.db.delete(row._id);
  },
});
