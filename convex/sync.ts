import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Incremental pull for the local-first read path (DATA_AND_SYNC.md §6, REQ-D63). Returns the
 * authenticated user's documents changed after the `since` cursor across **every** local-first table,
 * so a client can warm its local store on cold start (`since = 0` for a full first-run seed,
 * REQ-D82) and top it up on reconnect.
 *
 * A row is "changed since `since`" when it was either created after the cursor (`_creationTime`) or
 * field-edited after it (`updatedAt`). This captures field-level edit deltas — not just creates — so
 * an edit that bumps `updatedAt` without inserting a new row is visible to an incremental pull
 * (REQ-D40 maintains `updatedAt` on every write).
 *
 * The returned `cursor` advances on `updatedAt` (the edit clock), so the next pull only re-fetches
 * rows touched since. Rows that predate the sync-metadata migration (no `updatedAt`) are still seeded
 * via the `_creationTime` create scan; they simply do not advance the cursor.
 *
 * The consumer is the mobile/web sync worker warm-up; it is not dead code.
 */

/** Union creates (`_creationTime` scan) with field-edits (`updatedAt` scan), de-duped by `_id`. */
function mergeById<T extends { _id: string }>(created: T[], edited: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of created) byId.set(row._id, row);
  for (const row of edited) byId.set(row._id, row);
  return Array.from(byId.values());
}

/** Advance the cursor on the edit clock (`updatedAt`); created-only rows do not move it. */
function advanceCursor(rows: Array<{ updatedAt?: number }>, cursor: number): number {
  let next = cursor;
  for (const row of rows) {
    if (typeof row.updatedAt === "number" && row.updatedAt > next) next = row.updatedAt;
  }
  return next;
}

const clampLimit = (limit: number | undefined): number => Math.min(Math.max(limit ?? 500, 1), 1000);

export const listChangedSince = query({
  args: {
    since: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const empty = {
      cosplayNodes: [],
      builds: [],
      buildTasks: [],
      workflowItems: [],
      workflowAttachments: [],
      workflowDependencies: [],
      conventions: [],
      conventionDayPlans: [],
      packingListItems: [],
      buildReferenceImages: [],
      buildProcessPictures: [],
      buildProgressUpdates: [],
    };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return { ...empty, cursor: args.since };
    }
    const userId = identity.subject;
    const since = args.since;
    const limit = clampLimit(args.limit);

    const cosplayNodes = mergeById(
      await ctx.db
        .query("cosplayNodes")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("cosplayNodes")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const builds = mergeById(
      await ctx.db
        .query("builds")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("builds")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const buildTasks = mergeById(
      await ctx.db
        .query("buildTasks")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("buildTasks")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const workflowItems = mergeById(
      await ctx.db
        .query("workflowItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("workflowItems")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const workflowAttachments = mergeById(
      await ctx.db
        .query("workflowAttachments")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("workflowAttachments")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const workflowDependencies = mergeById(
      await ctx.db
        .query("workflowDependencies")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("workflowDependencies")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const conventions = mergeById(
      await ctx.db
        .query("conventions")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("conventions")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const conventionDayPlans = mergeById(
      await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("conventionDayPlans")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const packingListItems = mergeById(
      await ctx.db
        .query("packingListItems")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("packingListItems")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const buildReferenceImages = mergeById(
      await ctx.db
        .query("buildReferenceImages")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("buildReferenceImages")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const buildProcessPictures = mergeById(
      await ctx.db
        .query("buildProcessPictures")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("buildProcessPictures")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    const buildProgressUpdates = mergeById(
      await ctx.db
        .query("buildProgressUpdates")
        .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", since))
        .order("asc")
        .take(limit),
      await ctx.db
        .query("buildProgressUpdates")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", since))
        .order("asc")
        .take(limit)
    );

    let cursor = since;
    for (const rows of [
      cosplayNodes,
      builds,
      buildTasks,
      workflowItems,
      workflowAttachments,
      workflowDependencies,
      conventions,
      conventionDayPlans,
      packingListItems,
      buildReferenceImages,
      buildProcessPictures,
      buildProgressUpdates,
    ]) {
      cursor = advanceCursor(rows, cursor);
    }

    return {
      cosplayNodes,
      builds,
      buildTasks,
      workflowItems,
      workflowAttachments,
      workflowDependencies,
      conventions,
      conventionDayPlans,
      packingListItems,
      buildReferenceImages,
      buildProcessPictures,
      buildProgressUpdates,
      cursor,
    };
  },
});
