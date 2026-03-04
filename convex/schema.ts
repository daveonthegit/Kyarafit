import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    tier: v.string(),
    currentUsageMb: v.number(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    subscriptionCurrentPeriodEnd: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"]),

  closetItems: defineTable({
    userId: v.string(),
    name: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    costCents: v.optional(v.number()),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.id("buildTasks")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_completionTaskId", ["completionTaskId"]),

  builds: defineTable({
    userId: v.string(),
    name: v.string(),
    character: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  buildItemLinks: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    closetItemId: v.id("closetItems"),
  })
    .index("by_buildId", ["buildId"])
    .index("by_closetItemId", ["closetItemId"]),

  buildTasks: defineTable({
    userId: v.string(),
    buildId: v.optional(v.id("builds")),
    label: v.string(),
    closetItemId: v.optional(v.id("closetItems")),
    sortOrder: v.number(),
    checked: v.boolean(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_closetItemId", ["closetItemId"]),

  conventions: defineTable({
    userId: v.string(),
    name: v.string(),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    startDate: v.string(),
    endDate: v.string(),
    archived: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  conventionDayPlans: defineTable({
    userId: v.string(),
    conventionId: v.id("conventions"),
    date: v.string(),
    buildId: v.optional(v.id("builds")),
    notes: v.optional(v.string()),
  }).index("by_conventionId", ["conventionId"]),

  packingListItems: defineTable({
    userId: v.string(),
    conventionId: v.id("conventions"),
    date: v.optional(v.string()),
    buildId: v.optional(v.id("builds")),
    closetItemId: v.optional(v.id("closetItems")),
    label: v.string(),
    checked: v.boolean(),
  })
    .index("by_conventionId", ["conventionId"])
    .index("by_userId", ["userId"]),

  buildReferenceImages: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"]),

  buildProcessPictures: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"]),
});
