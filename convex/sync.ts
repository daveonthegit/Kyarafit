import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Incremental pull for the local-first read path (blueprint §3.13.2, local-first plan §6 decision
 * #4). Returns the authenticated user's documents created after the `since` cursor for the
 * local-first tables, so a client can warm its local store on cold start (`since = 0` for a full
 * first-run seed) and top it up on reconnect.
 *
 * The cursor is `_creationTime` (always present and the implicit trailing field of the `by_userId`
 * index, so the range scan stays index-driven). This captures creates incrementally and the full
 * current state at `since = 0`; field-level edit deltas are out of scope until rows carry a
 * maintained `updatedAt`/`version` (offline scaffolding exists but is not yet bumped on write).
 *
 * The consumer is the mobile sync worker warm-up (`warmEntityRows`); it is not dead code.
 */
export const listChangedSince = query({
  args: {
    since: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return { builds: [], conventions: [], cursor: args.since };
    }
    const userId = identity.subject;
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);

    const builds = await ctx.db
      .query("builds")
      .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", args.since))
      .order("asc")
      .take(limit);

    const conventions = await ctx.db
      .query("conventions")
      .withIndex("by_userId", (q) => q.eq("userId", userId).gt("_creationTime", args.since))
      .order("asc")
      .take(limit);

    let cursor = args.since;
    for (const doc of builds) cursor = Math.max(cursor, doc._creationTime);
    for (const doc of conventions) cursor = Math.max(cursor, doc._creationTime);

    return { builds, conventions, cursor };
  },
});
