import {
  deriveWorkflowAggregateProgress,
  isDoneStatus,
  isTerminalStatus,
  type WorkflowItemKind,
  type WorkflowStatus,
} from "./workflowProgress";

/** Minimal workflow item shape for sorting and tree algorithms (Convex `Doc` satisfies this). */
export type WorkflowItemForTree = {
  _id: string;
  parentId?: string | null;
  ancestorIds: string[];
  sortOrder: number;
  title: string;
  kind: string;
  status: string;
  manualProgressPercent?: number | null;
  weight?: number | null;
};

export type WorkflowAttachmentForTree = {
  workflowItemId: string;
};

export type WorkflowDependencyForTree = {
  predecessorWorkflowItemId: string;
  successorWorkflowItemId: string;
};

export function entityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parentAncestorIds(
  parent: Pick<WorkflowItemForTree, "_id" | "ancestorIds"> | null
): string[] {
  if (!parent) return [];
  return [...parent.ancestorIds, parent._id];
}

export function sortWorkflowItems<Item extends WorkflowItemForTree>(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.parentId !== b.parentId) return (a.parentId ?? "").localeCompare(b.parentId ?? "");
    return a.title.localeCompare(b.title);
  });
}

export type WorkflowTreeNode<
  Item extends WorkflowItemForTree = WorkflowItemForTree,
  Attachment extends WorkflowAttachmentForTree = WorkflowAttachmentForTree,
  Dependency extends WorkflowDependencyForTree = WorkflowDependencyForTree,
> = Item & {
  attachments: Attachment[];
  dependencies: Dependency[];
  blockedByCount: number;
  isBlocked: boolean;
  progressPercent: number;
  childCount: number;
  children: WorkflowTreeNode<Item, Attachment, Dependency>[];
};

export function buildWorkflowTree<
  Item extends WorkflowItemForTree,
  Attachment extends WorkflowAttachmentForTree,
  Dependency extends WorkflowDependencyForTree,
>(input: {
  items: Item[];
  attachments: Attachment[];
  dependencies: Dependency[];
  externalProgress?: Map<
    string,
    Array<{ progressPercent?: number | null; weight?: number | null; excluded?: boolean }>
  >;
}): WorkflowTreeNode<Item, Attachment, Dependency>[] {
  const sortedItems = sortWorkflowItems(input.items);
  const attachmentsByItem = new Map<string, Attachment[]>();
  for (const attachment of input.attachments) {
    const list = attachmentsByItem.get(attachment.workflowItemId) ?? [];
    list.push(attachment);
    attachmentsByItem.set(attachment.workflowItemId, list);
  }

  const prereqsBySuccessor = new Map<string, Dependency[]>();
  for (const dependency of input.dependencies) {
    const list = prereqsBySuccessor.get(dependency.successorWorkflowItemId) ?? [];
    list.push(dependency);
    prereqsBySuccessor.set(dependency.successorWorkflowItemId, list);
  }

  const itemMap = new Map<string, Item>(sortedItems.map((item) => [item._id, item]));
  const childrenByParent = new Map<string, Item[]>();
  const rootItems: Item[] = [];
  for (const item of sortedItems) {
    if (item.parentId) {
      const list = childrenByParent.get(item.parentId) ?? [];
      list.push(item);
      childrenByParent.set(item.parentId, list);
    } else {
      rootItems.push(item);
    }
  }

  const memo = new Map<string, WorkflowTreeNode<Item, Attachment, Dependency>>();
  const visit = (item: Item): WorkflowTreeNode<Item, Attachment, Dependency> => {
    const existing = memo.get(item._id);
    if (existing) return existing;
    const childItems = (childrenByParent.get(item._id) ?? []).map(visit);
    const dependencies = prereqsBySuccessor.get(item._id) ?? [];
    const blockedByCount = dependencies.filter((dependency) => {
      const predecessor = itemMap.get(dependency.predecessorWorkflowItemId);
      return predecessor ? !isDoneStatus(predecessor.status as WorkflowStatus) : false;
    }).length;
    const progressPercent = deriveWorkflowAggregateProgress({
      kind: item.kind as WorkflowItemKind,
      status: item.status as WorkflowStatus,
      manualProgressPercent: item.manualProgressPercent,
      childProgress: childItems.map((child) => ({
        progressPercent: child.progressPercent,
        weight: child.weight,
        excluded: child.status === "cancelled",
      })),
      attachedProgress: input.externalProgress?.get(item._id) ?? [],
    });

    const node: WorkflowTreeNode<Item, Attachment, Dependency> = {
      ...item,
      attachments: attachmentsByItem.get(item._id) ?? [],
      dependencies,
      blockedByCount,
      isBlocked: blockedByCount > 0 && !isTerminalStatus(item.status as WorkflowStatus),
      progressPercent,
      childCount: childItems.length,
      children: childItems,
    };
    memo.set(item._id, node);
    return node;
  };

  return rootItems.map(visit);
}

export function flattenWorkflowTree<
  Item extends WorkflowItemForTree,
  Attachment extends WorkflowAttachmentForTree,
  Dependency extends WorkflowDependencyForTree,
>(
  nodes: WorkflowTreeNode<Item, Attachment, Dependency>[]
): WorkflowTreeNode<Item, Attachment, Dependency>[] {
  const flattened: WorkflowTreeNode<Item, Attachment, Dependency>[] = [];
  const visit = (node: WorkflowTreeNode<Item, Attachment, Dependency>) => {
    flattened.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return flattened;
}

export function deriveDoneCounts(items: Array<Pick<WorkflowItemForTree, "kind" | "status">>) {
  const actionable = items.filter((item) => item.kind === "task");
  return {
    total: actionable.length,
    done: actionable.filter((item) => item.status === "done").length,
  };
}
