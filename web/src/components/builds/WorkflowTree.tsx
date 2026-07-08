"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  WORKFLOW_STATUS_OPTIONS,
  formatPlannerWorkflowDueDate,
  plannerWorkflowRowClassName,
  PlannerWorkflowCheckbox,
  PlannerWorkflowMetaLine,
  PlannerWorkflowMetaMuted,
  PlannerWorkflowTaskTitle,
} from "@/components/planner/PlannerWorkflowTaskUi";

const BUILD_GROUP_KEY = "__build__";

type WorkflowAttachment = {
  entityType: string;
  entityId: string;
  role?: string;
  buildContextId?: Id<"builds">;
};

export type WorkflowNode = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowNode[];
  attachments?: WorkflowAttachment[];
};

type WorkflowRow = WorkflowNode & { depth: number; elementGroupKey: string };

function cosplayNodeIdFromRootAttachments(
  attachments: WorkflowAttachment[] | undefined
): Id<"cosplayNodes"> | null {
  if (!attachments?.length) return null;
  const cosplay = attachments.find((a) => a.entityType === "cosplayNode");
  return cosplay ? (cosplay.entityId as Id<"cosplayNodes">) : null;
}

function flattenWithElementGroup(roots: WorkflowNode[]): WorkflowRow[] {
  const acc: WorkflowRow[] = [];
  for (const root of roots) {
    const cosplayId = cosplayNodeIdFromRootAttachments(root.attachments);
    const elementGroupKey = cosplayId ?? BUILD_GROUP_KEY;
    const walk = (n: WorkflowNode, d: number) => {
      acc.push({ ...n, depth: d, elementGroupKey });
      for (const ch of n.children ?? []) walk(ch, d + 1);
    };
    walk(root, 0);
  }
  return acc;
}

function sortGroupKeys(
  keys: string[],
  visualById: Map<string, { sortOrder: number; depth: number; name: string; nodeType: string }>
): string[] {
  return [...keys].sort((a, b) => {
    if (a === BUILD_GROUP_KEY && b !== BUILD_GROUP_KEY) return 1;
    if (b === BUILD_GROUP_KEY && a !== BUILD_GROUP_KEY) return -1;
    if (a === b) return 0;
    const ma = a === BUILD_GROUP_KEY ? null : visualById.get(a);
    const mb = b === BUILD_GROUP_KEY ? null : visualById.get(b);
    const sa = ma?.sortOrder ?? 1_000_000;
    const sb = mb?.sortOrder ?? 1_000_000;
    if (sa !== sb) return sa - sb;
    const da = ma?.depth ?? 0;
    const db = mb?.depth ?? 0;
    if (da !== db) return da - db;
    return (ma?.name ?? a).localeCompare(mb?.name ?? b);
  });
}

function WorkflowTaskGroup({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <details
      className="group rounded-[10px] overflow-hidden border border-glass-divider"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      {summary}
      {children}
    </details>
  );
}

function WorkflowItemRow({
  node,
  userId,
  onAddSubtask,
  updateWorkflow,
  removeWorkflow,
}: {
  node: WorkflowRow;
  userId: string | null;
  onAddSubtask: (id: Id<"workflowItems">) => void;
  updateWorkflow: (args: {
    id: Id<"workflowItems">;
    userId: string;
    status: string;
  }) => Promise<unknown>;
  removeWorkflow: (args: { id: Id<"workflowItems">; userId: string }) => Promise<unknown>;
}) {
  return (
    <div
      className={`${plannerWorkflowRowClassName} w-full max-w-full`}
      style={{ marginLeft: `${node.depth * 20}px` }}
    >
      <PlannerWorkflowCheckbox
        checked={node.status === "done"}
        disabled={!userId}
        onCheckedChange={(next) =>
          void updateWorkflow({
            id: node._id,
            userId: userId ?? "",
            status: next ? "done" : "not_started",
          })
        }
        ariaLabel={
          node.status === "done"
            ? `Mark "${node.title}" as not done`
            : `Mark "${node.title}" as done`
        }
      />
      <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
        <PlannerWorkflowTaskTitle done={node.status === "done"}>
          {node.title}
        </PlannerWorkflowTaskTitle>
        <PlannerWorkflowMetaLine>
          <PlannerWorkflowMetaMuted>
            {node.kind === "group" ? "Group" : "Task"} · {node.progressPercent}% progress
            {node.dueDate ? ` · Due ${formatPlannerWorkflowDueDate(node.dueDate)}` : ""}
          </PlannerWorkflowMetaMuted>
        </PlannerWorkflowMetaLine>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
        <select
          value={node.status}
          onChange={(event) =>
            void updateWorkflow({
              id: node._id,
              userId: userId ?? "",
              status: event.target.value,
            })
          }
          disabled={!userId}
          className="glass-field min-h-[40px] flex-1 px-3 py-2 text-xs sm:min-h-0 sm:flex-none"
        >
          {WORKFLOW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onAddSubtask(node._id)}
          disabled={!userId}
          className="min-h-[40px] rounded-full border border-glass-border px-3 py-2 text-[11px] font-medium text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors disabled:opacity-50"
        >
          Add subtask
        </button>
        <button
          type="button"
          onClick={() => void removeWorkflow({ id: node._id, userId: userId ?? "" })}
          disabled={!userId}
          className="min-h-[40px] rounded-full border border-glass-border px-3 py-2 text-[11px] text-media-fg-55 hover:text-on-glass-danger hover:border-on-glass-danger transition-colors disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export function WorkflowTree({
  buildId,
  userId,
  shareToken,
  hideComposer = false,
}: {
  buildId: Id<"builds">;
  userId: string | null;
  /** Unlisted share links: pass token so the workflow tree loads for anonymous viewers. */
  shareToken?: string;
  /** Hide “add step” / subtask composers (public viewer). */
  hideComposer?: boolean;
}) {
  const listTreeArgs = shareToken !== undefined ? { buildId, shareToken } : { buildId };
  const tree = useOfflineQuery(api.workflow.listBuildTree, listTreeArgs);
  const listVisualArgs = shareToken !== undefined ? { buildId, shareToken } : { buildId };
  const visualNodes = useOfflineQuery(api.cosplayNodes.listBuildVisualNodes, listVisualArgs) ?? [];
  const createWorkflow = useOfflineMutation(api.workflow.create);
  const updateWorkflow = useOfflineMutation(api.workflow.update);
  const removeWorkflow = useOfflineMutation(api.workflow.remove);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<Id<"workflowItems"> | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");

  const roots = (tree?.items ?? []) as WorkflowNode[];
  const rows = useMemo(() => flattenWithElementGroup(roots), [roots]);

  const visualById = useMemo(() => {
    const m = new Map<
      string,
      { sortOrder: number; depth: number; name: string; nodeType: string }
    >();
    for (const n of visualNodes) {
      m.set(n._id, {
        sortOrder: n.sortOrder,
        depth: n.depth,
        name: n.name,
        nodeType: n.nodeType,
      });
    }
    return m;
  }, [visualNodes]);

  const { grouped, sortedGroupKeys } = useMemo(() => {
    const g = new Map<string, WorkflowRow[]>();
    for (const row of rows) {
      const list = g.get(row.elementGroupKey) ?? [];
      list.push(row);
      g.set(row.elementGroupKey, list);
    }
    const keys = sortGroupKeys(Array.from(g.keys()), visualById);
    return { grouped: g, sortedGroupKeys: keys };
  }, [rows, visualById]);

  const handleCreateRoot = async () => {
    if (!userId || !newRootTitle.trim()) return;
    await createWorkflow({
      userId,
      title: newRootTitle.trim(),
      kind: "task",
      category: "craft",
      scopeKind: "build_specific",
      attachments: [{ entityType: "build", entityId: buildId, role: "primary" }],
    });
    setNewRootTitle("");
  };

  const handleCreateChild = async () => {
    if (!userId || !newChildParentId || !newChildTitle.trim()) return;
    await createWorkflow({
      userId,
      title: newChildTitle.trim(),
      kind: "task",
      category: "craft",
      scopeKind: "build_specific",
      parentId: newChildParentId,
    });
    setNewChildTitle("");
    setNewChildParentId(null);
  };

  const stats = tree?.stats;
  const progressPercent = stats?.workflowProgressPercent ?? 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-end justify-between text-sm">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            Task progress
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums text-media-fg-70">
            {progressPercent}%
          </span>
        </div>
        <div className="h-[2px] w-full rounded-full bg-glass-border overflow-hidden">
          <div
            className="h-full bg-kyar-media-fg rounded-full transition-[width] duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-media-fg-55">
          {stats?.tasksDone ?? 0} of {stats?.tasksTotal ?? 0} tasks done
        </p>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-[10px] border border-glass-border px-4 py-6 text-sm text-media-fg-55">
            {hideComposer ? "No tasks yet." : "No tasks yet. Add the first task below."}
          </div>
        ) : (
          sortedGroupKeys.map((groupKey) => {
            const groupRows = grouped.get(groupKey);
            if (!groupRows?.length) return null;

            const isBuild = groupKey === BUILD_GROUP_KEY;
            const meta = !isBuild ? visualById.get(groupKey) : null;
            const title = isBuild ? "Build" : (meta?.name ?? "Element");
            const headerDepth = isBuild ? 0 : (meta?.depth ?? 0);
            const typeLabel = meta?.nodeType === "material" ? "Material" : "Element";

            return (
              <WorkflowTaskGroup
                key={groupKey}
                summary={
                  <summary className="flex list-none cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset min-h-[44px] [&::-webkit-details-marker]:hidden">
                    <span
                      className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 transition-transform group-open:rotate-90"
                      aria-hidden
                    >
                      ▶
                    </span>
                    <span
                      className="min-w-0 flex-1"
                      style={{ paddingLeft: `${headerDepth * 12}px` }}
                    >
                      <span className="block truncate">{title}</span>
                      {!isBuild ? (
                        <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-[0.16em] text-media-fg-55">
                          {typeLabel}
                        </span>
                      ) : null}
                    </span>
                    {isBuild ? (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                        Build-wide steps
                      </span>
                    ) : (
                      <Link
                        href={`/elements/${groupKey as Id<"cosplayNodes">}`}
                        className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </Link>
                    )}
                  </summary>
                }
              >
                <div className="space-y-1 border-t border-glass-divider px-2 py-3 sm:px-3">
                  {groupRows.map((node) => (
                    <WorkflowItemRow
                      key={node._id}
                      node={node}
                      userId={userId}
                      onAddSubtask={setNewChildParentId}
                      updateWorkflow={updateWorkflow}
                      removeWorkflow={removeWorkflow}
                    />
                  ))}
                </div>
              </WorkflowTaskGroup>
            );
          })
        )}
      </div>

      {newChildParentId && !hideComposer && (
        <div className="flex flex-wrap gap-2 rounded-[10px] border border-glass-border p-3">
          <input
            type="text"
            value={newChildTitle}
            onChange={(event) => setNewChildTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreateChild();
            }}
            placeholder="Add a subtask"
            className="glass-field flex-1 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreateChild()}
            className="rounded-full bg-glass-solid px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setNewChildParentId(null);
              setNewChildTitle("");
            }}
            className="rounded-full border border-glass-border-strong bg-glass-bar px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active"
          >
            Cancel
          </button>
        </div>
      )}

      {!hideComposer && (
        <div className="flex gap-2 border-t border-glass-divider pt-4">
          <input
            type="text"
            value={newRootTitle}
            onChange={(event) => setNewRootTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreateRoot();
            }}
            placeholder="Add a task… press ⏎ to save"
            className="glass-field flex-1 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreateRoot()}
            disabled={!userId || !newRootTitle.trim()}
            className="rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors disabled:opacity-50"
          >
            Add task
          </button>
        </div>
      )}
    </div>
  );
}
