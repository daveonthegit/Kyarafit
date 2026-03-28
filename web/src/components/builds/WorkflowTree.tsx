"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type WorkflowNode = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowNode[];
};

const statusOptions = [
  { value: "not_started", label: "Not started" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function flatten(nodes: WorkflowNode[], depth = 0): Array<WorkflowNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flatten(node.children, depth + 1),
  ]);
}

export function WorkflowTree({ buildId, userId }: { buildId: Id<"builds">; userId: string | null }) {
  const tree = useQuery(api.workflow.listBuildTree, { buildId });
  const createWorkflow = useMutation(api.workflow.create);
  const updateWorkflow = useMutation(api.workflow.update);
  const removeWorkflow = useMutation(api.workflow.remove);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<Id<"workflowItems"> | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");

  const rows = useMemo(() => flatten(tree?.items ?? []), [tree?.items]);

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
          <span className="font-medium text-kyar-text">Workflow progress</span>
          <span className="text-kyar-textTertiary">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full border border-kyar-borderSubtle bg-white">
          <div className="h-full bg-black transition-[width] duration-200" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="text-xs text-kyar-textTertiary">
          {stats?.tasksDone ?? 0} of {stats?.tasksTotal ?? 0} task items done
        </p>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="border border-kyar-borderSubtle px-4 py-6 text-sm text-kyar-textTertiary">
            No workflow items yet. Add the first step below.
          </div>
        ) : (
          rows.map((node) => (
            <div
              key={node._id}
              className="border border-kyar-borderSubtle bg-white px-3 py-3"
              style={{ marginLeft: `${node.depth * 20}px` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateWorkflow({
                      id: node._id,
                      userId: userId ?? "",
                      status: node.status === "done" ? "not_started" : "done",
                    })
                  }
                  disabled={!userId}
                  className={`h-5 w-5 border ${
                    node.status === "done" ? "bg-black border-black" : "border-kyar-border"
                  } disabled:opacity-50`}
                  aria-label={node.status === "done" ? "Mark not started" : "Mark done"}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${node.status === "done" ? "line-through text-kyar-textTertiary" : "text-kyar-text"}`}>
                    {node.title}
                  </p>
                  <p className="text-[11px] text-kyar-textTertiary">
                    {node.kind === "group" ? "Group" : "Task"} · {node.progressPercent}% progress
                    {node.dueDate ? ` · Due ${node.dueDate}` : ""}
                  </p>
                </div>
                <select
                  value={node.status}
                  onChange={(event) =>
                    updateWorkflow({
                      id: node._id,
                      userId: userId ?? "",
                      status: event.target.value,
                    })
                  }
                  disabled={!userId}
                  className="border border-kyar-borderSubtle bg-white px-2 py-1 text-xs"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewChildParentId(node._id)}
                  disabled={!userId}
                  className="border border-kyar-borderSubtle px-2 py-1 text-[11px] font-medium text-kyar-text disabled:opacity-50"
                >
                  Add subtask
                </button>
                <button
                  type="button"
                  onClick={() => removeWorkflow({ id: node._id, userId: userId ?? "" })}
                  disabled={!userId}
                  className="border border-kyar-borderSubtle px-2 py-1 text-[11px] text-kyar-textTertiary disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {newChildParentId && (
        <div className="flex gap-2 border border-kyar-borderSubtle px-3 py-3">
          <input
            type="text"
            value={newChildTitle}
            onChange={(event) => setNewChildTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreateChild();
            }}
            placeholder="Add a subtask"
            className="flex-1 border border-kyar-borderSubtle px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreateChild()}
            className="bg-black px-3 py-2 text-[11px] font-semibold text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setNewChildParentId(null);
              setNewChildTitle("");
            }}
            className="border border-kyar-borderSubtle px-3 py-2 text-[11px]"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex gap-2 border-t border-kyar-borderSubtle pt-4">
        <input
          type="text"
          value={newRootTitle}
          onChange={(event) => setNewRootTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleCreateRoot();
          }}
          placeholder="Add a workflow step"
          className="flex-1 border border-kyar-borderSubtle px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleCreateRoot()}
          disabled={!userId || !newRootTitle.trim()}
          className="bg-black px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          Add step
        </button>
      </div>
    </div>
  );
}
