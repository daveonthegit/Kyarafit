import type { Id, TableNames } from "../_generated/dataModel";

type MutationCtx = {
  db: any;
  storage: {
    delete: (storageId: Id<"_storage">) => Promise<void>;
  };
};

async function deleteStorageObject(ctx: MutationCtx, storageId?: Id<"_storage">) {
  if (!storageId) return;
  await ctx.storage.delete(storageId);
}

async function deleteDocuments<T extends TableNames>(
  ctx: MutationCtx,
  docs: Array<{ _id: Id<T> }>
) {
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

async function patchBuildsForDeletedGroup(ctx: MutationCtx, groupId: Id<"groups">) {
  const builds = await ctx.db
    .query("builds")
    .withIndex("by_groupId", (q: any) => q.eq("groupId", groupId))
    .collect();
  for (const build of builds) {
    await ctx.db.patch(build._id, { groupId: undefined });
  }
}

export async function deleteUserOwnedData(ctx: MutationCtx, externalId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q: any) => q.eq("externalId", externalId))
    .unique();

  if (!user) return;

  const cosplayNodes = await ctx.db
    .query("cosplayNodes")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const builds = await ctx.db
    .query("builds")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const buildTasks = await ctx.db
    .query("buildTasks")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const workflowItems = await ctx.db
    .query("workflowItems")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const workflowAttachments = await ctx.db
    .query("workflowAttachments")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const workflowDependencies = await ctx.db
    .query("workflowDependencies")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const workflowTemplates = await ctx.db
    .query("workflowTemplates")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const conventions = await ctx.db
    .query("conventions")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const packingListItems = await ctx.db
    .query("packingListItems")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const referenceImages = await ctx.db
    .query("buildReferenceImages")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const processPictures = await ctx.db
    .query("buildProcessPictures")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_createdBy", (q: any) => q.eq("createdBy", externalId))
    .collect();
  const groupMembers = await ctx.db
    .query("groupMembers")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const followsByFollower = await ctx.db
    .query("follows")
    .withIndex("by_follower", (q: any) => q.eq("followerId", externalId))
    .collect();
  const followsByFollowing = await ctx.db
    .query("follows")
    .withIndex("by_following", (q: any) => q.eq("followingId", externalId))
    .collect();
  const buildLikes = await ctx.db
    .query("buildLikes")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const buildComments = await ctx.db
    .query("buildComments")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const buildCollaborators = await ctx.db
    .query("buildCollaborators")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();
  const activities = await ctx.db
    .query("activities")
    .withIndex("by_userId", (q: any) => q.eq("userId", externalId))
    .collect();

  for (const node of cosplayNodes) {
    await deleteStorageObject(ctx, node.imageStorageId);
  }
  for (const build of builds) {
    await deleteStorageObject(ctx, build.imageStorageId);
  }
  for (const convention of conventions) {
    await deleteStorageObject(ctx, convention.imageStorageId);
  }
  for (const image of referenceImages) {
    await deleteStorageObject(ctx, image.imageStorageId);
  }
  for (const image of processPictures) {
    await deleteStorageObject(ctx, image.imageStorageId);
  }
  for (const group of groups) {
    await deleteStorageObject(ctx, group.imageStorageId);
    await patchBuildsForDeletedGroup(ctx, group._id);
    const groupDays = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_groupId", (q: any) => q.eq("groupId", group._id))
      .collect();
    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q: any) => q.eq("groupId", group._id))
      .collect();
    await deleteDocuments(ctx, groupDays);
    await deleteDocuments(ctx, members);
  }

  for (const build of builds) {
    const references = await ctx.db
      .query("buildReferenceImages")
      .withIndex("by_buildId", (q: any) => q.eq("buildId", build._id))
      .collect();
    const pictures = await ctx.db
      .query("buildProcessPictures")
      .withIndex("by_buildId", (q: any) => q.eq("buildId", build._id))
      .collect();
    const likes = await ctx.db
      .query("buildLikes")
      .withIndex("by_buildId", (q: any) => q.eq("buildId", build._id))
      .collect();
    const comments = await ctx.db
      .query("buildComments")
      .withIndex("by_buildId", (q: any) => q.eq("buildId", build._id))
      .collect();
    const collaborators = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q: any) => q.eq("buildId", build._id))
      .collect();

    await deleteDocuments(ctx, references);
    await deleteDocuments(ctx, pictures);
    await deleteDocuments(ctx, likes);
    await deleteDocuments(ctx, comments);
    await deleteDocuments(ctx, collaborators);
  }

  for (const node of cosplayNodes) {
    const nodeTasks = await ctx.db
      .query("buildTasks")
      .withIndex("by_cosplayNodeId", (q: any) => q.eq("cosplayNodeId", node._id))
      .collect();
    const nodePackingItems = await ctx.db
      .query("packingListItems")
      .withIndex("by_cosplayNodeId", (q: any) => q.eq("cosplayNodeId", node._id))
      .collect();

    await deleteDocuments(ctx, nodeTasks);
    await deleteDocuments(ctx, nodePackingItems);
  }

  for (const convention of conventions) {
    const dayPlans = await ctx.db
      .query("conventionDayPlans")
      .withIndex("by_conventionId", (q: any) => q.eq("conventionId", convention._id))
      .collect();
    const items = await ctx.db
      .query("packingListItems")
      .withIndex("by_conventionId", (q: any) => q.eq("conventionId", convention._id))
      .collect();
    const groupDays = await ctx.db
      .query("groupConventionDays")
      .withIndex("by_conventionId", (q: any) => q.eq("conventionId", convention._id))
      .collect();

    await deleteDocuments(ctx, dayPlans);
    await deleteDocuments(ctx, items);
    await deleteDocuments(ctx, groupDays);
  }

  for (const item of workflowItems) {
    const attachments = await ctx.db
      .query("workflowAttachments")
      .withIndex("by_workflowItemId", (q: any) => q.eq("workflowItemId", item._id))
      .collect();
    const predecessors = await ctx.db
      .query("workflowDependencies")
      .withIndex("by_predecessorWorkflowItemId", (q: any) =>
        q.eq("predecessorWorkflowItemId", item._id)
      )
      .collect();
    const successors = await ctx.db
      .query("workflowDependencies")
      .withIndex("by_successorWorkflowItemId", (q: any) =>
        q.eq("successorWorkflowItemId", item._id)
      )
      .collect();
    const packingLinks = await ctx.db
      .query("packingListItems")
      .withIndex("by_workflowItemId", (q: any) => q.eq("workflowItemId", item._id))
      .collect();

    await deleteDocuments(ctx, attachments);
    await deleteDocuments(ctx, predecessors);
    await deleteDocuments(ctx, successors);
    await deleteDocuments(ctx, packingLinks);
  }

  for (const template of workflowTemplates) {
    const items = await ctx.db
      .query("workflowTemplateItems")
      .withIndex("by_templateId", (q: any) => q.eq("templateId", template._id))
      .collect();
    await deleteDocuments(ctx, items);
  }

  await deleteDocuments(ctx, workflowAttachments);
  await deleteDocuments(ctx, workflowDependencies);
  await deleteDocuments(ctx, workflowTemplates);
  await deleteDocuments(ctx, buildTasks);
  await deleteDocuments(ctx, packingListItems);
  await deleteDocuments(ctx, referenceImages);
  await deleteDocuments(ctx, processPictures);
  await deleteDocuments(ctx, buildLikes);
  await deleteDocuments(ctx, buildComments);
  await deleteDocuments(ctx, buildCollaborators);
  await deleteDocuments(ctx, activities);
  await deleteDocuments(ctx, groupMembers);
  await deleteDocuments(ctx, followsByFollower);
  await deleteDocuments(ctx, followsByFollowing);
  await deleteDocuments(ctx, groups);
  await deleteDocuments(ctx, conventions);
  await deleteDocuments(ctx, workflowItems);
  await deleteDocuments(ctx, cosplayNodes);
  await deleteDocuments(ctx, builds);

  await deleteStorageObject(ctx, user.imageStorageId);
  await ctx.db.delete(user._id);
}
