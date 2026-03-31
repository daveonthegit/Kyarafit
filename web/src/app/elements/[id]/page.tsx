"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  COSPLAY_LINK_MODES,
  COSPLAY_NODE_TYPES,
  ELEMENT_BUILD_STATUSES,
  ELEMENT_PURCHASE_STATUSES,
  MATERIAL_STATUSES,
} from "@kyarafit/design-system/types";
import { formatNodeStatus, formatNodeTypeLabel } from "@/lib/cosplayUi";

type CosplayNodeId = Id<"cosplayNodes">;
type NodeKind = "element" | "material";
type WorkflowNode = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowNode[];
};

function flattenWorkflow(
  nodes: WorkflowNode[],
  depth = 0
): Array<WorkflowNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenWorkflow(node.children, depth + 1),
  ]);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

function isAllowedChildLink(parentType: NodeKind, childType: NodeKind) {
  if (parentType === "element") return true;
  return childType === "material";
}

export default function ElementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const id = params.id as CosplayNodeId;
  const node = useQuery(api.cosplayNodes.get, id ? { id } : "skip");
  const allNodes = (useQuery(api.cosplayNodes.list, userId ? { userId } : "skip") ?? []) as Array<{
    _id: CosplayNodeId;
    name: string;
    nodeType: "element" | "material";
  }>;
  const buildsUsing =
    useQuery(api.builds.getBuildsUsingNode, id ? { cosplayNodeId: id } : "skip") ?? [];
  const [workflowView, setWorkflowView] = useState<"shared" | "build_specific">("shared");
  const [selectedWorkflowBuildId, setSelectedWorkflowBuildId] = useState<Id<"builds"> | "">("");
  const workflow =
    useQuery(
      api.workflow.listNodeWorkflow,
      id
        ? {
            cosplayNodeId: id,
            buildId: selectedWorkflowBuildId
              ? (selectedWorkflowBuildId as Id<"builds">)
              : undefined,
          }
        : "skip"
    ) ?? null;
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const updateNode = useMutation(api.cosplayNodes.update);
  const removeNode = useMutation(api.cosplayNodes.remove);
  const convertType = useMutation(api.cosplayNodes.convertType);
  const addNodesToBuild = useMutation(api.builds.addNodesToBuild);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const createTask = useMutation(api.workflow.create);
  const updateTask = useMutation(api.workflow.update);
  const deleteTask = useMutation(api.workflow.remove);

  const [isEditing, setIsEditing] = useState(false);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showChildPanel, setShowChildPanel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [hierarchyQuery, setHierarchyQuery] = useState("");
  const [childBucketFilter, setChildBucketFilter] = useState<
    "all" | "incomplete" | "in_progress" | "complete"
  >("all");
  const [buildQuery, setBuildQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("all");
  const [existingChildId, setExistingChildId] = useState("");
  const [linkMode, setLinkMode] = useState<"owned" | "reference">("reference");
  const [newChildType, setNewChildType] = useState<"element" | "material">("element");
  const [form, setForm] = useState({
    name: "",
    notes: "",
    directCostDollars: "",
    purchaseStatus: "to_buy",
    buildStatus: "not_started",
    materialStatus: "to_buy",
    imageUrl: "",
    imageStorageId: null as Id<"_storage"> | null,
  });

  useEffect(() => {
    if (!node) return;
    setForm({
      name: node.name,
      notes: node.notes ?? "",
      directCostDollars:
        node.directCostCents != null ? (node.directCostCents / 100).toFixed(2) : "",
      purchaseStatus: node.purchaseStatus ?? "to_buy",
      buildStatus: node.buildStatus ?? "not_started",
      materialStatus: node.materialStatus ?? "to_buy",
      imageUrl: node.imageUrl ?? "",
      imageStorageId: node.imageStorageId ?? null,
    });
  }, [node]);

  useEffect(() => {
    if (!node) return;
    if (!isAllowedChildLink(node.nodeType as NodeKind, newChildType)) {
      setNewChildType("element");
    }
  }, [node, newChildType]);
  const hierarchyNeedle = hierarchyQuery.trim().toLowerCase();
  const filteredParents = useMemo(
    () =>
      (node?.parents ?? []).filter((parent) =>
        !hierarchyNeedle
          ? true
          : `${parent.name} ${parent.nodeType}`.toLowerCase().includes(hierarchyNeedle)
      ),
    [node?.parents, hierarchyNeedle]
  );
  const filteredChildren = useMemo(
    () =>
      (node?.children ?? []).filter((child) => {
        const matchesQuery =
          !hierarchyNeedle ||
          `${child.name} ${child.nodeType} ${child.linkMode} ${formatNodeStatus(child as Parameters<typeof formatNodeStatus>[0])}`
            .toLowerCase()
            .includes(hierarchyNeedle);
        const matchesBucket =
          childBucketFilter === "all" || child.overallBucket === childBucketFilter;
        return matchesQuery && matchesBucket;
      }),
    [node?.children, hierarchyNeedle, childBucketFilter]
  );
  const buildNeedle = buildQuery.trim().toLowerCase();
  const filteredBuildsUsing = useMemo(
    () =>
      buildsUsing.filter((build) =>
        !buildNeedle
          ? true
          : `${build.name} ${build.character ?? ""}`.toLowerCase().includes(buildNeedle)
      ),
    [buildsUsing, buildNeedle]
  );
  const taskNeedle = taskQuery.trim().toLowerCase();
  const visibleWorkflowRows = useMemo(() => {
    const source =
      workflowView === "shared" ? (workflow?.shared ?? []) : (workflow?.buildSpecific ?? []);
    return flattenWorkflow(source).filter((task) => {
      const matchesQuery = !taskNeedle || task.title.toLowerCase().includes(taskNeedle);
      const isDone = task.status === "done";
      const matchesFilter = taskFilter === "all" || (taskFilter === "open" ? !isDone : isDone);
      return matchesQuery && matchesFilter;
    });
  }, [taskFilter, taskNeedle, workflow?.buildSpecific, workflow?.shared, workflowView]);

  if (node === undefined)
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading…</p>
      </WebAppShell>
    );
  if (!node)
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Node not found.</p>
      </WebAppShell>
    );

  const childCandidates = allNodes.filter(
    (candidate) =>
      candidate._id !== id && isAllowedChildLink(node.nodeType as NodeKind, candidate.nodeType)
  );
  const availableChildTypes = COSPLAY_NODE_TYPES.filter((value) =>
    isAllowedChildLink(node.nodeType as NodeKind, value)
  );

  const save = async () => {
    if (!userId) return;
    await updateNode({
      id,
      userId,
      name: form.name,
      notes: form.notes || null,
      directCostCents: form.directCostDollars
        ? Math.round(parseFloat(form.directCostDollars) * 100)
        : null,
      imageUrl: form.imageStorageId ? null : form.imageUrl || null,
      imageStorageId: form.imageStorageId ?? undefined,
      purchaseStatus: node.nodeType === "element" ? form.purchaseStatus : null,
      buildStatus: node.nodeType === "element" ? form.buildStatus : null,
      materialStatus: node.nodeType === "material" ? form.materialStatus : null,
    });
    setIsEditing(false);
  };

  const openFullCreateChildFlow = () => {
    if (!userId) return;
    if (!isAllowedChildLink(node.nodeType as NodeKind, newChildType)) {
      setError("That relationship is not allowed.");
      return;
    }
    openCreationModal("newCloset", {
      initialNodeType: newChildType,
      initialCategory: newChildType === "material" ? "material" : "other",
      successRedirectTo: null,
      onCreated: async (child) => {
        await addChildLink({
          userId,
          parentNodeId: id,
          childNodeId: child._id,
          linkMode: "owned",
        });
        setError(null);
        setShowChildPanel(false);
      },
    });
  };

  const handleAddTask = async () => {
    if (!userId || !newTaskLabel.trim()) return;
    const isBuildSpecific = workflowView === "build_specific" && selectedWorkflowBuildId;
    await createTask({
      userId,
      title: newTaskLabel.trim(),
      kind: "task",
      category: "craft",
      scopeKind: isBuildSpecific ? "build_specific" : "shared",
      attachments: isBuildSpecific
        ? [
            {
              entityType: "build",
              entityId: selectedWorkflowBuildId as Id<"builds">,
              role: "primary",
              buildContextId: selectedWorkflowBuildId as Id<"builds">,
            },
            {
              entityType: "cosplayNode",
              entityId: id,
              role: "progress_source",
              buildContextId: selectedWorkflowBuildId as Id<"builds">,
            },
          ]
        : [{ entityType: "cosplayNode", entityId: id, role: "primary" }],
    });
    setNewTaskLabel("");
  };

  const moveChild = async (fromIndex: number, toIndex: number) => {
    if (!userId || toIndex < 0 || toIndex >= node.children.length) return;
    const orderedLinkIds = node.children.map((child) => child.linkId);
    const [moved] = orderedLinkIds.splice(fromIndex, 1);
    if (!moved) return;
    orderedLinkIds.splice(toIndex, 0, moved);
    await reorderChildren({ parentNodeId: id, userId, orderedLinkIds });
  };

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-kyar-borderSubtle bg-kyar-bg/95 pb-4 pt-4 backdrop-blur-sm">
        <Link
          href="/elements"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <h1 className="font-serif text-xl italic">
          {formatNodeTypeLabel(node.nodeType as NodeKind)}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              convertType({
                id,
                userId: userId!,
                nodeType: node.nodeType === "element" ? "material" : "element",
              })
            }
            className="px-3 py-2 text-[10px] uppercase tracking-widest"
          >
            Convert
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        </div>
      </header>

      <main className="grid max-w-6xl grid-cols-1 gap-8 py-8 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-3xl bg-kyar-mutedWarm shadow-soft">
            {node.imageStorageId || node.imageUrl ? (
              <ResolvedImage
                imageStorageId={node.imageStorageId}
                imageUrl={node.imageUrl}
                alt={node.name}
                className="h-[420px] w-full object-cover"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center text-kyar-textTertiary">
                <span className="material-symbols-outlined text-6xl">
                  {node.nodeType === "material" ? "science" : "checkroom"}
                </span>
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-kyar-borderSubtle bg-white p-5 shadow-soft">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-kyar-borderSubtle px-3 py-1 text-[10px] uppercase tracking-widest">
                {formatNodeTypeLabel(node.nodeType as NodeKind)}
              </span>
              <span className="rounded-full border border-kyar-borderSubtle px-3 py-1 text-[10px] uppercase tracking-widest">
                {formatNodeStatus(node as Parameters<typeof formatNodeStatus>[0])}
              </span>
              <span className="rounded-full border border-kyar-borderSubtle px-3 py-1 text-[10px] uppercase tracking-widest">
                {node.progressPercent}% progress
              </span>
            </div>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                    Node image
                  </p>
                  <ImageUpload
                    category="closet"
                    onImageSelected={(result) => {
                      if ("imageStorageId" in result && result.imageStorageId) {
                        setForm((prev) => ({
                          ...prev,
                          imageStorageId: result.imageStorageId,
                          imageUrl: "",
                        }));
                      } else {
                        setForm((prev) => ({
                          ...prev,
                          imageUrl: result.imageUrl ?? "",
                          imageStorageId: null,
                        }));
                      }
                    }}
                    currentImage={form.imageUrl || undefined}
                    currentStorageId={form.imageStorageId ?? undefined}
                  />
                </div>
                <UnderlineInput
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <UnderlineInput
                  label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
                <UnderlineInput
                  label="Direct cost $"
                  type="number"
                  step="0.01"
                  value={form.directCostDollars}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, directCostDollars: e.target.value }))
                  }
                />
                {node.nodeType === "element" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={form.purchaseStatus}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, purchaseStatus: e.target.value }))
                      }
                      className="rounded-lg border border-kyar-borderSubtle px-3 py-2 text-sm"
                    >
                      {ELEMENT_PURCHASE_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      value={form.buildStatus}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, buildStatus: e.target.value }))
                      }
                      className="rounded-lg border border-kyar-borderSubtle px-3 py-2 text-sm"
                    >
                      {ELEMENT_BUILD_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={form.materialStatus}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, materialStatus: e.target.value }))
                    }
                    className="w-full rounded-lg border border-kyar-borderSubtle px-3 py-2 text-sm"
                  >
                    {MATERIAL_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={save}
                  className="rounded-full bg-black px-4 py-2 text-[10px] uppercase tracking-widest text-white"
                >
                  Save node
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-serif text-5xl italic leading-none">{node.name}</h2>
                <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                      Own cost
                    </p>
                    <p className="font-serif text-2xl italic">
                      {node.directCostCents ? formatCents(node.directCostCents) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                      Rollup cost
                    </p>
                    <p className="font-serif text-2xl italic">
                      {node.totalCostCents ? formatCents(node.totalCostCents) : "—"}
                    </p>
                  </div>
                </div>
                {node.notes && (
                  <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-kyar-textSecondary">
                    {node.notes}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <section className="space-y-8">
          <div className="rounded-3xl border border-kyar-borderSubtle bg-white p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                  Hierarchy
                </p>
                <h3 className="font-serif text-2xl italic">Parents & children</h3>
                <p className="mt-2 text-sm text-kyar-textSecondary">
                  Explorer-style view for attached structure. Search, filter, reorder, and unlink
                  without losing context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChildPanel(true)}
                className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
              >
                Add child
              </button>
            </div>
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <input
                type="search"
                value={hierarchyQuery}
                onChange={(e) => setHierarchyQuery(e.target.value)}
                placeholder="Search parents or children..."
                className="w-full rounded-xl border border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3 text-sm placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none"
              />
              <select
                value={childBucketFilter}
                onChange={(e) => setChildBucketFilter(e.target.value as typeof childBucketFilter)}
                className="rounded-xl border border-kyar-borderSubtle bg-white px-4 py-3 text-sm text-kyar-text"
              >
                <option value="all">All child buckets</option>
                <option value="incomplete">Incomplete</option>
                <option value="in_progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
              <div className="rounded-2xl border border-kyar-borderSubtle">
                <div className="border-b border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                    Reused in
                  </p>
                  <p className="text-sm text-kyar-textSecondary">
                    {filteredParents.length} parent link{filteredParents.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {filteredParents.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-kyar-textTertiary">
                      {node.parents.length === 0
                        ? "No parent links yet."
                        : "No parent links match your search."}
                    </p>
                  ) : (
                    filteredParents.map((parent) => (
                      <Link
                        key={parent._id}
                        href={`/elements/${parent._id}`}
                        className="flex items-center justify-between gap-3 border-b border-kyar-borderSubtle px-4 py-3 last:border-b-0 hover:bg-kyar-muted/20"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-kyar-text">{parent.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                            {formatNodeTypeLabel(parent.nodeType as NodeKind)}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-base text-kyar-textTertiary">
                          arrow_outward
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-kyar-borderSubtle">
                <div className="border-b border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                    Child structure
                  </p>
                  <p className="text-sm text-kyar-textSecondary">
                    {filteredChildren.length} child link{filteredChildren.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {filteredChildren.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-kyar-textTertiary">
                      {node.children.length === 0
                        ? "No child nodes yet."
                        : "No child nodes match the current search/filter."}
                    </p>
                  ) : (
                    filteredChildren.map((child) => {
                      const index = node.children.findIndex((entry) => entry._id === child._id);
                      return (
                        <div
                          key={child._id}
                          className="border-b border-kyar-borderSubtle px-4 py-3 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <Link href={`/elements/${child._id}`} className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                <p className="truncate font-medium text-kyar-text">{child.name}</p>
                                <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                                  {formatNodeTypeLabel(child.nodeType as NodeKind)}
                                </span>
                                <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                                  {formatNodeStatus(
                                    child as Parameters<typeof formatNodeStatus>[0]
                                  )}
                                </span>
                                <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                                  {child.linkMode}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-kyar-textTertiary">
                                <span>{child.progressPercent}% progress</span>
                                <span>{child.childCount} nested</span>
                                {child.hasIncompleteDescendants && <span>nested work remains</span>}
                              </div>
                            </Link>
                            <div className="flex shrink-0 items-center gap-2">
                              {userId && index > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveChild(index, index - 1)}
                                  className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                                >
                                  Up
                                </button>
                              )}
                              {userId && index < node.children.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveChild(index, index + 1)}
                                  className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                                >
                                  Down
                                </button>
                              )}
                              {userId && (
                                <button
                                  type="button"
                                  onClick={() => removeChildLink({ id: child.linkId, userId })}
                                  className="rounded-full border border-kyar-danger px-3 py-2 text-[10px] uppercase tracking-widest text-kyar-danger"
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-kyar-borderSubtle bg-white p-6 shadow-soft">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                    Linked builds
                  </p>
                  <h3 className="font-serif text-2xl italic">Build usage</h3>
                  <p className="mt-2 text-sm text-kyar-textSecondary">
                    Reuse overview for this node across projects.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBuildPanel(true)}
                  className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
                >
                  Link build
                </button>
              </div>
              <div className="mb-4">
                <input
                  type="search"
                  value={buildQuery}
                  onChange={(e) => setBuildQuery(e.target.value)}
                  placeholder="Search linked builds..."
                  className="w-full rounded-xl border border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3 text-sm placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none"
                />
              </div>
              <div className="mb-3 text-xs uppercase tracking-widest text-kyar-textTertiary">
                {filteredBuildsUsing.length} build{filteredBuildsUsing.length === 1 ? "" : "s"}
              </div>
              <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-kyar-borderSubtle">
                {filteredBuildsUsing.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-kyar-textTertiary">
                    {buildsUsing.length === 0
                      ? "Not linked to any builds yet."
                      : "No linked builds match your search."}
                  </p>
                ) : (
                  filteredBuildsUsing.map((build) => (
                    <div
                      key={build._id}
                      className="flex items-center justify-between gap-3 border-b border-kyar-borderSubtle px-4 py-3 last:border-b-0"
                    >
                      <Link href={`/build-detail/${build._id}`} className="min-w-0 flex-1">
                        <p className="truncate font-medium text-kyar-text">{build.name}</p>
                        <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                          {build.character || "build"}
                        </p>
                      </Link>
                      {userId && (
                        <button
                          type="button"
                          onClick={() =>
                            removeNodeFromBuild({ userId, buildId: build._id, cosplayNodeId: id })
                          }
                          className="rounded-full border border-kyar-borderSubtle px-4 py-2 text-[10px] uppercase tracking-widest"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-kyar-borderSubtle bg-white p-6 shadow-soft">
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                  Task graph
                </p>
                <h3 className="font-serif text-2xl italic">Workflow</h3>
                <p className="mt-2 text-sm text-kyar-textSecondary">
                  Shared workflow lives with the item itself. Build-specific workflow stays scoped
                  to the selected build when you need one-off prep, pack, or modification work.
                </p>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkflowView("shared")}
                  className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-widest ${workflowView === "shared" ? "border-black bg-black text-white" : "border-kyar-borderSubtle"}`}
                >
                  Shared
                </button>
                <button
                  type="button"
                  onClick={() => setWorkflowView("build_specific")}
                  className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-widest ${workflowView === "build_specific" ? "border-black bg-black text-white" : "border-kyar-borderSubtle"}`}
                >
                  Build specific
                </button>
                {workflowView === "build_specific" && (
                  <select
                    value={selectedWorkflowBuildId}
                    onChange={(e) =>
                      setSelectedWorkflowBuildId(e.target.value as Id<"builds"> | "")
                    }
                    className="rounded-xl border border-kyar-borderSubtle bg-white px-4 py-3 text-sm text-kyar-text"
                  >
                    <option value="">Choose a build</option>
                    {buildsUsing.map((build) => (
                      <option key={build._id} value={build._id}>
                        {build.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]">
                <input
                  type="search"
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full rounded-xl border border-kyar-borderSubtle bg-kyar-muted/20 px-4 py-3 text-sm placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none"
                />
                <select
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value as typeof taskFilter)}
                  className="rounded-xl border border-kyar-borderSubtle bg-white px-4 py-3 text-sm text-kyar-text"
                >
                  <option value="all">All tasks</option>
                  <option value="open">Open only</option>
                  <option value="done">Done only</option>
                </select>
              </div>
              <div className="mb-3 text-xs uppercase tracking-widest text-kyar-textTertiary">
                {visibleWorkflowRows.length} item{visibleWorkflowRows.length === 1 ? "" : "s"} ·{" "}
                {visibleWorkflowRows.filter((task) => task.status === "done").length} complete
              </div>
              <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-kyar-borderSubtle">
                {visibleWorkflowRows.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-kyar-textTertiary">
                    {workflowView === "build_specific" && !selectedWorkflowBuildId
                      ? "Choose a build to view build-specific workflow."
                      : "No workflow items match your current view."}
                  </p>
                ) : (
                  visibleWorkflowRows.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-3 border-b border-kyar-borderSubtle px-4 py-3 last:border-b-0"
                      style={{ paddingLeft: `${16 + task.depth * 20}px` }}
                    >
                      <input
                        type="checkbox"
                        checked={task.status === "done"}
                        onChange={(e) =>
                          userId &&
                          updateTask({
                            id: task._id,
                            userId,
                            status: e.target.checked ? "done" : "not_started",
                          })
                        }
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${task.status === "done" ? "line-through text-kyar-textTertiary" : ""}`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                          {task.kind} · {task.status.split("_").join(" ")} · {task.progressPercent}%
                        </p>
                      </div>
                      {userId && (
                        <button
                          type="button"
                          onClick={() => deleteTask({ id: task._id, userId })}
                          className="text-kyar-danger"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleAddTask()}
                  placeholder={
                    workflowView === "shared"
                      ? "Add a shared workflow item…"
                      : "Add a build-specific workflow item…"
                  }
                  className="flex-1 border-0 border-b border-kyar-borderSubtle bg-transparent py-2 text-sm focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={() => handleAddTask()}
                  className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="rounded-full border border-kyar-danger px-5 py-3 text-[10px] uppercase tracking-widest text-kyar-danger"
            >
              Delete node
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </main>

      <ResponsivePanel
        open={showBuildPanel}
        onClose={() => setShowBuildPanel(false)}
        title="Link to build"
      >
        <div className="space-y-2">
          {builds.map((build) => (
            <button
              key={build._id}
              type="button"
              onClick={() =>
                userId && addNodesToBuild({ userId, buildId: build._id, cosplayNodeIds: [id] })
              }
              className="flex w-full items-center justify-between gap-3 border border-kyar-border p-3 text-left"
            >
              <span className="truncate text-sm font-medium">{build.name}</span>
              <span className="text-[10px] uppercase tracking-widest">Add</span>
            </button>
          ))}
        </div>
      </ResponsivePanel>

      <ResponsivePanel
        open={showChildPanel}
        onClose={() => setShowChildPanel(false)}
        title="Add child node"
      >
        <div className="space-y-5">
          <div className="space-y-2 border-b border-kyar-borderSubtle pb-5">
            <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
              Create child
            </p>
            <div className="flex gap-2">
              {availableChildTypes.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNewChildType(value)}
                  className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-widest ${newChildType === value ? "border-black bg-black text-white" : "border-kyar-borderSubtle"}`}
                >
                  {formatNodeTypeLabel(value)}
                </button>
              ))}
            </div>
            <p className="text-xs text-kyar-textTertiary">
              {node.nodeType === "element"
                ? "Elements can contain both elements and materials."
                : "Materials can contain other materials. Elements can’t be children of materials."}
            </p>
            <button
              type="button"
              onClick={openFullCreateChildFlow}
              className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
            >
              Open full create flow
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
              Link existing node
            </p>
            <select
              value={existingChildId}
              onChange={(e) => setExistingChildId(e.target.value)}
              className="w-full rounded-lg border border-kyar-borderSubtle px-3 py-2 text-sm"
            >
              <option value="">Choose a node</option>
              {childCandidates.map((candidate) => (
                <option key={candidate._id} value={candidate._id}>
                  {candidate.name} · {formatNodeTypeLabel(candidate.nodeType as NodeKind)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              {COSPLAY_LINK_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLinkMode(value)}
                  className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-widest ${linkMode === value ? "border-black bg-black text-white" : "border-kyar-borderSubtle"}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const selectedCandidate = childCandidates.find(
                  (candidate) => candidate._id === existingChildId
                );
                if (!userId || !existingChildId || !selectedCandidate) return;
                if (!isAllowedChildLink(node.nodeType as NodeKind, selectedCandidate.nodeType)) {
                  setError("That relationship is not allowed.");
                  return;
                }
                addChildLink({
                  userId,
                  parentNodeId: id,
                  childNodeId: existingChildId as CosplayNodeId,
                  linkMode,
                })
                  .then(() => {
                    setError(null);
                    setShowChildPanel(false);
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Could not link child"));
              }}
              className="rounded-full border border-black px-4 py-2 text-[10px] uppercase tracking-widest"
            >
              Link child
            </button>
          </div>
        </div>
      </ResponsivePanel>

      <AdaptiveModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        aria-labelledby="delete-node-dialog-title"
      >
        <div className="p-6">
          <h2 id="delete-node-dialog-title" className="mb-2 font-serif text-lg font-bold">
            Delete this node?
          </h2>
          <p className="mb-6 text-sm text-kyar-meta">
            This removes the node itself. To keep reusable structure intact, unlink it from builds
            or parents instead when possible.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDelete(false)}
              className="flex-1 rounded-full border border-black py-3 text-sm font-bold uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (userId) {
                  await removeNode({ id, userId });
                  router.push("/elements");
                }
              }}
              className="flex-1 rounded-full bg-kyar-danger py-3 text-sm font-bold uppercase tracking-wider text-white"
            >
              Delete
            </button>
          </div>
        </div>
      </AdaptiveModal>
    </WebAppShell>
  );
}
