import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireIdentity } from "./lib/authz";
import { EXPORT_COLLECTIONS, portableRecord } from "./lib/exportCollections";

export const listCollection = query({
  args: { collection: v.union(...EXPORT_COLLECTIONS.map((name) => v.literal(name))) },
  handler: async (ctx, { collection }) => {
    const actorId = await requireIdentity(ctx);
    const rows = await (async () => {
      switch (collection) {
        case "users":
          return ctx.db.query("users").withIndex("by_externalId", (q) => q.eq("externalId", actorId)).collect();
        case "groups":
          return ctx.db.query("groups").withIndex("by_createdBy", (q) => q.eq("createdBy", actorId)).collect();
        case "follows":
          return ctx.db.query("follows").withIndex("by_follower", (q) => q.eq("followerId", actorId)).collect();
        case "userPushPreferences":
        case "broadcasts": {
          const user = await ctx.db.query("users").withIndex("by_externalId", (q) => q.eq("externalId", actorId)).unique();
          if (!user) return [];
          if (collection === "userPushPreferences") {
            return ctx.db.query("userPushPreferences").withIndex("by_userId", (q) => q.eq("userId", user._id)).collect();
          }
          return ctx.db.query("broadcasts").filter((q) => q.eq(q.field("createdBy"), user._id)).collect();
        }
        case "workflowTemplateItems": {
          const templates = await ctx.db.query("workflowTemplates").withIndex("by_userId", (q) => q.eq("userId", actorId)).collect();
          const items = await Promise.all(templates.map((template) => ctx.db.query("workflowTemplateItems").withIndex("by_templateId", (q) => q.eq("templateId", template._id)).collect()));
          return items.flat();
        }
        case "groupConventionDays": {
          const groups = await ctx.db.query("groups").withIndex("by_createdBy", (q) => q.eq("createdBy", actorId)).collect();
          const days = await Promise.all(groups.map((group) => ctx.db.query("groupConventionDays").withIndex("by_groupId", (q) => q.eq("groupId", group._id)).collect()));
          return days.flat();
        }
        case "buildCosplayLinks":
        case "buildNodeStates":
        case "buildItemLinks":
          return ctx.db.query(collection).filter((q) => q.eq(q.field("userId"), actorId)).collect();
        case "replicaRows":
        case "replicaConflicts":
          return ctx.db.query(collection).withIndex("by_user_rev", (q) => q.eq("userId", actorId)).collect();
        default:
          return ctx.db.query(collection).withIndex("by_userId", (q) => q.eq("userId", actorId)).collect();
      }
    })();
    return rows.map((row) => portableRecord(collection, row));
  },
});
