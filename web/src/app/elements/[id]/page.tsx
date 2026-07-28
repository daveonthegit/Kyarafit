"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  COSPLAY_PRICING_MODES,
  ELEMENT_BUILD_STATUSES,
  ELEMENT_PURCHASE_STATUSES,
  MATERIAL_STATUSES,
  type CosplayPricingMode,
} from "@kyarafit/design-system/types";
import {
  formatCents,
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
  statusChipInfo,
} from "@kyarafit/design-system/domain";
import {
  WORKFLOW_STATUS_OPTIONS,
  plannerWorkflowRowClassName,
  PlannerWorkflowCheckbox,
  PlannerWorkflowMetaLine,
  PlannerWorkflowMetaMuted,
  PlannerWorkflowMetaText,
  PlannerWorkflowTaskTitle,
} from "@/components/planner/PlannerWorkflowTaskUi";

type CosplayNodeId = Id<"cosplayNodes">;
type NodeKind = "element" | "material";
type WorkbenchTab = "overview" | "parts" | "usage" | "tasks" | "activity";

type WorkflowNode = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowNode[];
};

function flattenWorkflow(nodes: WorkflowNode[], depth = 0): (WorkflowNode & { depth: number })[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenWorkflow(node.children, depth + 1),
  ]);
}

function dollarsFromCents(cents: number | undefined | null) {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
}

function parseDollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function formatDate(ms: number | undefined) {
  if (!ms) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
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

  const node = useOfflineQuery(api.cosplayNodes.get, id ? { id } : "skip");
  const allNodes = (useOfflineQuery(api.cosplayNodes.list, userId ? { userId } : "skip") ?? []) as {
    _id: CosplayNodeId;
    name: string;
    nodeType: NodeKind;
  }[];
  const buildsUsing =
    useOfflineQuery(api.builds.getBuildsUsingNode, id ? { cosplayNodeId: id } : "skip") ?? [];
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const updateNode = useOfflineMutation(api.cosplayNodes.update);
  const removeNode = useOfflineMutation(api.cosplayNodes.remove);
  const convertType = useOfflineMutation(api.cosplayNodes.convertType);
  const addNodesToBuild = useOfflineMutation(api.builds.addNodesToBuild);
  const removeNodeFromBuild = useOfflineMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useOfflineMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useOfflineMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useOfflineMutation(api.cosplayNodes.reorderChildren);
  const createTask = useOfflineMutation(api.workflow.create);
  const updateTask = useOfflineMutation(api.workflow.update);
  const deleteTask = useOfflineMutation(api.workflow.remove);

  const [activeTab, setActiveTab] = useState<WorkbenchTab>("overview");
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showChildPanel, setShowChildPanel] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workflowView, setWorkflowView] = useState<"shared" | "build_specific">("shared");
  const [selectedWorkflowBuildId, setSelectedWorkflowBuildId] = useState<Id<"builds"> | "">("");
  const workflow =
    useOfflineQuery(
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

  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [structureQuery, setStructureQuery] = useState("");
  const [partFilter, setPartFilter] = useState<"all" | "needs_work" | "complete">("all");
  const [usageQuery, setUsageQuery] = useState("");
  const [taskQuery, setTaskQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("all");
  const [existingChildId, setExistingChildId] = useState("");
  const [newChildType, setNewChildType] = useState<NodeKind>("element");

  const [form, setForm] = useState({
    name: "",
    notes: "",
    tagsRaw: "",
    category: "" as "" | (typeof COSPLAY_CATEGORIES)[number],
    pricingMode: "total" as CosplayPricingMode,
    directCostDollars: "",
    unitCostDollars: "",
    quantity: "",
    unit: "",
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
      tagsRaw: node.tags?.length ? node.tags.join(", ") : "",
      category: (node.category as typeof form.category) ?? "",
      pricingMode: ((node.pricingMode as CosplayPricingMode | undefined) ??
        "total") as CosplayPricingMode,
      directCostDollars: dollarsFromCents(node.directCostCents),
      unitCostDollars: dollarsFromCents(node.unitCostCents),
      quantity: node.quantity != null ? String(node.quantity) : "",
      unit: node.unit ?? "",
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
      setNewChildType("material");
    }
  }, [node, newChildType]);

  if (node === undefined) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Loading...
          </p>
        </div>
      </WebAppShell>
    );
  }

  if (!node) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Item not found.
          </p>
          <Link href="/elements" className="mt-4 inline-block text-sm underline">
            Back to Elements
          </Link>
        </div>
      </WebAppShell>
    );
  }

  const progressPercent = Math.max(0, Math.min(100, node.progressPercent ?? 0));
  const statusLabel = formatNodeStatus(node as Parameters<typeof formatNodeStatus>[0]);
  const directCost = node.directCostCents ?? 0;
  const rollupCost = node.totalCostCents ?? directCost;
  const statusTone = statusChipInfo(node as Parameters<typeof statusChipInfo>[0]).tone;
  const nodeTypeLabel = formatNodeTypeLabel(node.nodeType as NodeKind);
  const workflowSource =
    workflowView === "shared" ? (workflow?.shared ?? []) : (workflow?.buildSpecific ?? []);
  const workflowRows = flattenWorkflow(workflowSource as WorkflowNode[]);
  const visibleWorkflowRows = workflowRows.filter((task) => {
    const matchesQuery =
      !taskQuery.trim() || task.title.toLowerCase().includes(taskQuery.toLowerCase());
    const isDone = task.status === "done";
    const matchesFilter = taskFilter === "all" || (taskFilter === "open" ? !isDone : isDone);
    return matchesQuery && matchesFilter;
  });
  const workflowDoneCount = workflowRows.filter((task) => task.status === "done").length;
  const nextTask = workflowRows.find((task) => task.status !== "done");

  const structureNeedle = structureQuery.trim().toLowerCase();
  const filteredParents = (node.parents ?? []).filter((parent) =>
    !structureNeedle
      ? true
      : `${parent.name} ${parent.nodeType}`.toLowerCase().includes(structureNeedle)
  );
  const filteredChildren = (node.children ?? []).filter((child) => {
    const matchesQuery =
      !structureNeedle ||
      `${child.name} ${child.nodeType} ${child.category ?? ""} ${formatNodeStatus(
        child as Parameters<typeof formatNodeStatus>[0]
      )}`
        .toLowerCase()
        .includes(structureNeedle);
    const isComplete = child.overallBucket === "complete";
    const matchesFilter =
      partFilter === "all" || (partFilter === "complete" ? isComplete : !isComplete);
    return matchesQuery && matchesFilter;
  });
  const filteredBuildsUsing = buildsUsing.filter((build) =>
    !usageQuery.trim()
      ? true
      : `${build.name} ${build.character ?? ""}`.toLowerCase().includes(usageQuery.toLowerCase())
  );

  const childCandidates = allNodes.filter(
    (candidate) =>
      candidate._id !== id && isAllowedChildLink(node.nodeType as NodeKind, candidate.nodeType)
  );
  const availableChildTypes = COSPLAY_NODE_TYPES.filter((value) =>
    isAllowedChildLink(node.nodeType as NodeKind, value)
  );

  const activityItems = [
    {
      label: "Live",
      title: `${progressPercent}% progress tracked`,
      detail: statusLabel,
    },
    {
      label: "Reference",
      title:
        node.imageStorageId || node.imageUrl ? "Reference image is set" : "Reference image needed",
      detail: "Use this as the visual guide while planning parts and tasks.",
    },
    {
      label: "Parts",
      title: `${node.children.length} parts or materials linked`,
      detail: node.hasIncompleteDescendants
        ? "Some linked work still needs attention."
        : "No incomplete linked work flagged.",
    },
    {
      label: "Used in",
      title: `Used in ${buildsUsing.length} build${buildsUsing.length === 1 ? "" : "s"}`,
      detail:
        buildsUsing.length > 0
          ? buildsUsing
              .map((build) => build.name)
              .slice(0, 3)
              .join(", ")
          : "Not linked to a build yet.",
    },
    {
      label: "Tasks",
      title: `${workflowDoneCount} of ${workflowRows.length} tasks complete`,
      detail: nextTask ? `Next: ${nextTask.title}` : "No open task in the selected view.",
    },
    {
      label: formatDate(node._creationTime),
      title: "Item record created",
      detail: node.category || nodeTypeLabel,
    },
  ];

  const save = async () => {
    if (!userId) return;
    const directCostCents =
      form.pricingMode === "total" ? parseDollarsToCents(form.directCostDollars) : null;
    const unitCostCents =
      form.pricingMode === "per_unit" ? parseDollarsToCents(form.unitCostDollars) : null;
    const quantityParsed = form.quantity.trim()
      ? Number.parseFloat(form.quantity.replace(",", "."))
      : null;
    const tags = form.tagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await updateNode({
      id,
      userId,
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      tags,
      category: form.category || null,
      pricingMode: form.pricingMode,
      directCostCents,
      unitCostCents,
      quantity:
        form.pricingMode === "per_unit" && quantityParsed != null && !Number.isNaN(quantityParsed)
          ? quantityParsed
          : null,
      unit: form.pricingMode === "per_unit" && form.unit.trim() ? form.unit.trim() : null,
      imageUrl: form.imageStorageId ? null : form.imageUrl || null,
      imageStorageId: form.imageStorageId,
      purchaseStatus: node.nodeType === "element" ? form.purchaseStatus : null,
      buildStatus: node.nodeType === "element" ? form.buildStatus : null,
      materialStatus: node.nodeType === "material" ? form.materialStatus : null,
    });
    setShowEditPanel(false);
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
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={node.imageStorageId}
          imageUrl={node.imageUrl}
          scrimRight="strong"
        />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href="/elements"
            aria-label="Back to elements"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            Elements ▸ {node.name}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!userId}
              onClick={() =>
                convertType({
                  id,
                  userId: userId!,
                  nodeType: node.nodeType === "element" ? "material" : "element",
                })
              }
              className="hidden min-h-[44px] items-center px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 transition-colors hover:text-kyar-media-fg disabled:opacity-40 sm:inline-flex"
            >
              Convert
            </button>
            <button
              type="button"
              onClick={() => setShowEditPanel(true)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              aria-label="Edit details"
            >
              <span className="material-symbols-outlined font-light text-[22px]">edit</span>
            </button>
          </div>
        </div>

        <main className="relative z-10 mx-auto mb-10 mt-4 w-full max-w-[1600px] flex-1 px-4 sm:px-6 lg:px-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(440px,520px)]">
          {/* Identity on the photo, left (6b/8b grammar) */}
          <div className="max-w-[720px] pt-2 lg:pt-10">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em] opacity-75">
              {nodeTypeLabel}
              {node.category ? ` · ${node.category}` : ""}
            </p>
            <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] sm:text-[56px] lg:text-[72px]">
              {node.name}
            </h1>

            <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                  Kind
                </dt>
                <dd className="text-[15px]">{node.category?.trim() || nodeTypeLabel}</dd>
              </div>
              {buildsUsing.length > 0 && (
                <div>
                  <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                    Build
                  </dt>
                  <dd className="truncate text-[15px]">
                    {buildsUsing[0]!.name}
                    {buildsUsing.length > 1 ? ` +${buildsUsing.length - 1}` : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                  Direct cost
                </dt>
                <dd className="text-[15px] tabular-nums">{formatCents(directCost)}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur-glass-chip ${
                  statusTone === "success"
                    ? "bg-on-glass-chip-done-bg text-on-glass-chip-done-fg"
                    : statusTone === "active"
                      ? "bg-on-glass-chip-active-bg text-on-glass-chip-active-fg"
                      : statusTone === "warning"
                        ? "bg-on-glass-chip-warn-bg text-on-glass-chip-warn-fg"
                        : "bg-on-glass-chip-neutral-bg text-on-glass-chip-neutral-fg"
                }`}
              >
                {statusLabel}
              </span>
              {node.notes ? (
                <span className="max-w-[420px] truncate text-[13px] text-media-fg-70">
                  {node.notes.split("\n")[0]}
                </span>
              ) : (
                <span className="text-[13px] text-media-fg-55">
                  {progressPercent}% · {formatOverallBucket(node.overallBucket)}
                </span>
              )}
            </div>
          </div>

          {/* The ONE glass work panel, anchored right */}
          <section className="flex min-h-0 flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass lg:max-h-[calc(100vh-180px)]">
            <nav
              className="flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-4 border-b border-glass-divider-strong overflow-x-auto"
              aria-label="Element workbench sections"
            >
              {(
                [
                  { id: "overview", label: "Overview" },
                  {
                    id: "parts",
                    label: "Parts & materials",
                    count: node.parents.length + node.children.length,
                  },
                  { id: "usage", label: "Used in", count: buildsUsing.length },
                  { id: "tasks", label: "Tasks", count: workflowRows.length },
                  { id: "activity", label: "Activity", count: activityItems.length },
                ] as { id: WorkbenchTab; label: string; count?: number }[]
              ).map((tab) => (
                <TabButton
                  key={tab.id}
                  active={activeTab === tab.id}
                  label={tab.label}
                  count={tab.count}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">

          {activeTab === "overview" ? (
            <div className="grid gap-8">
              <WorkbenchSection eyebrow="Overview" title="What to know now">
                <div className="space-y-3">
                  <InfoRow
                    label="Next task"
                    value={nextTask?.title ?? "No open tasks yet"}
                    onClick={() => setActiveTab("tasks")}
                  />
                  <InfoRow
                    label="Where this is used"
                    value={`Used in ${buildsUsing.length} build${buildsUsing.length === 1 ? "" : "s"}`}
                    onClick={() => setActiveTab("usage")}
                  />
                  <InfoRow
                    label="Made from"
                    value={`${node.children.length} parts or materials linked`}
                    onClick={() => setActiveTab("parts")}
                  />
                </div>
              </WorkbenchSection>

              <WorkbenchSection eyebrow="Status" title="Progress controls">
                {node.nodeType === "element" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatusSelect
                      label="Purchase"
                      value={form.purchaseStatus}
                      options={ELEMENT_PURCHASE_STATUSES}
                      onChange={(value) => {
                        setForm((prev) => ({ ...prev, purchaseStatus: value }));
                        if (userId) void updateNode({ id, userId, purchaseStatus: value });
                      }}
                    />
                    <StatusSelect
                      label="Build"
                      value={form.buildStatus}
                      options={ELEMENT_BUILD_STATUSES}
                      onChange={(value) => {
                        setForm((prev) => ({ ...prev, buildStatus: value }));
                        if (userId) void updateNode({ id, userId, buildStatus: value });
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, materialStatus: status }));
                          if (userId) void updateNode({ id, userId, materialStatus: status });
                        }}
                        className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-widest ${
                          form.materialStatus === status
                            ? "border-transparent bg-glass-solid text-glass-ink"
                            : "border-glass-border-strong text-media-fg-70 hover:bg-glass-active"
                        }`}
                      >
                        {status.split("_").join(" ")}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!userId}
                    onClick={() =>
                      convertType({
                        id,
                        userId: userId!,
                        nodeType: node.nodeType === "element" ? "material" : "element",
                      })
                    }
                    className="min-h-[40px] rounded-full border border-glass-border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors disabled:opacity-40"
                  >
                    Convert type
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    className="min-h-[40px] rounded-full border border-on-glass-danger px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger hover:bg-on-glass-danger/10 transition-colors"
                  >
                    Delete item
                  </button>
                </div>
              </WorkbenchSection>
            </div>
          ) : null}

          {activeTab === "parts" ? (
            <WorkbenchSection
              eyebrow="Parts & materials"
              title="What this is made from"
              action={
                <button
                  type="button"
                  onClick={() => setShowChildPanel(true)}
                  className="min-h-[40px] rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
                >
                  Add part
                </button>
              }
            >
              <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  type="search"
                  value={structureQuery}
                  onChange={(event) => setStructureQuery(event.target.value)}
                  placeholder="Search parts, materials, or parent pieces..."
                  className="glass-field min-h-[46px] w-full px-4 text-sm"
                />
                <select
                  value={partFilter}
                  onChange={(event) => setPartFilter(event.target.value as typeof partFilter)}
                  className="glass-field min-h-[46px] px-4 text-sm"
                >
                  <option value="all">All parts</option>
                  <option value="needs_work">Needs work</option>
                  <option value="complete">Complete</option>
                </select>
              </div>

              {filteredParents.length > 0 ? (
                <div className="mb-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                    This is part of
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredParents.map((parent) => (
                      <LinkCard
                        key={parent._id}
                        href={`/elements/${parent._id}`}
                        title={parent.name}
                        meta={formatNodeTypeLabel(parent.nodeType as NodeKind)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                Made from
              </p>
              {filteredChildren.length === 0 ? (
                <EmptyLine>
                  {node.children.length === 0
                    ? "No parts or materials yet."
                    : "No parts match your search."}
                </EmptyLine>
              ) : (
                <div className="divide-y divide-glass-divider overflow-hidden rounded-[10px] border border-glass-border">
                  {filteredChildren.map((child) => {
                    const index = node.children.findIndex((entry) => entry._id === child._id);
                    return (
                      <div
                        key={child._id}
                        className="flex flex-col gap-3 px-4 py-4 hover:bg-glass-active transition-colors md:flex-row md:items-center md:justify-between"
                      >
                        <Link href={`/elements/${child._id}`} className="min-w-0 flex-1">
                          <p className="truncate font-serif text-[17px] italic">
                            {child.name}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                            {formatNodeTypeLabel(child.nodeType as NodeKind)} ·{" "}
                            {formatNodeStatus(child as Parameters<typeof formatNodeStatus>[0])}
                          </p>
                          <p className="mt-2 text-sm text-media-fg-70">
                            {child.progressPercent}% progress · {child.childCount} nested
                            {child.hasIncompleteDescendants ? " · linked work remains" : ""}
                          </p>
                        </Link>
                        <div className="flex flex-wrap gap-2">
                          {userId && index > 0 ? (
                            <SmallButton onClick={() => void moveChild(index, index - 1)}>
                              Up
                            </SmallButton>
                          ) : null}
                          {userId && index < node.children.length - 1 ? (
                            <SmallButton onClick={() => void moveChild(index, index + 1)}>
                              Down
                            </SmallButton>
                          ) : null}
                          {userId ? (
                            <SmallButton
                              tone="danger"
                              onClick={() => void removeChildLink({ id: child.linkId, userId })}
                            >
                              Remove link
                            </SmallButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </WorkbenchSection>
          ) : null}

          {activeTab === "usage" ? (
            <WorkbenchSection
              eyebrow="Used in"
              title="Where this belongs"
              action={
                <button
                  type="button"
                  onClick={() => setShowBuildPanel(true)}
                  className="min-h-[40px] rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
                >
                  Link build
                </button>
              }
            >
              <input
                type="search"
                value={usageQuery}
                onChange={(event) => setUsageQuery(event.target.value)}
                placeholder="Search linked builds..."
                className="mb-5 glass-field min-h-[46px] w-full px-4 text-sm"
              />
              {filteredBuildsUsing.length === 0 ? (
                <EmptyLine>
                  {buildsUsing.length === 0
                    ? "Not linked to any builds yet."
                    : "No linked builds match your search."}
                </EmptyLine>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredBuildsUsing.map((build) => (
                    <div
                      key={build._id}
                      className="rounded-[10px] border border-glass-border bg-glass-active p-4"
                    >
                      <Link href={`/build-detail/${build._id}`} className="block min-w-0">
                        <p className="truncate font-serif text-[17px] italic">
                          {build.name}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                          {build.character || "Build"}
                        </p>
                        <p className="mt-3 text-sm text-media-fg-70">
                          Changes here can be reused across this linked build.
                        </p>
                      </Link>
                      {userId ? (
                        <button
                          type="button"
                          onClick={() =>
                            void removeNodeFromBuild({
                              userId,
                              buildId: build._id,
                              cosplayNodeId: id,
                            })
                          }
                          className="mt-4 min-h-[40px] rounded-full border border-glass-border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors"
                        >
                          Remove link
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </WorkbenchSection>
          ) : null}

          {activeTab === "tasks" ? (
            <WorkbenchSection eyebrow="Tasks" title="Work to do">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <TabButton
                  active={workflowView === "shared"}
                  label="Shared"
                  onClick={() => setWorkflowView("shared")}
                />
                <TabButton
                  active={workflowView === "build_specific"}
                  label="Build specific"
                  onClick={() => setWorkflowView("build_specific")}
                />
                {workflowView === "build_specific" ? (
                  <select
                    value={selectedWorkflowBuildId}
                    onChange={(event) =>
                      setSelectedWorkflowBuildId(event.target.value as Id<"builds"> | "")
                    }
                    className="glass-field min-h-[44px] px-4 text-sm"
                  >
                    <option value="">Choose a build</option>
                    {buildsUsing.map((build) => (
                      <option key={build._id} value={build._id}>
                        {build.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                <input
                  type="search"
                  value={taskQuery}
                  onChange={(event) => setTaskQuery(event.target.value)}
                  placeholder="Search tasks..."
                  className="glass-field min-h-[46px] w-full px-4 text-sm"
                />
                <select
                  value={taskFilter}
                  onChange={(event) => setTaskFilter(event.target.value as typeof taskFilter)}
                  className="glass-field min-h-[46px] px-4 text-sm"
                >
                  <option value="all">All tasks</option>
                  <option value="open">Open only</option>
                  <option value="done">Done only</option>
                </select>
              </div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                {visibleWorkflowRows.length} item{visibleWorkflowRows.length === 1 ? "" : "s"} ·{" "}
                {visibleWorkflowRows.filter((task) => task.status === "done").length} complete
              </p>
              {visibleWorkflowRows.length === 0 ? (
                <EmptyLine>
                  {workflowView === "build_specific" && !selectedWorkflowBuildId
                    ? "Choose a build to view build-specific tasks."
                    : "No tasks match this view."}
                </EmptyLine>
              ) : (
                <div className="space-y-2 rounded-[10px] border border-glass-border p-2">
                  {visibleWorkflowRows.map((task) => (
                    <div
                      key={task._id}
                      className={`${plannerWorkflowRowClassName} w-full max-w-full`}
                      style={{ marginLeft: `${task.depth * 20}px` }}
                    >
                      <PlannerWorkflowCheckbox
                        checked={task.status === "done"}
                        disabled={!userId}
                        onCheckedChange={(next) => {
                          if (!userId) return;
                          void updateTask({
                            id: task._id,
                            userId,
                            status: next ? "done" : "not_started",
                          });
                        }}
                        ariaLabel={`Mark "${task.title}" as ${
                          task.status === "done" ? "incomplete" : "complete"
                        }`}
                      />
                      <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
                        <PlannerWorkflowTaskTitle done={task.status === "done"}>
                          {task.title}
                        </PlannerWorkflowTaskTitle>
                        <PlannerWorkflowMetaLine>
                          <PlannerWorkflowMetaText>{task.kind}</PlannerWorkflowMetaText>
                          <PlannerWorkflowMetaText>
                            {task.status.split("_").join(" ")}
                          </PlannerWorkflowMetaText>
                          <PlannerWorkflowMetaMuted>
                            · {task.progressPercent}%
                          </PlannerWorkflowMetaMuted>
                        </PlannerWorkflowMetaLine>
                      </div>
                      {userId ? (
                        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
                          <select
                            value={task.status}
                            onChange={(event) =>
                              void updateTask({
                                id: task._id,
                                userId,
                                status: event.target.value,
                              })
                            }
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
                            onClick={() => void deleteTask({ id: task._id, userId })}
                            className="min-h-[40px] rounded-lg border border-glass-border px-3 py-2 text-[11px] text-media-fg-55 hover:text-on-glass-danger transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-glass-divider pt-4">
                <input
                  value={newTaskLabel}
                  onChange={(event) => setNewTaskLabel(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleAddTask()}
                  placeholder={
                    workflowView === "shared"
                      ? "Add a shared task..."
                      : "Add a build-specific task..."
                  }
                  className="glass-field min-h-[44px] min-w-[12rem] flex-1 px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddTask()}
                  disabled={!userId || !newTaskLabel.trim()}
                  className="min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </WorkbenchSection>
          ) : null}

          {activeTab === "activity" ? (
            <WorkbenchSection eyebrow="Activity" title="Active tracking log">
              <div className="space-y-3">
                {activityItems.map((item) => (
                  <div
                    key={`${item.label}-${item.title}`}
                    className="rounded-[10px] border border-glass-border bg-glass-active p-4"
                  >
                    <div className="flex gap-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-kyar-media-fg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
                            {item.label}
                          </p>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-media-fg-70">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </WorkbenchSection>
          ) : null}

              {error ? <p className="mt-4 text-sm text-on-glass-danger">{error}</p> : null}
            </div>

            {/* Panel footer: rollup + the view's one primary (8b) */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-glass-divider px-5 py-3.5">
              <span className="font-explorer-mono text-[11px] text-media-fg-55">
                {node.children.length} part{node.children.length === 1 ? "" : "s"} ·{" "}
                {formatCents(rollupCost)} rollup
              </span>
              <button
                type="button"
                onClick={() => setShowChildPanel(true)}
                className="min-h-[40px] rounded-full bg-glass-solid px-5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90 transition-opacity"
              >
                + Add part
              </button>
            </div>
          </section>
        </main>

        <ResponsivePanel
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        title="Edit details"
      >
        <div className="space-y-5">
          <div className="rounded-[10px] border border-glass-border p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Reference image
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

          <Field label="Name">
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full border-0 border-b border-glass-border-strong bg-transparent py-3 text-base focus:border-kyar-media-fg focus:outline-none"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={5}
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </Field>

          <Field label="Tags">
            <input
              value={form.tagsRaw}
              onChange={(event) => setForm((prev) => ({ ...prev, tagsRaw: event.target.value }))}
              placeholder="Comma separated tags"
              className="w-full border-0 border-b border-glass-border-strong bg-transparent py-3 text-base focus:border-kyar-media-fg focus:outline-none"
            />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              <SmallButton
                active={form.category === ""}
                onClick={() => setForm((prev) => ({ ...prev, category: "" }))}
              >
                None
              </SmallButton>
              {COSPLAY_CATEGORIES.map((category) => (
                <SmallButton
                  key={category}
                  active={form.category === category}
                  onClick={() => setForm((prev) => ({ ...prev, category }))}
                >
                  {category}
                </SmallButton>
              ))}
            </div>
          </Field>

          <Field label="Cost">
            <div className="mb-3 flex gap-2">
              {COSPLAY_PRICING_MODES.map((mode) => (
                <SmallButton
                  key={mode}
                  active={form.pricingMode === mode}
                  onClick={() => setForm((prev) => ({ ...prev, pricingMode: mode }))}
                >
                  {mode === "total" ? "Total" : "Per unit"}
                </SmallButton>
              ))}
            </div>
            {form.pricingMode === "total" ? (
              <input
                type="number"
                step="0.01"
                value={form.directCostDollars}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, directCostDollars: event.target.value }))
                }
                placeholder="0.00"
                className="glass-field w-full px-4 py-3 text-sm"
              />
            ) : (
              <div className="grid gap-3">
                <input
                  type="number"
                  step="0.01"
                  value={form.unitCostDollars}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, unitCostDollars: event.target.value }))
                  }
                  placeholder="Unit cost"
                  className="glass-field w-full px-4 py-3 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  placeholder="Quantity"
                  className="glass-field w-full px-4 py-3 text-sm"
                />
                <input
                  value={form.unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                  placeholder="Unit, e.g. yd, m, item"
                  className="glass-field w-full px-4 py-3 text-sm"
                />
              </div>
            )}
          </Field>

          <Field label="Status">
            {node.nodeType === "element" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <StatusSelect
                  label="Purchase"
                  value={form.purchaseStatus}
                  options={ELEMENT_PURCHASE_STATUSES}
                  onChange={(value) => setForm((prev) => ({ ...prev, purchaseStatus: value }))}
                />
                <StatusSelect
                  label="Build"
                  value={form.buildStatus}
                  options={ELEMENT_BUILD_STATUSES}
                  onChange={(value) => setForm((prev) => ({ ...prev, buildStatus: value }))}
                />
              </div>
            ) : (
              <StatusSelect
                label="Material"
                value={form.materialStatus}
                options={MATERIAL_STATUSES}
                onChange={(value) => setForm((prev) => ({ ...prev, materialStatus: value }))}
              />
            )}
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowEditPanel(false)}
              className="flex-1 min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!userId || !form.name.trim()}
              className="flex-1 min-h-[44px] rounded-full bg-glass-solid py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </ResponsivePanel>

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
              onClick={() => {
                if (!userId) return;
                void addNodesToBuild({ userId, buildId: build._id, cosplayNodeIds: [id] }).then(
                  () => setShowBuildPanel(false)
                );
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-glass-border p-3 text-left hover:border-glass-border-strong hover:bg-glass-active transition-colors"
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
        title="Add part or material"
      >
        <div className="space-y-5">
          <div className="space-y-3 border-b border-glass-divider pb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Create new
            </p>
            <div className="flex gap-2">
              {availableChildTypes.map((value) => (
                <SmallButton
                  key={value}
                  active={newChildType === value}
                  onClick={() => setNewChildType(value)}
                >
                  {formatNodeTypeLabel(value)}
                </SmallButton>
              ))}
            </div>
            <p className="text-xs leading-5 text-media-fg-55">
              {node.nodeType === "element"
                ? "Elements can be made from elements or materials."
                : "Materials can only be made from other materials."}
            </p>
            <button
              type="button"
              onClick={openFullCreateChildFlow}
              className="min-h-[40px] rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
            >
              Open full create flow
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Use existing
            </p>
            <select
              value={existingChildId}
              onChange={(event) => setExistingChildId(event.target.value)}
              className="glass-field w-full px-3 py-3 text-sm"
            >
              <option value="">Choose an item</option>
              {childCandidates.map((candidate) => (
                <option key={candidate._id} value={candidate._id}>
                  {candidate.name} · {formatNodeTypeLabel(candidate.nodeType)}
                </option>
              ))}
            </select>
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
                  linkMode: "owned",
                })
                  .then(() => {
                    setError(null);
                    setShowChildPanel(false);
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Could not link item"));
              }}
              className="min-h-[40px] rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
            >
              Link item
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
          <h2 id="delete-node-dialog-title" className="mb-2 font-serif italic text-lg">
            Delete this item?
          </h2>
          <p className="mb-6 text-sm text-media-fg-70">
            This removes the item and its links. Remove a link instead if you only want it detached
            from a build or parent piece.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDelete(false)}
              className="flex-1 min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
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
              className="flex-1 min-h-[44px] rounded-full border border-on-glass-danger py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger hover:bg-on-glass-danger/10 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
        </AdaptiveModal>
      </div>
    </WebAppShell>
  );
}

function WorkbenchSection({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
            {eyebrow}
          </p>
          <h3 className="mt-1 font-serif text-2xl italic">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-baseline gap-1.5 text-[10px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active
          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
      }`}
    >
      <span>{label}</span>
      {count != null ? <span className="opacity-60">{count}</span> : null}
    </button>
  );
}

function InfoRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 rounded-[10px] border border-glass-border bg-glass-active p-4 text-left transition-colors hover:border-glass-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
    >
      <span>
        <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
          {label}
        </span>
        <span className="mt-1 block text-sm font-medium">{value}</span>
      </span>
      <span className="material-symbols-outlined text-base text-media-fg-55">chevron_right</span>
    </button>
  );
}

function LinkCard({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <Link
      href={href}
      className="rounded-[10px] border border-glass-border bg-glass-active p-4 transition-colors hover:border-glass-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
    >
      <p className="truncate font-serif text-[17px] italic">{title}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
        {meta}
      </p>
    </Link>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-glass-border bg-glass-active px-4 py-8 text-sm text-media-fg-55">
      {children}
    </div>
  );
}

function SmallButton({
  children,
  active,
  tone = "neutral",
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  tone?: "neutral" | "danger";
  onClick: () => void;
}) {
  const activeClass = "border-transparent bg-glass-solid text-glass-ink";
  const toneClass =
    tone === "danger"
      ? "border-on-glass-danger text-on-glass-danger hover:bg-on-glass-danger/10"
      : "border-glass-border-strong text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[40px] rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active ? activeClass : toneClass
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value | string;
  options: readonly Value[];
  onChange: (value: Value) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        className="glass-field min-h-[44px] w-full px-4 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.split("_").join(" ")}
          </option>
        ))}
      </select>
    </label>
  );
}
