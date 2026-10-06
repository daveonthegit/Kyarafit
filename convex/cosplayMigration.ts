import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./admin";
import { COSPLAY_ELEMENTS_MIGRATION_SEQUENCE, migrations } from "./migrations";

/**
 * Runs the global closet -> element backfill over *every* user's rows and accepts
 * `reset`, so it is admin-only. Any signed-up account could previously trigger it.
 */
export const migrateClosetItemsToCosplayNodes = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    await requireAdmin(ctx);
    return ctx.runMutation(internal.migrations.run, {
      fn: COSPLAY_ELEMENTS_MIGRATION_SEQUENCE[0],
      next: COSPLAY_ELEMENTS_MIGRATION_SEQUENCE.slice(1) as string[],
      dryRun: args.dryRun,
      reset: args.reset,
    });
  },
});

/** Global migration state — admin-only, matching the mutation above. */
export const getCosplayMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return migrations.getStatus(ctx, {
      migrations: [...COSPLAY_ELEMENTS_MIGRATION_SEQUENCE],
    });
  },
});
