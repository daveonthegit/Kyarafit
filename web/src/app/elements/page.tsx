"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
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

type CosplayNodeId = Id<"cosplayNodes">;
type SortBy = "name" | "category" | "cost" | "progress" | "bucket";
type SortOrder = "asc" | "desc";

/** Shared filter control styles — glass-outline fields on the studio wall. */
const FILTER_SELECT_CLASS =
  "glass-field min-h-[44px] w-full min-w-0 px-4 py-2 text-xs uppercase tracking-[0.14em] sm:w-auto sm:min-w-[10.5rem]";

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
      return "grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5";
    case "compact":
      return "grid w-full max-w-3xl grid-cols-1 gap-3";
    case "grid":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
    default:
      return "grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5";
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
  const { userId, isLoading: authLoading } = useCurrentUser();
  const { open } = useCreationModals();
  const removeMany = useOfflineMutation(api.cosplayNodes.removeMany);
  const addNodesToBuild = useOfflineMutation(api.builds.addNodesToBuild);
  const removeNodesFromBuild = useOfflineMutation(api.builds.removeNodesFromBuild);

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

  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const nodesQuery = useOfflineQuery(
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
  );
  const nodes = (nodesQuery ?? []) as Array<CosplayExplorerItem & { _id: CosplayNodeId }>;
  const isLoading = authLoading || (userId !== null && nodesQuery === undefined);

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
  const layoutLabel = PORTFOLIO_LAYOUT_LABELS[layout];

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
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />

        <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-6">
          {/* The closet header + type tabs (6d) */}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-4">
            <h1 className="font-serif italic font-normal text-[34px] lg:text-[52px] tracking-[-0.02em]">
              The closet
            </h1>
            <div className="flex items-baseline gap-4 flex-wrap">
              <ElementsUnderlineTab
                active={nodeType === ""}
                label="All"
                onClick={() => setNodeType("")}
              />
              {COSPLAY_NODE_TYPES.map((value) => (
                <ElementsUnderlineTab
                  key={value}
                  active={nodeType === value}
                  label={formatNodeTypeLabel(value)}
                  onClick={() => setNodeType(value)}
                />
              ))}
            </div>
            <div className="flex-1" />
            {filtered.length > 0 && (
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-55">
                {filtered.length} element{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
            <Link
              href="/elements/new"
              className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              More details
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elements, materials, tags, or notes…"
              aria-label="Search elements and materials"
              className="glass-field min-h-[44px] px-4 py-2 text-[13px] w-full sm:w-[260px]"
            />
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
                  {formatOverallBucket(value)}
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
            <ControlPill
              surface="glass"
              label={order === "asc" ? "Asc" : "Desc"}
              onClick={() => setOrder((current) => (current === "asc" ? "desc" : "asc"))}
              aria-label="Toggle sort order"
            />
            <ControlPill
              surface="glass"
              label={layoutLabel}
              onClick={cycleLayout}
              aria-label="Change card layout"
            />
            <ControlPill
              surface="glass"
              label={SORT_LABELS[sortBy]}
              onClick={cycleElementSort}
              aria-label="Change sort"
            />
          </div>

          <main className="flex-1">
            {isLoading ? (
              <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
            ) : (
              <>
                {filtered.length > 0 && (
                  <div className="mb-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(filtered.map((node) => node._id)))}
                      className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      Select all visible
                    </button>
                  </div>
                )}
                {filtered.length === 0 && (
                  <EmptyState
                    surface="glass"
                    icon="account_tree"
                    message="No elements match this view yet."
                    secondary="Create elements and materials, then group them in a way that matches your build."
                  />
                )}
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
                          className={`absolute z-20 rounded-full border border-glass-border-strong bg-scrim-dim shadow-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
                            selectedIds.size > 0 ? "opacity-100" : "opacity-0"
                          } right-3 top-3 h-5 w-5`}
                          aria-label={`Select ${item.name}`}
                        />
                        <Link
                          href={`/elements/${item._id}`}
                          className="block overflow-hidden rounded-xl transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
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
                  {!isLoading && layout !== "compact" && (
                    <button
                      type="button"
                      onClick={() => open("newCloset")}
                      className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-kyar-media-ring text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      aria-label="New element"
                    >
                      <span className="material-symbols-outlined text-3xl" aria-hidden>
                        add
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
                        New element
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </main>
        </div>

        {selectedCount > 0 && (
          <div className="fixed bottom-20 left-1/2 z-40 flex w-[90%] max-w-4xl -translate-x-1/2 flex-wrap items-center justify-between gap-4 rounded-full bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg px-6 py-4">
            <span className="text-sm font-bold">{selectedCount} selected</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowAssignPanel(true)}
                className="rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active transition-colors"
              >
                Link to build
              </button>
              <button
                type="button"
                onClick={() => setShowUnassignPanel(true)}
                className="rounded-full border border-glass-border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors"
              >
                Unlink from build
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="rounded-full border border-on-glass-danger px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger hover:bg-on-glass-danger/10 transition-colors"
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
                className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-glass-border p-3 text-left hover:border-glass-border-strong hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                <span className="truncate text-sm font-medium">{build.name}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-media-fg-70">
                  Add
                </span>
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
                className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-glass-border p-3 text-left hover:border-glass-border-strong hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                <span className="truncate text-sm font-medium">{build.name}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-media-fg-70">
                  Remove
                </span>
              </button>
            ))}
          </div>
        </ResponsivePanel>
      </div>
    </WebAppShell>
  );
}

function ElementsUnderlineTab({
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
      aria-pressed={active}
      className={`text-[9px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active
          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
      }`}
    >
      {label}
    </button>
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
      aria-pressed={active}
      className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
        active
          ? "bg-glass-solid text-glass-ink"
          : "border border-glass-border-strong text-kyar-media-fg opacity-60 hover:opacity-90"
      }`}
    >
      {label}
    </button>
  );
}
