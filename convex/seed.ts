import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Dev-only: creates starter seed data (one build, one convention, one closet
 * item linked to the build, one task). For local testing, demos, or Convex
 * dashboard — not for regular end users. Runs once per user (skips if user
 * already has any builds). Requires authentication.
 *
 * See FEATURES_CANONICAL §13 (Seed data).
 */
export const createStarter = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    const userId = identity.subject;

    const existingBuilds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existingBuilds) {
      return { skipped: true as const, reason: "User already has data" };
    }

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startDate = nextMonth.toISOString().slice(0, 10);
    const endDate = new Date(nextMonth.getTime() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const buildId = await ctx.db.insert("builds", {
      userId,
      name: "Sample build",
      status: "idea",
      character: "Sample character",
    });

    const conventionId = await ctx.db.insert("conventions", {
      userId,
      name: "Sample Convention",
      location: "Convention Center",
      startDate,
      endDate,
    });

    const closetItemId = await ctx.db.insert("closetItems", {
      userId,
      name: "Sample piece",
      category: "other",
      tags: [],
      status: "planned",
    });

    await ctx.db.insert("buildItemLinks", {
      userId,
      buildId,
      closetItemId,
    });

    await ctx.db.insert("buildTasks", {
      userId,
      buildId,
      label: "Finish sample task",
      sortOrder: 0,
      checked: false,
    });

    return {
      skipped: false as const,
      buildId,
      conventionId,
      closetItemId,
    };
  },
});
