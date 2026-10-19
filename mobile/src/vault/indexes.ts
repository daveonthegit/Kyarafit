/**
 * Index field lists for the personal-data tables, mirroring `convex/schema.ts`. The local query
 * engine only needs them for ORDER: Convex returns `withIndex` results sorted by the index fields
 * (then `_creationTime`), and ported handlers rely on that (e.g. `by_parentId_sortOrder`). Filtering
 * itself is driven by the field names in the range expression, so an index missing here still
 * filters correctly and just falls back to `_creationTime` order.
 */
export const VAULT_INDEX_FIELDS: Record<string, Record<string, readonly string[]>> = {
  builds: {
    by_userId: ["userId"],
    by_userId_status: ["userId", "status"],
    by_shareToken: ["shareToken"],
    by_groupId: ["groupId"],
    by_visibility: ["visibility"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
    by_imageStorageId: ["imageStorageId"],
  },
  cosplayNodes: {
    by_userId: ["userId"],
    by_userId_nodeType: ["userId", "nodeType"],
    by_userId_category: ["userId", "category"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
    by_buildId: ["buildId"],
    by_parentNodeId: ["parentNodeId"],
    by_imageStorageId: ["imageStorageId"],
  },
  buildTasks: {
    by_buildId: ["buildId"],
    by_userId: ["userId"],
    by_closetItemId: ["closetItemId"],
    by_cosplayNodeId: ["cosplayNodeId"],
    by_packingListItemId: ["packingListItemId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  workflowItems: {
    by_userId: ["userId"],
    by_parentId: ["parentId"],
    by_parentId_sortOrder: ["parentId", "sortOrder"],
    by_legacyBuildTaskId: ["legacyBuildTaskId"],
    by_templateId: ["templateId"],
    by_dedupeKey: ["dedupeKey"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  workflowAttachments: {
    by_userId: ["userId"],
    by_workflowItemId: ["workflowItemId"],
    by_entityKey: ["entityKey"],
    by_entityKey_buildContextId: ["entityKey", "buildContextId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  workflowDependencies: {
    by_userId: ["userId"],
    by_predecessorWorkflowItemId: ["predecessorWorkflowItemId"],
    by_successorWorkflowItemId: ["successorWorkflowItemId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  conventions: {
    by_userId: ["userId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
    by_imageStorageId: ["imageStorageId"],
  },
  conventionDayPlans: {
    by_conventionId: ["conventionId"],
    by_userId: ["userId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  packingListItems: {
    by_conventionId: ["conventionId"],
    by_userId: ["userId"],
    by_cosplayNodeId: ["cosplayNodeId"],
    by_workflowItemId: ["workflowItemId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  buildReferenceImages: {
    by_buildId: ["buildId"],
    by_userId: ["userId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  buildProcessPictures: {
    by_buildId: ["buildId"],
    by_userId: ["userId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
  buildProgressUpdates: {
    by_buildId: ["buildId"],
    by_userId: ["userId"],
    by_userId_clientId: ["userId", "clientId"],
    by_userId_updatedAt: ["userId", "updatedAt"],
  },
};

/**
 * Every table the vault owns. These are the personal-data tables (the same set the sync warm-up
 * pulls and the upgrade backfill pushes) plus `vaultSettings`, a device-local key/value table for
 * per-account preferences such as the focused build.
 */
export const VAULT_TABLES = [
  "builds",
  "cosplayNodes",
  "buildTasks",
  "workflowItems",
  "workflowAttachments",
  "workflowDependencies",
  "conventions",
  "conventionDayPlans",
  "packingListItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
  "vaultSettings",
] as const;
export type VaultTable = (typeof VAULT_TABLES)[number];

/** Tables that replicate to Kyarafit Cloud for paid sync (everything except device-local settings). */
export const REPLICATED_VAULT_TABLES: readonly VaultTable[] = VAULT_TABLES.filter(
  (table) => table !== "vaultSettings"
);
