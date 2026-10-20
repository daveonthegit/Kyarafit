/**
 * Local port of `convex/lib/workflowDomain.ts`: workflow lookups over the vault. Same names and
 * parameter order as the server (ctx first); synchronous because the vault is in-process.
 */
import {
  buildWorkflowTree,
  deriveDoneCounts,
  entityKey,
  flattenWorkflowTree,
  parentAncestorIds,
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
import type { VaultDoc, VaultReader } from "../../store";
import { replicaGeneratedWorkflowKey } from "@kyarafit/design-system/domain/replicaProtocol";

export {
  buildWorkflowTree,
  deriveDoneCounts,
  entityKey,
  flattenWorkflowTree,
  parentAncestorIds,
  sortWorkflowItems,
  uniqueStrings,
  type WorkflowAttachmentForTree,
  type WorkflowDependencyForTree,
  type WorkflowItemForTree,
  type WorkflowTreeNode,
};

/** Any context with a vault read view (query and mutation contexts both qualify). */
export type ReadCtx = { db: VaultReader };

type SyncMetaFields = {
  clientId?: string;
  version?: number;
  updatedAt?: number;
  fieldUpdatedAt?: Record<string, number>;
  deletedAt?: number;
};

export type WorkflowItemDoc = VaultDoc &
  SyncMetaFields & {
    userId: string;
    title: string;
    notes?: string;
    kind: string;
    category: string;
    status: string;
    parentId?: string;
    ancestorIds: string[];
    sortOrder: number;
    scopeKind: string;
    sourceKind: string;
    priority?: number;
    startDate?: string;
    targetDate?: string;
    dueDate?: string;
    reminders?: { kind: string; date: string }[];
    weight?: number;
    manualProgressPercent?: number;
    estimatedMinutes?: number;
    actualMinutes?: number;
    estimatedCostCents?: number;
    actualCostCents?: number;
    creatorUserId?: string;
    ownerUserId?: string;
    assigneeUserId?: string;
    templateId?: string;
    recurrenceRule?: string;
    legacyBuildTaskId?: string;
    dedupeKey?: string;
  };

export type WorkflowAttachmentDoc = VaultDoc &
  SyncMetaFields & {
    userId: string;
    workflowItemId: string;
    entityType: string;
    entityId: string;
    entityKey: string;
    role: string;
    buildContextId?: string;
    progressWeight?: number;
  };

export type WorkflowDependencyDoc = VaultDoc &
  SyncMetaFields & {
    userId: string;
    predecessorWorkflowItemId: string;
    successorWorkflowItemId: string;
    relationKind: string;
  };

export function getWorkflowItemById(ctx: ReadCtx, id: string): WorkflowItemDoc | null {
  return ctx.db.get(id) as WorkflowItemDoc | null;
}

export function getWorkflowItemsForUser(ctx: ReadCtx, userId: string): WorkflowItemDoc[] {
  const seen = new Set<string>();
  return (ctx.db
    .query("workflowItems")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect() as WorkflowItemDoc[]).filter(item => {
      const key = replicaGeneratedWorkflowKey(item);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getWorkflowAttachmentsForUser(
  ctx: ReadCtx,
  userId: string
): WorkflowAttachmentDoc[] {
  return ctx.db
    .query("workflowAttachments")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect() as WorkflowAttachmentDoc[];
}

export function getWorkflowDependenciesForUser(
  ctx: ReadCtx,
  userId: string
): WorkflowDependencyDoc[] {
  return ctx.db
    .query("workflowDependencies")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect() as WorkflowDependencyDoc[];
}

export function getWorkflowItemsByAttachmentKey(
  ctx: ReadCtx,
  userId: string,
  keys: string[],
  buildContextId?: string
): { items: WorkflowItemDoc[]; attachments: WorkflowAttachmentDoc[] } {
  const attachments = getWorkflowAttachmentsForUser(ctx, userId);
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
    return { items: [], attachments: [] };
  }

  const items = getWorkflowItemsForUser(ctx, userId);
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
  parentId?: string;
  scopeKind?: WorkflowScopeKind;
  sourceKind?: WorkflowSourceKind;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  reminders?: { kind: string; date: string }[];
  weight?: number;
  manualProgressPercent?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  estimatedCostCents?: number;
  actualCostCents?: number;
  creatorUserId?: string;
  ownerUserId?: string;
  assigneeUserId?: string;
  templateId?: string;
  recurrenceRule?: string;
  legacyBuildTaskId?: string;
  dedupeKey?: string;
};

export type WorkflowAttachmentInput = {
  entityType: WorkflowEntityType;
  entityId: string;
  role?: WorkflowAttachmentRole;
  buildContextId?: string;
  progressWeight?: number;
};
