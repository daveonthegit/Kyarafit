import type { Id } from "convex/_generated/dataModel";

export const BUILD_WORKFLOW_GROUP_KEY = "__build__";

export type WorkflowAttachment = {
  entityType: string;
  entityId: string;
  role?: string;
  buildContextId?: Id<"builds">;
};

export type WorkflowTreeNodeShape = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowTreeNodeShape[];
  attachments?: WorkflowAttachment[];
};

export type WorkflowRowFlat = WorkflowTreeNodeShape & {
  depth: number;
  elementGroupKey: string;
};

function cosplayNodeIdFromRootAttachments(
  attachments: WorkflowAttachment[] | undefined
): Id<"cosplayNodes"> | null {
  if (!attachments?.length) return null;
  const cosplay = attachments.find((a) => a.entityType === "cosplayNode");
  return cosplay ? (cosplay.entityId as Id<"cosplayNodes">) : null;
}

export function flattenWorkflowWithElementGroup(roots: WorkflowTreeNodeShape[]): WorkflowRowFlat[] {
  const acc: WorkflowRowFlat[] = [];
  for (const root of roots) {
    const cosplayId = cosplayNodeIdFromRootAttachments(root.attachments);
    const elementGroupKey = cosplayId ?? BUILD_WORKFLOW_GROUP_KEY;
    const walk = (n: WorkflowTreeNodeShape, d: number) => {
      acc.push({ ...n, depth: d, elementGroupKey });
      for (const ch of n.children ?? []) walk(ch, d + 1);
    };
    walk(root, 0);
  }
  return acc;
}

export function sortWorkflowGroupKeys(
  keys: string[],
  visualById: Map<string, { sortOrder: number; depth: number; name: string; nodeType: string }>
): string[] {
  return [...keys].sort((a, b) => {
    if (a === BUILD_WORKFLOW_GROUP_KEY && b !== BUILD_WORKFLOW_GROUP_KEY) return 1;
    if (b === BUILD_WORKFLOW_GROUP_KEY && a !== BUILD_WORKFLOW_GROUP_KEY) return -1;
    if (a === b) return 0;
    const ma = a === BUILD_WORKFLOW_GROUP_KEY ? null : visualById.get(a);
    const mb = b === BUILD_WORKFLOW_GROUP_KEY ? null : visualById.get(b);
    const sa = ma?.sortOrder ?? 1_000_000;
    const sb = mb?.sortOrder ?? 1_000_000;
    if (sa !== sb) return sa - sb;
    const da = ma?.depth ?? 0;
    const db = mb?.depth ?? 0;
    if (da !== db) return da - db;
    return (ma?.name ?? a).localeCompare(mb?.name ?? b);
  });
}
