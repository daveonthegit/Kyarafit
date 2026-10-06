import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { deletionJob } from "./lib/deletionReferences";

/** Auth signup can precede the app mirror; the verified auth subject is authoritative. */
export const accountAvailable = internalQuery({
  args: { externalId: v.string() },
  handler: async (ctx, args) => !(await deletionJob(ctx, args.externalId)),
});

/** Resolve current recipient data immediately before dispatch, including legacy queued actions. */
export const resolve = internalQuery({
  args: { externalId: v.optional(v.string()), to: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = args.externalId
      ? await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId!))
          .unique()
      : args.to
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.to!))
            .unique()
        : null;
    if (!user || (await deletionJob(ctx, user.externalId))) return null;
    return { to: user.email, name: user.name };
  },
});
