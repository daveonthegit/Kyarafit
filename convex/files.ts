import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalIdentity, requireIdentity } from "./lib/authz";
import { canReadStorageId } from "./lib/mediaAccess";

/** Mint an upload URL. Authentication required so uploads are attributable and not free. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolve a storage id to a fetchable URL, if the caller may see the blob.
 * Returns null rather than throwing when not: this query also serves signed-out
 * visitors on public share pages, and clients already treat null as "no image".
 * See `lib/mediaAccess.ts` for the rule.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const viewerId = await optionalIdentity(ctx);
    if (!(await canReadStorageId(ctx, args.storageId, viewerId))) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});
