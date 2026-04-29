"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ElementPortfolioCardWeb } from "@/components/elements/ElementPortfolioCardWeb";
import { ControlPill } from "@/components/ui/ControlPill";
import {
  PORTFOLIO_LAYOUT_LABELS,
  cyclePortfolioLayout,
  type PortfolioLayoutMode,
} from "@/lib/portfolioLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  COSPLAY_OVERALL_BUCKETS,
} from "@kyarafit/design-system/types";
import {
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
  nodeMatchesSubstate,
  nodeSearchText,
  type CosplayExplorerItem,
} from "@kyarafit/design-system/domain";
import type { CosplayNodeType } from "@kyarafit/design-system/types";

type CosplayNodeId = Id<"cosplayNodes">;
type SortBy = "name" | "category" | "cost" | "progress" | "bucket";
type SortOrder = "asc" | "desc";

/** Shared filter control styles — avoid hardcoded bg-white (breaks dark mode contrast). */
const FILTER_SELECT_CLASS =
  "min-h-[44px] w-full min-w-0 rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-2 text-xs uppercase tracking-wider text-kyar-text sm:w-auto sm:min-w-[10.5rem]";

const SORT_LABELS: Record<SortBy, string> = {
  name: "Name",
  category: "Category",
  cost: "Cost",
  progress: "Progress",
  bucket: "Stage",
};

const ELEMENT_SORT_MOBILE_CYCLE: Array<"name" | "progress" | "bucket"> = [
  "name",
  "progress",
  "bucket",
];

function portfolioGridClass(layout: PortfolioLayoutMode): string {
  switch (layout) {
    case "comfortable":
      return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    case "compact":
      return "grid w-full max-w-3xl grid-cols-1 gap-3 mx-auto";
    case "grid":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
    default:
      return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }
}

const SUBSTATE_OPTIONS = [
  { value: "", label: "All states" },
  { value: "to_buy", label: "To buy" },
  { value: "bought", label: "Bought" },
  { value: "wip", label: "In progress" },
  { value: "built", label: "Built" },
  { value: "in_use", label: "In use" },
  { value: "complete", label: "Complete" },
] as const;

export default function ElementsPage() {
  const { userId } = useCurrentUser();
  const { open } = useCreationModals();
  const removeMany = useMutation(api.cosplayNodes.removeMany);
  const addNodesToBuild = useMutation(api.builds.addNodesToBuild);
  const removeNodesFromBuild = useMutation(api.builds.removeNodesFromBuild);

  const [search, setSearch] = useState("");
  const [nodeType, setNodeType] = useState<string>("");
  const [category, setCategory] = useState("");
  const [bucket, setBucket] = useState("");
  const [substate, setSubstate] = useState("");
  const [hierarchyMode, setHierarchyMode] = useState<"all" | "hasChildren" | "hasIncomplete">(
    "all"
  );
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [layout, setLayout] = useState<PortfolioLayoutMode>("comfortable");
  const [viewMode, setViewMode] = useState<"all" | "tree">("all");
  const [selectedIds, setSelectedIds] = useState<Set<CosplayNodeId>>(new Set());
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showUnassignPanel, setShowUnassignPanel] = useState(false);

  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const nodes = (useQuery(
    api.cosplayNodes.list,
    userId
      ? {
          userId,
          nodeType: nodeType || undefined,
          category: category || undefined,
          overallBucket: bucket || undefined,
          sortBy,
          order,
          rootsOnly: viewMode === "tree",
        }
      : "skip"
  ) ?? []) as Array<CosplayExplorerItem & { _id: CosplayNodeId }>;

  const filtered = useMemo(() => {
    let rows = [...nodes];
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((node) => nodeSearchText(node).includes(query));
    }
    if (substate) {
      rows = rows.filter((node) => nodeMatchesSubstate(node, substate));
    }
    if (hierarchyMode === "hasChildren") {
      rows = rows.filter((node) => (node.childCount ?? 0) > 0);
    } else if (hierarchyMode === "hasIncomplete") {
      rows = rows.filter((node) => node.hasIncompleteDescendants);
    }
    return rows;
  }, [nodes, search, substate, hierarchyMode]);

  const toggleSelected = (id: CosplayNodeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const viewModeLabel = viewMode === "all" ? "All elements" : "Grouped view";
  const typeSummary = nodeType ? formatNodeTypeLabel(nodeType as CosplayNodeType) : null;
  const bucketSummary = bucket ? formatOverallBucket(bucket) : null;
  const categorySummary = category || null;
  const layoutLabel = PORTFOLIO_LAYOUT_LABELS[layout];
  const controlsSummary = [
    viewModeLabel,
    typeSummary,
    bucketSummary,
    categorySummary,
    SORT_LABELS[sortBy],
    order === "asc" ? "Ascending" : "Descending",
    layoutLabel,
  ]
    .filter((p): p is string => Boolean(p))
    .join(" · ");

  const cycleElementSort = useCallback(() => {
    setSortBy((prev) => {
      const current = ELEMENT_SORT_MOBILE_CYCLE.includes(
        prev as (typeof ELEMENT_SORT_MOBILE_CYCLE)[number]
      )
        ? (prev as (typeof ELEMENT_SORT_MOBILE_CYCLE)[number])
        : "name";
      const i = ELEMENT_SORT_MOBILE_CYCLE.indexOf(current);
      return ELEMENT_SORT_MOBILE_CYCLE[(i + 1) % ELEMENT_SORT_MOBILE_CYCLE.length]!;
    });
  }, []);

  const cycleLayout = useCallback(() => {
    setLayout((prev) => cyclePortfolioLayout(prev));
  }, []);

  const handleBulkDelete = async () => {
    if (!userId || selectedIds.size === 0) return;
    await removeMany({ userId, ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
  };

  const handleAssign = async (buildId: Id<"builds">) => {
    if (!userId || selectedIds.size === 0) return;
    await addNodesToBuild({ userId, buildId, cosplayNodeIds: Array.from(selectedIds) });
    setShowAssignPanel(false);
    setSelectedIds(new Set());
  };

  const handleUnassign = async (buildId: Id<"builds">) => {
    if (!userId || selectedIds.size === 0) return;
    await removeNodesFromBuild({ userId, buildId, cosplayNodeIds: Array.from(selectedIds) });
    setShowUnassignPanel(false);
    setSelectedIds(new Set());
  };

  return (
    <WebAppShell>
      <PageHeader
        title="Elements"
        subtitle={
          filtered.length > 0 ? `${filtered.length} elements in your build plan` : undefined
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search elements, materials, tags, or notes…",
          "aria-label": "Search elements and materials",
        }}
        mobileControlsLabel="Refine elements"
        mobileControlsSummary={controlsSummary}
        trailing={
          <>
            <button
              type="button"
              onClick={() => open("newCloset")}
              className="hidden sm:inline-flex min-h-[44px] items-center rounded-full border border-kyar-text bg-kyar-text px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-bg transition-colors hover:bg-kyar-textSecondary"
            >
              New element
            </button>
            <Link
              href="/elements/new"
              className="hidden sm:flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:border-kyar-text hover:bg-kyar-muted"
            >
              More details
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-5 sm:hidden">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-kyar-meta">View</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <ElementsFilterChip
                active={viewMode === "all"}
                label="All elements"
                onClick={() => setViewMode("all")}
              />
              <ElementsFilterChip
                active={viewMode === "tree"}
                label="Grouped view"
                onClick={() => setViewMode("tree")}
              />
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-kyar-meta">
              Sort &amp; view
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <ControlPill
                label={SORT_LABELS[sortBy]}
                onClick={cycleElementSort}
                aria-label="Change sort"
              />
              <ControlPill
                label={order === "asc" ? "Ascending" : "Descending"}
                onClick={() => setOrder((current) => (current === "asc" ? "desc" : "asc"))}
                aria-label="Toggle sort order"
              />
              <ControlPill
                label={layoutLabel}
                onClick={cycleLayout}
                aria-label="Change card layout"
              />
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-kyar-meta">Type</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <ElementsFilterChip
                active={nodeType === ""}
                label="All types"
                onClick={() => setNodeType("")}
              />
              {COSPLAY_NODE_TYPES.map((value) => (
                <ElementsFilterChip
                  key={value}
                  active={nodeType === value}
                  label={formatNodeTypeLabel(value)}
                  onClick={() => setNodeType(value)}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-kyar-meta">Stage</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <ElementsFilterChip
                active={bucket === ""}
                label="All stages"
                onClick={() => setBucket("")}
              />
              {COSPLAY_OVERALL_BUCKETS.map((value) => (
                <ElementsFilterChip
                  key={value}
                  active={bucket === value}
                  label={formatOverallBucket(value)}
                  onClick={() => setBucket(value)}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-kyar-meta">Category</span>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <ElementsFilterChip
                active={category === ""}
                label="All categories"
                onClick={() => setCategory("")}
              />
              {COSPLAY_CATEGORIES.map((value) => (
                <ElementsFilterChip
                  key={value}
                  active={category === value}
                  label={value}
                  onClick={() => setCategory(value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="hidden w-full grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <select
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by element type"
          >
            <option value="">All types</option>
            {COSPLAY_NODE_TYPES.map((value) => (
              <option key={value} value={value}>
                {formatNodeTypeLabel(value)}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {COSPLAY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by progress stage"
          >
            <option value="">All stages</option>
            {COSPLAY_OVERALL_BUCKETS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={substate}
            onChange={(e) => setSubstate(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by substate"
          >
            {SUBSTATE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={hierarchyMode}
            onChange={(e) => setHierarchyMode(e.target.value as typeof hierarchyMode)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by hierarchy state"
          >
            <option value="all">All groups</option>
            <option value="hasChildren">Has sub-elements</option>
            <option value="hasIncomplete">Has unfinished sub-elements</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={FILTER_SELECT_CLASS}
            aria-label="Sort elements by"
          >
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="cost">Cost</option>
            <option value="progress">Progress</option>
            <option value="bucket">Stage</option>
          </select>
          <button
            type="button"
            onClick={() => setOrder((current) => (current === "asc" ? "desc" : "asc"))}
            className={`${FILTER_SELECT_CLASS} inline-flex items-center justify-between sm:justify-center`}
          >
            {order === "asc" ? "Asc" : "Desc"}
          </button>
          <ControlPill label={layoutLabel} onClick={cycleLayout} aria-label="Change card layout" />
        </div>
      </PageHeader>

      <main className="flex-1 pt-3 pb-24 sm:py-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon="account_tree"
            message="No elements match this view yet."
            secondary="Create elements and materials, then group them in a way that matches your build."
          />
        ) : (
          <>
            <div className="mb-3 sm:mb-4 flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                {filtered.length} element{filtered.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(filtered.map((node) => node._id)))}
                className="text-[10px] uppercase tracking-widest underline"
              >
                Select all visible
              </button>
            </div>
            <div className={portfolioGridClass(layout)}>
              {filtered.map((item) => {
                const pct = item.progressPercent ?? 0;
                const childrenN = item.childCount ?? 0;
                const progressLabel = `${pct}% progress`.toUpperCase();
                const childrenLabel =
                  `${childrenN} ${childrenN === 1 ? "CHILD" : "CHILDREN"}`.toUpperCase();
                return (
                  <div key={item._id} className="group relative">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item._id)}
                      onChange={() => toggleSelected(item._id)}
                      className={`absolute z-20 rounded-full border border-kyar-borderSubtle bg-kyar-bg/80 shadow-sm ${
                        layout === "compact" ? "right-2 top-2 h-5 w-5" : "right-3 top-3 h-5 w-5"
                      }`}
                      aria-label={`Select ${item.name}`}
                    />
                    <Link
                      href={`/elements/${item._id}`}
                      className="block overflow-hidden rounded-3xl transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      <ElementPortfolioCardWeb
                        variant={layout}
                        item={{
                          name: item.name,
                          category: item.category,
                          imageStorageId: item.imageStorageId as Id<"_storage"> | null,
                          imageUrl: item.imageUrl,
                          nodeType: item.nodeType,
                          progressPercent: pct,
                          childCount: childrenN,
                          typeBadge: formatNodeTypeLabel(item.nodeType),
                          statusBadge: formatNodeStatus(item),
                        }}
                        progressLabel={progressLabel}
                        childrenLabel={childrenLabel}
                      />
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {selectedCount > 0 && (
        <div className="fixed bottom-20 left-1/2 z-40 flex w-[90%] max-w-4xl -translate-x-1/2 flex-wrap items-center justify-between gap-4 rounded-full border border-kyar-borderSubtle bg-kyar-surface px-6 py-4 shadow-lg">
          <span className="text-sm font-bold">{selectedCount} selected</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAssignPanel(true)}
              className="rounded-full border border-kyar-text px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-kyar-text hover:bg-kyar-text hover:text-kyar-bg transition-colors"
            >
              Link to build
            </button>
            <button
              type="button"
              onClick={() => setShowUnassignPanel(true)}
              className="rounded-full border border-kyar-borderSubtle px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-kyar-text"
            >
              Unlink from build
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="rounded-full border border-kyar-danger px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-kyar-danger"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <ResponsivePanel
        open={showAssignPanel}
        onClose={() => setShowAssignPanel(false)}
        title="Link to build"
      >
        <div className="space-y-2">
          {builds.map((build) => (
            <button
              key={build._id}
              type="button"
              onClick={() => handleAssign(build._id)}
              className="flex w-full items-center justify-between gap-3 border border-kyar-border p-3 text-left"
            >
              <span className="truncate text-sm font-medium">{build.name}</span>
              <span className="text-[10px] uppercase tracking-wider">Add</span>
            </button>
          ))}
        </div>
      </ResponsivePanel>

      <ResponsivePanel
        open={showUnassignPanel}
        onClose={() => setShowUnassignPanel(false)}
        title="Unlink from build"
      >
        <div className="space-y-2">
          {builds.map((build) => (
            <button
              key={build._id}
              type="button"
              onClick={() => handleUnassign(build._id)}
              className="flex w-full items-center justify-between gap-3 border border-kyar-border p-3 text-left"
            >
              <span className="truncate text-sm font-medium">{build.name}</span>
              <span className="text-[10px] uppercase tracking-wider">Remove</span>
            </button>
          ))}
        </div>
      </ResponsivePanel>
    </WebAppShell>
  );
}

function ElementsFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[38px] shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active
          ? "border-kyar-text bg-kyar-text text-kyar-bg"
          : "border-kyar-borderSubtle bg-kyar-surface text-kyar-text hover:border-kyar-text"
      }`}
    >
      {label}
    </button>
  );
}
