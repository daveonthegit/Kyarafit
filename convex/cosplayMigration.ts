import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { COSPLAY_ELEMENTS_MIGRATION_SEQUENCE, migrations } from "./migrations";

export const migrateClosetItemsToCosplayNodes = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }
    return ctx.runMutation(internal.migrations.run, {
      fn: COSPLAY_ELEMENTS_MIGRATION_SEQUENCE[0],
      next: COSPLAY_ELEMENTS_MIGRATION_SEQUENCE.slice(1) as string[],
      dryRun: args.dryRun,
      reset: args.reset,
    });
  },
});

export const getCosplayMigrationStatus = query({
  args: {},
  handler: async (ctx) =>
    migrations.getStatus(ctx, {
      migrations: [...COSPLAY_ELEMENTS_MIGRATION_SEQUENCE],
    }),
});
