import type { ExportableRow } from "@kyarafit/design-system/domain/importExport";
import type { PortableCollectionKey } from "../lib/dataPortability";

export const accountExportRecords = {
  builds: { name: "Aerith", notes: "Silk dress", status: "wip" },
  conventions: { name: "Anime Expo", startDate: "2026-11-01", endDate: "2026-11-02" },
  cosplayNodes: { name: "Cape", nodeType: "element", tags: ["sewing"], notes: "Red lining" },
  packingListItems: { conventionId: "conventions", label: "Wig", notes: "In box", checked: false },
  workflowItems: { title: "Book hotel", kind: "task", notes: "Near venue", reminders: [{ kind: "date", date: "2026-11-01" }], parentId: "task-group" },
  conventionDayPlans: { conventionId: "conventions", date: "2026-11-01", buildId: "builds", notes: "Meet friends" },
  buildTasks: { buildId: "builds", label: "Cut fabric", checked: true, sortOrder: 1 },
  workflowAttachments: { workflowItemId: "workflowItems", entityType: "convention", entityId: "conventions", entityKey: "convention:conventions", role: "primary", progressWeight: 2 },
  workflowDependencies: { predecessorWorkflowItemId: "task-group", successorWorkflowItemId: "workflowItems", relationKind: "finish_to_start" },
  workflowTemplates: { name: "Travel", slug: "travel", isBuiltIn: false },
  workflowTemplateItems: { templateId: "workflowTemplates", templateItemKey: "hotel", title: "Book hotel", notes: "Refundable", kind: "task" },
  buildReferenceImages: { buildId: "builds", imageUrl: "https://example.com/reference.jpg", sortOrder: 1 },
  buildProcessPictures: { buildId: "builds", imageStorageId: "storage-process", sortOrder: 2 },
  buildProgressUpdates: { buildId: "builds", createdAt: 1, note: "Finished seams", imageRefs: [{ kind: "url", url: "https://example.com/progress.jpg" }, { kind: "cloud", storageId: "storage-progress", imageKey: "seams" }], publishedToFeed: false, progressPercent: 40 },
  closetItems: { name: "Legacy wig", category: "wig", tags: [], notes: "Keep this" },
  cosplayNodeLinks: { parentNodeId: "parent", childNodeId: "cosplayNodes", sortOrder: 1, linkMode: "shared" },
  buildCosplayLinks: { buildId: "builds", cosplayNodeId: "cosplayNodes", sortOrder: 1 },
  buildNodeStates: { buildId: "builds", cosplayNodeId: "cosplayNodes", buildStatus: "done", directCostCents: 300 },
  buildItemLinks: { buildId: "builds", closetItemId: "closetItems" },
  users: { externalId: "u1", displayName: "Cosplayer", bio: "I sew" },
  groups: { createdBy: "u1", name: "Craft friends", description: "Weekend sewing" },
  groupMembers: { groupId: "groups", role: "admin" },
  groupConventionDays: { groupId: "groups", conventionId: "conventions", date: "2026-11-01" },
  follows: { followerId: "u1", followingId: "friend" },
  buildLikes: { buildId: "friend-build" },
  buildComments: { buildId: "friend-build", body: "Lovely seams!", createdAt: 1 },
  buildCollaborators: { buildId: "friend-build", role: "editor" },
  activities: { kind: "build_created", buildId: "builds", createdAt: 1 },
  userPushPreferences: { userId: "users", marketingOptIn: false, transactionalOptIn: true, updatedAt: 1 },
  broadcasts: { createdBy: "users", title: "News", body: "Meetup", audience: "all", scheduledAt: 1, createdAt: 1 },
  replicaRows: { table: "builds", rowId: "local-build", doc: { notes: "Offline edit" }, fieldRevs: { notes: 3 }, deleted: false, rev: 3 },
  replicaConflicts: { table: "builds", rowId: "local-build", kind: "update", lost: { notes: "Earlier edit" }, rev: 2, createdAt: 1, dismissed: false },
  replicaAssets: { imageKey: "seams", imageStorageId: "storage-progress", createdAt: 1 },
} satisfies Record<PortableCollectionKey, Record<string, unknown>>;

export function exportRecord(collection: PortableCollectionKey): ExportableRow {
  return { _id: collection, id: collection, userId: "u1", ...accountExportRecords[collection] };
}
