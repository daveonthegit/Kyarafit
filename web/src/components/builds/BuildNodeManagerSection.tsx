"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildTask } from "@/components/builds/TaskChecklist";
import { formatNodeStatus, formatNodeTypeLabel } from "@/lib/cosplayUi";

type CosplayNodeId = Id<"cosplayNodes">;

export type BuildNodeManagerLinkedNode = {
  _id: CosplayNodeId;
  name: string;
  nodeType: "element" | "material";
  category?: string;
  tags?: string[];
  totalCostCents?: number | null;
  directCostCents?: number | null;
  overallBucket?: "incomplete" | "in_progress" | "complete";
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  progressPercent?: number | null;
  childCount?: number | null;
};

type DetailedLinkedNode = BuildNodeManagerLinkedNode & {
  notes?: string | null;
  children: Array<
    BuildNodeManagerLinkedNode & {
      _id: CosplayNodeId;
      linkId: Id<"cosplayNodeLinks">;
      linkMode: "owned" | "reference";
      sortOrder: number;
    }
  >;
};

type NodeSelectionMeta = {
  nodeId: CosplayNodeId;
  isRoot: boolean;
  rootIndex?: number;
  parentNodeId?: CosplayNodeId;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
};

type DragState = {
  draggingNodeId: CosplayNodeId | null;
  dragOverNodeId: CosplayNodeId | "__root__" | null;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

function isAllowedChildLink(
  parentType: BuildNodeManagerLinkedNode["nodeType"],
  childType: BuildNodeManagerLinkedNode["nodeType"]
) {
  if (parentType === "element") return true;
  return childType === "material";
}

function visibleBucket(bucket?: BuildNodeManagerLinkedNode["overallBucket"]) {
  return bucket === "complete" ? "complete" : "in_progress";
}

function nodeIcon(nodeType?: BuildNodeManagerLinkedNode["nodeType"]) {
  return (
    <span className="material-symbols-outlined text-lg">
      {nodeType === "material" ? "inventory_2" : "checkroom"}
    </span>
  );
}

type BuildNodeManagerSectionProps = {
  buildId: Id<"builds">;
  userId: string | null;
  linkedNodes: BuildNodeManagerLinkedNode[];
  linkedNodeIds: CosplayNodeId[];
  tasks: BuildTask[];
  onOpenLinkNodes: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
  onMoveRoot: (fromIndex: number, toIndex: number) => Promise<void>;
};

export function BuildNodeManagerSection({
  buildId,
  userId,
  linkedNodes,
  linkedNodeIds,
  tasks,
  onOpenLinkNodes,
  onCreateRoot,
  onCreateChild,
  onMoveRoot,
}: BuildNodeManagerSectionProps) {
  const updateNode = useMutation(api.cosplayNodes.update);
  const updateTask = useMutation(api.buildTasks.update);
  const linkNodes = useMutation(api.builds.linkNodes);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const allNodes =
    (useQuery(api.cosplayNodes.list, userId ? { userId, sortBy: "name" } : "skip") ?? []) as BuildNodeManagerLinkedNode[];

  const [viewMode, setViewMode] = useState<"bucketed" | "tree">("bucketed");
  const [search, setSearch] = useState("");
  const [completeCollapsed, setCompleteCollapsed] = useState(true);
  const [selected, setSelected] = useState<NodeSelectionMeta | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<CosplayNodeId | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<CosplayNodeId | "__root__" | null>(null);
  const [linkChildId, setLinkChildId] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isSavingInspector, setIsSavingInspector] = useState(false);
  const [inspectorForm, setInspectorForm] = useState({
    name: "",
    notes: "",
    directCostDollars: "",
    purchaseStatus: "to_buy",
    buildStatus: "not_started",
    materialStatus: "to_buy",
  });

  const setDragState = ({ draggingNodeId, dragOverNodeId }: DragState) => {
    setDraggingNodeId(draggingNodeId);
    setDragOverNodeId(dragOverNodeId);
  };

  const searchNeedle = search.trim().toLowerCase();
  const roots = useMemo(
    () =>
      linkedNodes
        .map((node) => ({
          node,
          rootIndex: linkedNodeIds.findIndex((id) => id === node._id),
          visibleBucket: visibleBucket(node.overallBucket),
        }))
        .filter(({ node }) =>
          !searchNeedle
            ? true
            : `${node.name} ${node.category ?? ""} ${node.nodeType} ${formatNodeStatus(node)}`
                .toLowerCase()
                .includes(searchNeedle)
        ),
    [linkedNodes, linkedNodeIds, searchNeedle]
  );

  const groupedRoots = useMemo(
    () => ({
      inProgress: roots.filter((entry) => entry.visibleBucket === "in_progress"),
      complete: roots.filter((entry) => entry.visibleBucket === "complete"),
    }),
    [roots]
  );

  useEffect(() => {
    if (!roots.length) {
      setSelected(null);
      return;
    }
    setSelected((current) => {
      if (current && roots.some(({ node }) => node._id === current.nodeId)) {
        return current;
      }
      const first = roots[0];
      return first
        ? { nodeId: first.node._id, isRoot: true, rootIndex: first.rootIndex }
        : null;
    });
  }, [roots]);

  const selectedDetail = useQuery(
    api.cosplayNodes.get,
    selected ? { id: selected.nodeId, buildId } : "skip"
  ) as DetailedLinkedNode | null | undefined;

  useEffect(() => {
    if (!selectedDetail) return;
    setInspectorForm({
      name: selectedDetail.name,
      notes: selectedDetail.notes ?? "",
      directCostDollars:
        selectedDetail.directCostCents != null
          ? (selectedDetail.directCostCents / 100).toFixed(2)
          : "",
      purchaseStatus: selectedDetail.purchaseStatus ?? "to_buy",
      buildStatus: selectedDetail.buildStatus ?? "not_started",
      materialStatus: selectedDetail.materialStatus ?? "to_buy",
    });
  }, [selectedDetail]);

  const childCandidates = useMemo(() => {
    if (!selectedDetail) return [];
    return allNodes.filter((candidate) => {
      if (candidate._id === selectedDetail._id) return false;
      return isAllowedChildLink(selectedDetail.nodeType, candidate.nodeType);
    });
  }, [allNodes, selectedDetail]);

  const saveInspector = async () => {
    if (!userId || !selectedDetail) return;
    setIsSavingInspector(true);
    try {
      await updateNode({
        id: selectedDetail._id,
        userId,
        name: inspectorForm.name.trim(),
        notes: inspectorForm.notes.trim() || null,
        directCostCents: inspectorForm.directCostDollars
          ? Math.round(Number(inspectorForm.directCostDollars) * 100)
          : null,
        purchaseStatus: selectedDetail.nodeType === "element" ? inspectorForm.purchaseStatus : null,
        buildStatus: selectedDetail.nodeType === "element" ? inspectorForm.buildStatus : null,
        materialStatus:
          selectedDetail.nodeType === "material" ? inspectorForm.materialStatus : null,
      });
    } finally {
      setIsSavingInspector(false);
    }
  };

  const assignTasks = async (mode: "open" | "unassigned") => {
    if (!userId || !selectedDetail) return;
    const assignable = tasks.filter((task) =>
      mode === "open" ? !task.checked : !(task.cosplayNodeId ?? task.closetItemId)
    );
    await Promise.all(
      assignable.map((task) => updateTask({ id: task._id, userId, cosplayNodeId: selectedDetail._id }))
    );
  };

  const unlinkSelected = async () => {
    if (!userId || !selected) return;
    if (selected.isRoot) {
      await removeNodeFromBuild({ userId, buildId, cosplayNodeId: selected.nodeId });
      return;
    }
    const linkId = selected.siblingLinkIds?.[selected.siblingIndex ?? -1];
    if (!linkId) return;
    await removeChildLink({ userId, id: linkId });
  };

  const moveSelected = async (direction: -1 | 1) => {
    if (!userId || !selected) return;
    if (selected.isRoot) {
      const currentIndex = selected.rootIndex ?? -1;
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= linkedNodeIds.length) return;
      await onMoveRoot(currentIndex, nextIndex);
      setSelected((current) => (current ? { ...current, rootIndex: nextIndex } : current));
      return;
    }
    if (!selected.parentNodeId || !selected.siblingLinkIds || selected.siblingIndex == null) return;
    const nextIndex = selected.siblingIndex + direction;
    if (nextIndex < 0 || nextIndex >= selected.siblingLinkIds.length) return;
    const orderedLinkIds = [...selected.siblingLinkIds];
    const [moved] = orderedLinkIds.splice(selected.siblingIndex, 1);
    if (!moved) return;
    orderedLinkIds.splice(nextIndex, 0, moved);
    await reorderChildren({ parentNodeId: selected.parentNodeId, userId, orderedLinkIds });
    setSelected((current) =>
      current ? { ...current, siblingIndex: nextIndex, siblingLinkIds: orderedLinkIds } : current
    );
  };

  const moveNodeIntoTarget = async (dragged: NodeSelectionMeta, targetNodeId: CosplayNodeId) => {
    if (!userId || dragged.nodeId === targetNodeId) return;
    const draggedNode = allNodes.find((node) => node._id === dragged.nodeId);
    const targetNode = allNodes.find((node) => node._id === targetNodeId);
    if (!draggedNode || !targetNode) return;
    if (!isAllowedChildLink(targetNode.nodeType, draggedNode.nodeType)) {
      setLinkError("That relationship is not allowed.");
      return;
    }
    if (dragged.isRoot) {
      await removeNodeFromBuild({ userId, buildId, cosplayNodeId: dragged.nodeId });
    } else {
      const linkId = dragged.siblingLinkIds?.[dragged.siblingIndex ?? -1];
      if (!linkId) return;
      await removeChildLink({ userId, id: linkId });
    }
    await addChildLink({
      userId,
      parentNodeId: targetNodeId,
      childNodeId: dragged.nodeId,
      linkMode: "owned",
    });
    setLinkError(null);
  };

  const promoteNodeToRoot = async (dragged: NodeSelectionMeta) => {
    if (!userId || dragged.isRoot) return;
    const linkId = dragged.siblingLinkIds?.[dragged.siblingIndex ?? -1];
    if (!linkId) return;
    await removeChildLink({ userId, id: linkId });
    await linkNodes({
      userId,
      buildId,
      cosplayNodeIds: [...linkedNodeIds, dragged.nodeId],
    });
    setSelected({ nodeId: dragged.nodeId, isRoot: true, rootIndex: linkedNodeIds.length });
    setLinkError(null);
  };

  const linkExistingChild = async () => {
    if (!userId || !selectedDetail || !linkChildId) return;
    const candidate = childCandidates.find((node) => node._id === linkChildId);
    if (!candidate) return;
    if (!isAllowedChildLink(selectedDetail.nodeType, candidate.nodeType)) {
      setLinkError("That relationship is not allowed.");
      return;
    }
    setLinkError(null);
    await addChildLink({
      userId,
      parentNodeId: selectedDetail._id,
      childNodeId: linkChildId as CosplayNodeId,
      linkMode: "reference",
    });
    setLinkChildId("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
            Node manager
          </p>
          <h2 className="font-serif text-3xl text-kyar-text">Linked nodes</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateRoot}
            className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            New root node
          </button>
          <button
            type="button"
            onClick={onOpenLinkNodes}
            className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            Link existing
          </button>
        </div>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-kyar-borderSubtle px-5 py-8 text-sm text-kyar-textTertiary">
          No linked nodes yet. Create a root node or link an existing element or material to start
          building the structure for this project.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="min-w-0 rounded-[24px] border border-kyar-borderSubtle/80 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kyar-borderSubtle px-4 py-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search linked nodes..."
                className="min-w-[220px] flex-1 border-0 bg-transparent text-sm placeholder:text-kyar-textTertiary focus:outline-none"
              />
              <div className="inline-flex rounded-full border border-kyar-borderSubtle p-1 text-[10px] uppercase tracking-widest">
                <button
                  type="button"
                  onClick={() => setViewMode("bucketed")}
                  className={`rounded-full px-3 py-1 ${viewMode === "bucketed" ? "bg-black text-white" : ""}`}
                >
                  Bucketed
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("tree")}
                  className={`rounded-full px-3 py-1 ${viewMode === "tree" ? "bg-black text-white" : ""}`}
                >
                  Full tree
                </button>
              </div>
            </div>
            <div className="max-h-[720px] overflow-y-auto px-2 py-2">
              {draggingNodeId ? (
                <button
                  type="button"
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragState({
                      draggingNodeId,
                      dragOverNodeId: "__root__",
                    });
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const raw = event.dataTransfer.getData("application/x-kyarafit-node");
                    setDragState({ draggingNodeId: null, dragOverNodeId: null });
                    if (!raw) return;
                    const dragged = JSON.parse(raw) as NodeSelectionMeta;
                    void promoteNodeToRoot(dragged);
                  }}
                  className={`mb-3 flex w-full items-center justify-center rounded-2xl border border-dashed px-4 py-3 text-[10px] uppercase tracking-widest transition ${
                    dragOverNodeId === "__root__"
                      ? "border-black bg-black text-white"
                      : "border-kyar-borderSubtle text-kyar-textTertiary"
                  }`}
                >
                  Drop here to make root
                </button>
              ) : null}
              {viewMode === "bucketed" ? (
                <div className="space-y-4">
                  <BucketPanel label="In progress" count={groupedRoots.inProgress.length}>
                    {groupedRoots.inProgress.map(({ node, rootIndex }) => (
                      <BuildNodeManagerRow
                        key={node._id}
                        buildId={buildId}
                        node={node}
                        userId={userId}
                        isSelected={selected?.nodeId === node._id}
                        selectionMeta={{ nodeId: node._id, isRoot: true, rootIndex }}
                        onSelect={setSelected}
                        onCreateChild={onCreateChild}
                        onMoveNode={moveNodeIntoTarget}
                        draggingNodeId={draggingNodeId}
                        dragOverNodeId={dragOverNodeId}
                    onDragStateChange={setDragState}
                      />
                    ))}
                  </BucketPanel>
                  <BucketPanel
                    label="Complete"
                    count={groupedRoots.complete.length}
                    collapsed={completeCollapsed}
                    onToggle={() => setCompleteCollapsed((value) => !value)}
                  >
                    {groupedRoots.complete.map(({ node, rootIndex }) => (
                      <BuildNodeManagerRow
                        key={node._id}
                        buildId={buildId}
                        node={node}
                        userId={userId}
                        isSelected={selected?.nodeId === node._id}
                        selectionMeta={{ nodeId: node._id, isRoot: true, rootIndex }}
                        onSelect={setSelected}
                        onCreateChild={onCreateChild}
                        onMoveNode={moveNodeIntoTarget}
                        draggingNodeId={draggingNodeId}
                        dragOverNodeId={dragOverNodeId}
                        onDragStateChange={setDragState}
                      />
                    ))}
                  </BucketPanel>
                </div>
              ) : (
                <div className="space-y-1">
                  {roots.map(({ node, rootIndex }) => (
                    <BuildNodeManagerRow
                      key={node._id}
                      buildId={buildId}
                      node={node}
                      userId={userId}
                      isSelected={selected?.nodeId === node._id}
                      selectionMeta={{ nodeId: node._id, isRoot: true, rootIndex }}
                      onSelect={setSelected}
                      onCreateChild={onCreateChild}
                      onMoveNode={moveNodeIntoTarget}
                      draggingNodeId={draggingNodeId}
                      dragOverNodeId={dragOverNodeId}
                      onDragStateChange={setDragState}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-[24px] border border-kyar-borderSubtle/80 bg-white p-5">
            {selectedDetail ? (
              <div className="space-y-5">
                <div className="border-b border-kyar-borderSubtle pb-4">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                    Inspector
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl text-kyar-text">{selectedDetail.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        <span>{formatNodeTypeLabel(selectedDetail.nodeType)}</span>
                        <span>
                          {visibleBucket(selectedDetail.overallBucket) === "complete"
                            ? "Complete"
                            : "In progress"}
                        </span>
                        <span>{selectedDetail.progressPercent ?? 0}% progress</span>
                      </div>
                    </div>
                    <Link
                      href={`/elements/${selectedDetail._id}`}
                      className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                    >
                      Open
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="col-span-2 space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Name</span>
                    <input
                      value={inspectorForm.name}
                      onChange={(event) =>
                        setInspectorForm((current) => ({ ...current, name: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Direct cost</span>
                    <input
                      value={inspectorForm.directCostDollars}
                      onChange={(event) =>
                        setInspectorForm((current) => ({
                          ...current,
                          directCostDollars: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                    />
                  </label>
                  <div className="rounded-2xl border border-kyar-borderSubtle px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Rollup cost</p>
                    <p className="mt-2 text-lg font-medium text-kyar-text">
                      {selectedDetail.totalCostCents != null ? formatCents(selectedDetail.totalCostCents) : "—"}
                    </p>
                  </div>
                  {selectedDetail.nodeType === "element" ? (
                    <>
                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Purchase</span>
                        <select
                          value={inspectorForm.purchaseStatus}
                          onChange={(event) =>
                            setInspectorForm((current) => ({
                              ...current,
                              purchaseStatus: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                        >
                          <option value="to_buy">To buy</option>
                          <option value="bought">Bought</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Build</span>
                        <select
                          value={inspectorForm.buildStatus}
                          onChange={(event) =>
                            setInspectorForm((current) => ({
                              ...current,
                              buildStatus: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                        >
                          <option value="not_started">Not started</option>
                          <option value="wip">WIP</option>
                          <option value="built">Built</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="col-span-2 space-y-2">
                      <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Material status</span>
                      <select
                        value={inspectorForm.materialStatus}
                        onChange={(event) =>
                          setInspectorForm((current) => ({
                            ...current,
                            materialStatus: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                      >
                        <option value="to_buy">To buy</option>
                        <option value="bought">Bought</option>
                        <option value="in_use">In use</option>
                        <option value="complete">Complete</option>
                      </select>
                    </label>
                  )}
                  <label className="col-span-2 space-y-2">
                    <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Notes</span>
                    <textarea
                      value={inspectorForm.notes}
                      onChange={(event) =>
                        setInspectorForm((current) => ({ ...current, notes: event.target.value }))
                      }
                      rows={4}
                      className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      onCreateChild(
                        selectedDetail._id,
                        selectedDetail.nodeType === "material" ? "material" : "element"
                      )
                    }
                    className="rounded-full border border-black px-4 py-3 text-[10px] uppercase tracking-widest"
                  >
                    New child
                  </button>
                  <button
                    type="button"
                    onClick={unlinkSelected}
                    className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest"
                  >
                    {selected?.isRoot ? "Unlink root" : "Unlink child"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveSelected(-1)}
                    disabled={
                      selected?.isRoot
                        ? (selected.rootIndex ?? 0) <= 0
                        : (selected?.siblingIndex ?? 0) <= 0
                    }
                    className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveSelected(1)}
                    disabled={
                      selected?.isRoot
                        ? (selected.rootIndex ?? -1) >= linkedNodeIds.length - 1
                        : (selected?.siblingIndex ?? -1) >= ((selected?.siblingLinkIds?.length ?? 1) - 1)
                    }
                    className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40"
                  >
                    Move down
                  </button>
                </div>

                <div className="rounded-2xl border border-kyar-borderSubtle bg-kyar-bg px-4 py-4">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Bulk task assign</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void assignTasks("open")}
                      className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest"
                    >
                      Assign all open
                    </button>
                    <button
                      type="button"
                      onClick={() => void assignTasks("unassigned")}
                      className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest"
                    >
                      Assign unassigned
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-kyar-borderSubtle bg-kyar-bg px-4 py-4">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Link reusable child</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={linkChildId}
                      onChange={(event) => setLinkChildId(event.target.value)}
                      className="min-w-0 flex-1 rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 text-sm focus:outline-none"
                    >
                      <option value="">Select an existing node</option>
                      {childCandidates.map((candidate) => (
                        <option key={candidate._id} value={candidate._id}>
                          {candidate.name} · {formatNodeTypeLabel(candidate.nodeType)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={linkExistingChild}
                      disabled={!linkChildId}
                      className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40"
                    >
                      Link child
                    </button>
                  </div>
                  {linkError ? <p className="mt-2 text-xs text-red-600">{linkError}</p> : null}
                </div>

                <button
                  type="button"
                  onClick={saveInspector}
                  disabled={isSavingInspector || !inspectorForm.name.trim()}
                  className="w-full rounded-full bg-black px-4 py-3 text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
                >
                  {isSavingInspector ? "Saving..." : "Save node changes"}
                </button>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-center text-sm text-kyar-textTertiary">
                Select a linked node to manage its structure, status, and task assignment.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BucketPanel({
  label,
  count,
  children,
  collapsed = false,
  onToggle,
}: {
  label: string;
  count: number;
  children: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section className="rounded-[20px] border border-kyar-borderSubtle/80 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 border-b border-kyar-borderSubtle px-4 py-3 text-left"
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">{label}</p>
          <p className="text-sm text-kyar-textSecondary">
            {count} root node{count === 1 ? "" : "s"}
          </p>
        </div>
        {onToggle ? (
          <span className="material-symbols-outlined text-lg text-kyar-textTertiary">
            {collapsed ? "expand_more" : "expand_less"}
          </span>
        ) : null}
      </button>
      {!collapsed ? <div className="p-2">{children}</div> : null}
    </section>
  );
}

function BuildNodeManagerRow({
  buildId,
  node,
  userId,
  isSelected,
  selectionMeta,
  onSelect,
  onCreateChild,
  onMoveNode,
  draggingNodeId,
  dragOverNodeId,
  onDragStateChange,
}: {
  buildId: Id<"builds">;
  node: BuildNodeManagerLinkedNode;
  userId: string | null;
  isSelected: boolean;
  selectionMeta: NodeSelectionMeta;
  onSelect: (meta: NodeSelectionMeta) => void;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
  onMoveNode: (dragged: NodeSelectionMeta, targetNodeId: CosplayNodeId) => Promise<void>;
  draggingNodeId: CosplayNodeId | null;
  dragOverNodeId: CosplayNodeId | "__root__" | null;
  onDragStateChange: (state: DragState) => void;
}) {
  const detail = useQuery(api.cosplayNodes.get, { id: node._id, buildId }) as DetailedLinkedNode | null | undefined;
  const { setNodeRef, isOver } = useDroppable({ id: node._id, data: { type: "cosplayNode" } });
  const [expanded, setExpanded] = useState(selectionMeta.isRoot);
  const children = detail?.children ?? [];

  const isDragging = draggingNodeId === node._id;
  const isDragTarget = dragOverNodeId === node._id && draggingNodeId !== node._id;

  return (
    <div className="space-y-1">
      <div
        ref={setNodeRef}
        draggable={Boolean(userId)}
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-kyarafit-node", JSON.stringify(selectionMeta));
          event.dataTransfer.effectAllowed = "move";
          onDragStateChange({ draggingNodeId: node._id, dragOverNodeId: null });
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (draggingNodeId && draggingNodeId !== node._id) {
            onDragStateChange({ draggingNodeId, dragOverNodeId: node._id });
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const raw = event.dataTransfer.getData("application/x-kyarafit-node");
          onDragStateChange({ draggingNodeId: null, dragOverNodeId: null });
          if (!raw) return;
          const dragged = JSON.parse(raw) as NodeSelectionMeta;
          void onMoveNode(dragged, node._id);
        }}
        onDragEnd={() => onDragStateChange({ draggingNodeId: null, dragOverNodeId: null })}
        className={`rounded-2xl border px-3 py-3 transition ${
          isSelected
            ? "border-black bg-kyar-bg"
            : "border-transparent hover:border-kyar-borderSubtle hover:bg-kyar-bg"
        } ${isOver || isDragTarget ? "border-black bg-black/[0.03] ring-1 ring-black" : ""} ${
          isDragging ? "opacity-55" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 min-h-[32px] min-w-[32px] rounded-full text-kyar-textTertiary"
          >
            <span className="material-symbols-outlined text-lg">
              {children.length ? (expanded ? "expand_more" : "chevron_right") : "fiber_manual_record"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onSelect(selectionMeta)}
            className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-kyar-textTertiary">{nodeIcon(detail?.nodeType ?? node.nodeType)}</span>
                <span className="truncate text-sm font-medium text-kyar-text">{detail?.name ?? node.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                <span>{formatNodeTypeLabel(detail?.nodeType ?? node.nodeType)}</span>
                <span>{formatNodeStatus(detail ?? node)}</span>
                <span>{detail?.progressPercent ?? node.progressPercent ?? 0}% progress</span>
                <span>
                  {detail?.totalCostCents != null
                    ? formatCents(detail.totalCostCents)
                    : node.totalCostCents != null
                      ? formatCents(node.totalCostCents)
                      : "—"}
                </span>
              </div>
            </div>
          </button>
          {userId ? (
            <button
              type="button"
              onClick={() =>
                onCreateChild(
                  node._id,
                  (detail?.nodeType ?? node.nodeType) === "material" ? "material" : "element"
                )
              }
              className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
            >
              Add
            </button>
          ) : null}
        </div>
        {isDragTarget ? (
          <div className="pl-10 pt-2 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
            Drop to nest under {detail?.name ?? node.name}
          </div>
        ) : null}
      </div>
      {expanded && children.length ? (
        <div className="ml-6 border-l border-kyar-borderSubtle pl-3">
          {children.map((child, index) => (
            <BuildNodeManagerRow
              key={child._id}
              buildId={buildId}
              node={child}
              userId={userId}
              isSelected={selectionMeta.nodeId === child._id}
              selectionMeta={{
                nodeId: child._id,
                isRoot: false,
                parentNodeId: node._id,
                siblingLinkIds: children.map((entry) => entry.linkId),
                siblingIndex: index,
              }}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onMoveNode={onMoveNode}
              draggingNodeId={draggingNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStateChange={onDragStateChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
