import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    tier: v.string(),
    currentUsageMb: v.number(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(v.string()),
    subscriptionCurrentPeriodEnd: v.optional(v.string()),
    focusedBuildId: v.optional(v.id("builds")),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    profileVisibility: v.optional(v.string()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .index("by_username", ["username"]),

  closetItems: defineTable({
    userId: v.string(),
    name: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    itemLink: v.optional(v.string()),
    costCents: v.optional(v.number()),
    status: v.optional(v.string()),
    completionTaskId: v.optional(v.id("buildTasks")),
    parentItemId: v.optional(v.id("closetItems")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_completionTaskId", ["completionTaskId"])
    .index("by_parentItemId", ["parentItemId"]),

  cosplayNodes: defineTable({
    userId: v.string(),
    legacyClosetItemId: v.optional(v.id("closetItems")),
    nodeType: v.string(),
    name: v.string(),
    category: v.optional(v.string()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    pricingMode: v.optional(v.string()),
    directCostCents: v.optional(v.number()),
    unitCostCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    purchaseStatus: v.optional(v.string()),
    buildStatus: v.optional(v.string()),
    materialStatus: v.optional(v.string()),
    manualOverallBucket: v.optional(v.string()),
    buildInstructions: v.optional(v.string()),
    finishedPhotoUrls: v.optional(v.array(v.string())),
    consumable: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_nodeType", ["userId", "nodeType"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_legacyClosetItemId", ["legacyClosetItemId"]),

  cosplayNodeLinks: defineTable({
    userId: v.string(),
    parentNodeId: v.id("cosplayNodes"),
    childNodeId: v.id("cosplayNodes"),
    sortOrder: v.number(),
    linkMode: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_parentNodeId", ["parentNodeId"])
    .index("by_childNodeId", ["childNodeId"])
    .index("by_parentNodeId_sortOrder", ["parentNodeId", "sortOrder"]),

  buildCosplayLinks: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeId: v.id("cosplayNodes"),
    sortOrder: v.number(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"])
    .index("by_buildId_sortOrder", ["buildId", "sortOrder"]),

  buildNodeStates: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    cosplayNodeId: v.id("cosplayNodes"),
    purchaseStatus: v.optional(v.string()),
    buildStatus: v.optional(v.string()),
    materialStatus: v.optional(v.string()),
    manualOverallBucket: v.optional(v.string()),
    pricingMode: v.optional(v.string()),
    directCostCents: v.optional(v.number()),
    unitCostCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    purchasedAt: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  })
    .index("by_buildId", ["buildId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"])
    .index("by_buildId_cosplayNodeId", ["buildId", "cosplayNodeId"]),

  builds: defineTable({
    userId: v.string(),
    name: v.string(),
    character: v.optional(v.string()),
    status: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    /** Focal point for hero display: 0–1, used as object-position (center of interest). */
    imageFocalX: v.optional(v.number()),
    imageFocalY: v.optional(v.number()),
    budgetCents: v.optional(v.number()),
    targetDate: v.optional(v.string()),
    visibility: v.optional(v.string()),
    shareToken: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_shareToken", ["shareToken"])
    .index("by_groupId", ["groupId"])
    .index("by_visibility", ["visibility"]),

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
    cosplayNodeId: v.optional(v.id("cosplayNodes")),
    packingListItemId: v.optional(v.id("packingListItems")),
    sortOrder: v.number(),
    checked: v.boolean(),
    dueDate: v.optional(v.string()),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_closetItemId", ["closetItemId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"])
    .index("by_packingListItemId", ["packingListItemId"]),

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
    cosplayNodeId: v.optional(v.id("cosplayNodes")),
    label: v.string(),
    notes: v.optional(v.string()),
    checked: v.boolean(),
  })
    .index("by_conventionId", ["conventionId"])
    .index("by_userId", ["userId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"]),

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

  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    createdBy: v.string(),
    visibility: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdBy", ["createdBy"])
    .index("by_visibility", ["visibility"]),

  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.string(),
    role: v.string(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"])
    .index("by_groupId_userId", ["groupId", "userId"]),

  groupConventionDays: defineTable({
    groupId: v.id("groups"),
    conventionId: v.id("conventions"),
    date: v.string(),
  })
    .index("by_groupId", ["groupId"])
    .index("by_conventionId", ["conventionId"])
    .index("by_groupId_conventionId_date", ["groupId", "conventionId", "date"]),

  follows: defineTable({
    followerId: v.string(),
    followingId: v.string(),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_following", ["followerId", "followingId"]),

  buildLikes: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_userId_buildId", ["userId", "buildId"]),

  buildComments: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"]),

  buildCollaborators: defineTable({
    buildId: v.id("builds"),
    userId: v.string(),
    role: v.string(),
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"]),

  activities: defineTable({
    userId: v.string(),
    kind: v.string(),
    buildId: v.optional(v.id("builds")),
    groupId: v.optional(v.id("groups")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});
