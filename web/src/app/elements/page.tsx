"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
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
  nodeMatchesSubstate,
  nodeSearchText,
  type CosplayExplorerItem,
} from "@/lib/cosplayUi";

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
  bucket: "Bucket",
};

const SUBSTATE_OPTIONS = [
  { value: "", label: "All states" },
  { value: "to_buy", label: "To buy" },
  { value: "bought", label: "Bought" },
  { value: "wip", label: "WIP" },
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
  const activeFilterCount = [
    Boolean(nodeType),
    Boolean(category),
    Boolean(bucket),
    Boolean(substate),
    hierarchyMode !== "all",
  ].filter(Boolean).length;
  const controlsSummary = `${activeFilterCount === 0 ? "All nodes" : `${activeFilterCount} filters`} · ${SORT_LABELS[sortBy]} · ${order === "asc" ? "Ascending" : "Descending"}`;

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
          filtered.length > 0 ? `${filtered.length} nodes in your cosplay graph` : undefined
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
              className="min-h-[44px] rounded-full border border-kyar-text bg-kyar-text px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-bg transition-colors hover:bg-kyar-textSecondary"
            >
              New node
            </button>
            <Link
              href="/elements/new"
              className="min-h-[44px] flex items-center rounded-full border border-kyar-borderSubtle px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:border-kyar-text hover:bg-kyar-muted"
            >
              Full create flow
            </Link>
          </>
        }
      >
        <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <select
            value={nodeType}
            onChange={(e) => setNodeType(e.target.value)}
            className={FILTER_SELECT_CLASS}
            aria-label="Filter by node type"
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
            aria-label="Filter by progress bucket"
          >
            <option value="">All buckets</option>
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
            <option value="all">All structures</option>
            <option value="hasChildren">Has children</option>
            <option value="hasIncomplete">Incomplete descendants</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={FILTER_SELECT_CLASS}
            aria-label="Sort nodes by"
          >
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="cost">Cost</option>
            <option value="progress">Progress</option>
            <option value="bucket">Bucket</option>
          </select>
          <button
            type="button"
            onClick={() => setOrder((current) => (current === "asc" ? "desc" : "asc"))}
            className={`${FILTER_SELECT_CLASS} inline-flex items-center justify-between sm:justify-center`}
          >
            {order === "asc" ? "Asc" : "Desc"}
          </button>
        </div>
      </PageHeader>

      <main className="flex-1 py-6">
        {filtered.length === 0 ? (
          <EmptyState
            icon="account_tree"
            message="No nodes match this view yet."
            secondary="Create elements and materials, then link them into reusable structures."
          />
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                {filtered.length} node{filtered.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(filtered.map((node) => node._id)))}
                className="text-[10px] uppercase tracking-widest underline"
              >
                Select all visible
              </button>
            </div>
            <ResponsiveGrid className="gap-4">
              {filtered.map((item) => (
                <div key={item._id} className="group relative">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item._id)}
                    onChange={() => toggleSelected(item._id)}
                    className="absolute right-3 top-3 z-20 h-5 w-5 rounded-full"
                    aria-label={`Select ${item.name}`}
                  />
                  <Link
                    href={`/elements/${item._id}`}
                    className="block overflow-hidden rounded-3xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft transition-all hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-kyar-mutedWarm">
                      {item.imageStorageId || item.imageUrl ? (
                        <ResolvedImage
                          imageStorageId={item.imageStorageId as Id<"_storage"> | undefined}
                          imageUrl={item.imageUrl ?? undefined}
                          alt={item.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-kyar-textTertiary">
                          <span className="material-symbols-outlined text-5xl">
                            {item.nodeType === "material" ? "science" : "checkroom"}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-kyar-text/85 via-kyar-text/15 to-transparent" />
                      <div className="absolute left-3 top-3 flex gap-2">
                        <span className="rounded-full border border-kyar-bg/15 bg-kyar-text/45 px-3 py-1 text-[9px] uppercase tracking-wider text-kyar-bg backdrop-blur">
                          {formatNodeTypeLabel(item.nodeType)}
                        </span>
                        <span className="rounded-full border border-kyar-bg/15 bg-kyar-text/45 px-3 py-1 text-[9px] uppercase tracking-wider text-kyar-bg backdrop-blur">
                          {formatNodeStatus(item)}
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-kyar-bg">
                        <p className="mb-1 text-[9px] uppercase tracking-[0.2em] opacity-80">
                          {item.category || "uncategorized"}
                        </p>
                        <h3 className="truncate font-serif text-3xl italic leading-none">
                          {item.name}
                        </h3>
                        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-kyar-bg/80">
                          <span>{item.progressPercent ?? 0}% progress</span>
                          <span>
                            {item.childCount ?? 0} child{(item.childCount ?? 0) === 1 ? "" : "ren"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </ResponsiveGrid>
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
