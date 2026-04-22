import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  buildWorkflowTree,
  deriveDoneCounts,
  entityKey,
  flattenWorkflowTree,
  parentAncestorIds as parentAncestorIdsCore,
  sortWorkflowItems,
  uniqueStrings,
  type WorkflowAttachmentForTree,
  type WorkflowDependencyForTree,
  type WorkflowItemForTree,
  type WorkflowTreeNode,
} from "@kyarafit/design-system/domain/workflowDomain";
import type {
  WorkflowAttachmentRole,
  WorkflowCategory,
  WorkflowEntityType,
  WorkflowItemKind,
  WorkflowScopeKind,
  WorkflowSourceKind,
  WorkflowStatus,
} from "@kyarafit/design-system/domain/workflowProgress";

export type WorkflowItemDoc = Doc<"workflowItems">;

export {
  buildWorkflowTree,
  deriveDoneCounts,
  entityKey,
  flattenWorkflowTree,
  sortWorkflowItems,
  uniqueStrings,
  type WorkflowAttachmentForTree,
  type WorkflowDependencyForTree,
  type WorkflowItemForTree,
  type WorkflowTreeNode,
};

/** Convex `Id<"workflowItems">` branding for persisted ancestor chains. */
export function parentAncestorIds(
  parent: Pick<WorkflowItemDoc, "_id" | "ancestorIds"> | null
): Id<"workflowItems">[] {
  return parentAncestorIdsCore(parent) as Id<"workflowItems">[];
}

type Ctx = QueryCtx | MutationCtx;
export type WorkflowAttachmentDoc = Doc<"workflowAttachments">;
export type WorkflowDependencyDoc = Doc<"workflowDependencies">;

export async function getWorkflowItemById(
  ctx: Ctx,
  id: Id<"workflowItems">
): Promise<WorkflowItemDoc | null> {
  return await ctx.db.get(id);
}

export async function getWorkflowItemsForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowItems")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowAttachmentsForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowAttachments")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowDependenciesForUser(ctx: Ctx, userId: string) {
  return await ctx.db
    .query("workflowDependencies")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function getWorkflowItemsByAttachmentKey(
  ctx: Ctx,
  userId: string,
  keys: string[],
  buildContextId?: Id<"builds">
) {
  const attachments = await getWorkflowAttachmentsForUser(ctx, userId);
  const keySet = new Set(keys);
  const seedIds = new Set<string>();

  for (const attachment of attachments) {
    if (!keySet.has(attachment.entityKey)) continue;
    if (
      buildContextId &&
      attachment.buildContextId &&
      attachment.buildContextId !== buildContextId
    ) {
      continue;
    }
    if (!buildContextId && attachment.buildContextId) {
      continue;
    }
    seedIds.add(attachment.workflowItemId);
  }

  if (seedIds.size === 0) {
    return {
      items: [] as WorkflowItemDoc[],
      attachments: [] as WorkflowAttachmentDoc[],
    };
  }

  const items = await getWorkflowItemsForUser(ctx, userId);
  const seedItemMap = new Map(
    items.filter((item) => seedIds.has(item._id)).map((item) => [item._id, item])
  );
  const includedIds = new Set<string>();
  for (const item of Array.from(seedItemMap.values())) {
    includedIds.add(item._id);
    for (const ancestorId of item.ancestorIds) includedIds.add(ancestorId);
  }

  const scopedItems = items.filter(
    (item) =>
      includedIds.has(item._id) ||
      item.ancestorIds.some((ancestorId) => includedIds.has(ancestorId))
  );
  const itemIds = new Set(scopedItems.map((item) => item._id));
  const scopedAttachments = attachments.filter((attachment) =>
    itemIds.has(attachment.workflowItemId)
  );

  return { items: scopedItems, attachments: scopedAttachments };
}

export type WorkflowCreateInput = {
  title: string;
  notes?: string;
  kind?: WorkflowItemKind;
  category?: WorkflowCategory;
  status?: WorkflowStatus;
  parentId?: Id<"workflowItems">;
  scopeKind?: WorkflowScopeKind;
  sourceKind?: WorkflowSourceKind;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  reminders?: Array<{ kind: string; date: string }>;
  weight?: number;
  manualProgressPercent?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  estimatedCostCents?: number;
  actualCostCents?: number;
  creatorUserId?: string;
  ownerUserId?: string;
  assigneeUserId?: string;
  templateId?: Id<"workflowTemplates">;
  recurrenceRule?: string;
  legacyBuildTaskId?: Id<"buildTasks">;
  dedupeKey?: string;
};

export type WorkflowAttachmentInput = {
  entityType: WorkflowEntityType;
  entityId: string;
  role?: WorkflowAttachmentRole;
  buildContextId?: Id<"builds">;
  progressWeight?: number;
};
