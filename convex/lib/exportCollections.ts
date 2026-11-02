export const EXPORT_COLLECTIONS = [
  "builds",
  "conventions",
  "cosplayNodes",
  "packingListItems",
  "workflowItems",
  "conventionDayPlans",
  "buildTasks",
  "workflowAttachments",
  "workflowDependencies",
  "workflowTemplates",
  "workflowTemplateItems",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
  "closetItems",
  "cosplayNodeLinks",
  "buildCosplayLinks",
  "buildNodeStates",
  "buildItemLinks",
  "users",
  "groups",
  "groupMembers",
  "groupConventionDays",
  "follows",
  "buildLikes",
  "buildComments",
  "buildCollaborators",
  "activities",
  "userPushPreferences",
  "broadcasts",
  "replicaRows",
  "replicaConflicts",
  "replicaAssets",
] as const;

export type ExportCollection = (typeof EXPORT_COLLECTIONS)[number];

export function portableRecord(collection: ExportCollection, row: Record<string, unknown>) {
  const copy = { ...row };
  if (collection === "builds") delete copy.shareToken;
  if (collection === "users") {
    delete copy.stripeCustomerId;
    delete copy.stripeSubscriptionId;
  }
  if (collection === "userPushPreferences") delete copy.expoPushToken;
  return copy;
}
