import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { imageRefValidator } from "./lib/imageRef";

/**
 * Sync metadata carried by every local-first, user-owned row (DATA_AND_SYNC.md §4, REQ-D40).
 * All optional so the migration is non-breaking for rows written before the fields existed:
 * - `clientId`     stable client-minted id for offline-created rows.
 * - `version`      monotonically bumped on each write (optimistic concurrency / LWW tiebreak).
 * - `updatedAt`    ms timestamp bumped on every field write; basis for per-field LWW + pull deltas.
 * - `fieldUpdatedAt` per-field ms timestamps for field-level last-write-wins (REQ-D40/D65).
 * - `deletedAt`    soft-delete tombstone.
 */
const syncMetaFields = {
  clientId: v.optional(v.string()),
  version: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
  fieldUpdatedAt: v.optional(v.record(v.string(), v.number())),
  deletedAt: v.optional(v.number()),
};

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
    /** App role; omit or `"user"` for normal users, `"admin"` for broadcast/admin APIs. */
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  })
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_role", ["role"]),

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
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_completionTaskId", ["completionTaskId"])
    .index("by_parentItemId", ["parentItemId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  cosplayNodes: defineTable({
    userId: v.string(),
    legacyClosetItemId: v.optional(v.id("closetItems")),
    // Build-scoping migration (additive, backfilled by migrations:backfillCosplayNodeBuildScope).
    // Optional during transition: existing rows have no buildId until the backfill runs in each
    // deployment. Once backfill + rewiring land, buildId becomes the primary build link
    // (replacing buildCosplayLinks) and parentNodeId replaces cosplayNodeLinks nesting.
    buildId: v.optional(v.id("builds")),
    parentNodeId: v.optional(v.id("cosplayNodes")),
    sortOrder: v.optional(v.number()),
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
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_nodeType", ["userId", "nodeType"])
    .index("by_userId_category", ["userId", "category"])
    .index("by_legacyClosetItemId", ["legacyClosetItemId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_buildId", ["buildId"])
    .index("by_parentNodeId", ["parentNodeId"]),

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
    manualProgressPercent: v.optional(v.number()),
    visibility: v.optional(v.string()),
    shareToken: v.optional(v.string()),
    /** Optional toggles for what anonymous/unlisted-link viewers see on public pages. Undefined keys default to true (show section). */
    publicViewerSettings: v.optional(
      v.object({
        showExplorer: v.optional(v.boolean()),
        showTasks: v.optional(v.boolean()),
        showVisualBoard: v.optional(v.boolean()),
        showSummary: v.optional(v.boolean()),
        showNotes: v.optional(v.boolean()),
        showCollaborators: v.optional(v.boolean()),
      })
    ),
    groupId: v.optional(v.id("groups")),
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_shareToken", ["shareToken"])
    .index("by_groupId", ["groupId"])
    .index("by_visibility", ["visibility"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

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
    ...syncMetaFields,
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_closetItemId", ["closetItemId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"])
    .index("by_packingListItemId", ["packingListItemId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  workflowItems: defineTable({
    userId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    kind: v.string(),
    category: v.string(),
    status: v.string(),
    parentId: v.optional(v.id("workflowItems")),
    ancestorIds: v.array(v.id("workflowItems")),
    sortOrder: v.number(),
    scopeKind: v.string(),
    sourceKind: v.string(),
    priority: v.optional(v.number()),
    startDate: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    reminders: v.optional(
      v.array(
        v.object({
          kind: v.string(),
          date: v.string(),
        })
      )
    ),
    weight: v.optional(v.number()),
    manualProgressPercent: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    actualMinutes: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    actualCostCents: v.optional(v.number()),
    creatorUserId: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    assigneeUserId: v.optional(v.string()),
    templateId: v.optional(v.id("workflowTemplates")),
    recurrenceRule: v.optional(v.string()),
    legacyBuildTaskId: v.optional(v.id("buildTasks")),
    dedupeKey: v.optional(v.string()),
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_parentId", ["parentId"])
    .index("by_parentId_sortOrder", ["parentId", "sortOrder"])
    .index("by_legacyBuildTaskId", ["legacyBuildTaskId"])
    .index("by_templateId", ["templateId"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  workflowAttachments: defineTable({
    userId: v.string(),
    workflowItemId: v.id("workflowItems"),
    entityType: v.string(),
    entityId: v.string(),
    entityKey: v.string(),
    role: v.string(),
    buildContextId: v.optional(v.id("builds")),
    progressWeight: v.optional(v.number()),
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_workflowItemId", ["workflowItemId"])
    .index("by_entityKey", ["entityKey"])
    .index("by_entityKey_buildContextId", ["entityKey", "buildContextId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  workflowDependencies: defineTable({
    userId: v.string(),
    predecessorWorkflowItemId: v.id("workflowItems"),
    successorWorkflowItemId: v.id("workflowItems"),
    relationKind: v.string(),
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_predecessorWorkflowItemId", ["predecessorWorkflowItemId"])
    .index("by_successorWorkflowItemId", ["successorWorkflowItemId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  workflowTemplates: defineTable({
    userId: v.optional(v.string()),
    slug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isBuiltIn: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_slug", ["slug"])
    .index("by_isBuiltIn", ["isBuiltIn"]),

  workflowTemplateItems: defineTable({
    templateId: v.id("workflowTemplates"),
    templateItemKey: v.string(),
    parentTemplateItemKey: v.optional(v.string()),
    sortOrder: v.number(),
    title: v.string(),
    notes: v.optional(v.string()),
    kind: v.string(),
    category: v.string(),
    status: v.string(),
    scopeKind: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    weight: v.optional(v.number()),
    attachmentRole: v.optional(v.string()),
  })
    .index("by_templateId", ["templateId"])
    .index("by_templateId_templateItemKey", ["templateId", "templateItemKey"]),

  conventions: defineTable({
    userId: v.string(),
    name: v.string(),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    startDate: v.string(),
    endDate: v.string(),
    archived: v.optional(v.boolean()),
    ...syncMetaFields,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  conventionDayPlans: defineTable({
    userId: v.string(),
    conventionId: v.id("conventions"),
    date: v.string(),
    buildId: v.optional(v.id("builds")),
    notes: v.optional(v.string()),
    ...syncMetaFields,
  })
    .index("by_conventionId", ["conventionId"])
    .index("by_userId", ["userId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  packingListItems: defineTable({
    userId: v.string(),
    conventionId: v.id("conventions"),
    date: v.optional(v.string()),
    buildId: v.optional(v.id("builds")),
    closetItemId: v.optional(v.id("closetItems")),
    cosplayNodeId: v.optional(v.id("cosplayNodes")),
    workflowItemId: v.optional(v.id("workflowItems")),
    entryKind: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    label: v.string(),
    notes: v.optional(v.string()),
    checked: v.boolean(),
    sortOrder: v.optional(v.number()),
    ...syncMetaFields,
  })
    .index("by_conventionId", ["conventionId"])
    .index("by_userId", ["userId"])
    .index("by_cosplayNodeId", ["cosplayNodeId"])
    .index("by_workflowItemId", ["workflowItemId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  buildReferenceImages: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    ...syncMetaFields,
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  buildProcessPictures: defineTable({
    userId: v.string(),
    buildId: v.id("builds"),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    ...syncMetaFields,
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  /**
   * Dated build progress-update timeline (DATA_AND_SYNC.md §3.3, REQ-049). `publishedToFeed` is the
   * paid-only flag that surfaces an update on the social feed; the gate is enforced at the mutation.
   */
  buildProgressUpdates: defineTable({
    buildId: v.id("builds"),
    userId: v.string(),
    createdAt: v.number(),
    note: v.optional(v.string()),
    imageRefs: v.array(imageRefValidator),
    progressPercent: v.optional(v.number()),
    publishedToFeed: v.boolean(),
    ...syncMetaFields,
  })
    .index("by_buildId", ["buildId"])
    .index("by_userId", ["userId"])
    .index("by_userId_clientId", ["userId", "clientId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

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

  /** Dedupe retries from offline/sync clients (Phase 2 / §3.13.5). Pruned by age via cron. */
  idempotencyLedger: defineTable({
    key: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    result: v.optional(v.any()),
  })
    .index("by_key", ["key"])
    .index("by_createdAt", ["createdAt"]),

  broadcasts: defineTable({
    title: v.string(),
    body: v.string(),
    deepLink: v.optional(v.string()),
    audience: v.union(
      v.literal("all"),
      v.literal("tier:pro"),
      v.literal("tier:supporter"),
      v.literal("userIds")
    ),
    audienceArgs: v.optional(v.any()),
    scheduledAt: v.number(),
    sentAt: v.optional(v.number()),
    deliveryStats: v.optional(
      v.object({
        queued: v.number(),
        delivered: v.number(),
        failed: v.number(),
      })
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    cancelledAt: v.optional(v.number()),
  }).index("by_scheduled", ["scheduledAt", "sentAt"]),

  userPushPreferences: defineTable({
    userId: v.id("users"),
    expoPushToken: v.optional(v.string()),
    marketingOptIn: v.boolean(),
    transactionalOptIn: v.boolean(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
