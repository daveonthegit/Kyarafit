"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
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
  formatCents,
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

/** Compact glass-outline selects for the closet panel's filter grid. */
const FILTER_SELECT_CLASS =
  "glass-field min-h-[38px] w-full min-w-0 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]";

/** On-glass chip tone per status label (prototype 6d: owned=done, wip=active, to-buy=warn). */
const STATUS_CHIP_TONES: Record<string, "done" | "active" | "warn" | "neutral"> = {
  Complete: "done",
  Built: "done",
  Bought: "done",
  "In use": "active",
  "In progress": "active",
  Incomplete: "warn",
};

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
  const [viewMode, setViewMode] = useState<"all" | "tree">("all");
  const [selectedIds, setSelectedIds] = useState<Set<CosplayNodeId>>(new Set());
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showUnassignPanel, setShowUnassignPanel] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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

  // Featured backdrop: the last-touched piece, preferring one with imagery (image #3 layout).
  const featured = useMemo(() => {
    const byTouch = [...nodes].sort(
      (a, b) =>
        ((b as { updatedAt?: number }).updatedAt ?? b._creationTime ?? 0) -
        ((a as { updatedAt?: number }).updatedAt ?? a._creationTime ?? 0)
    );
    return byTouch.find((node) => node.imageStorageId || node.imageUrl) ?? byTouch[0] ?? null;
  }, [nodes]);

  const investedCents = useMemo(
    () =>
      filtered.reduce((sum, node) => sum + (node.totalCostCents ?? node.directCostCents ?? 0), 0),
    [filtered]
  );

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

  const featuredStatus = featured
    ? formatNodeStatus(featured as Parameters<typeof formatNodeStatus>[0])
    : null;
  const featuredTone = featuredStatus ? (STATUS_CHIP_TONES[featuredStatus] ?? "neutral") : null;

  return (
    <WebAppShell fullBleed lockViewport>
      <div className="relative flex-1 flex flex-col min-h-0 text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={(featured?.imageStorageId as Id<"_storage"> | null) ?? undefined}
          imageUrl={featured?.imageUrl ?? undefined}
          scrimRight="strong"
        />

        <main className="relative z-10 mx-auto grid w-full min-h-0 max-w-[1600px] flex-1 grid-cols-1 items-start gap-8 px-4 pt-8 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(460px,560px)] lg:items-stretch lg:px-10">
          {/* Featured piece — last touched, identity on the photo (image #3) */}
          <div className="max-w-[720px] pt-2 lg:pt-10">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em] opacity-75">
              Elements · Last touched
            </p>
            {featured ? (
              <>
                <Link
                  href={`/elements/${featured._id}`}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] transition-opacity group-hover:opacity-90 sm:text-[56px] lg:text-[72px]">
                    {featured.name}
                  </h1>
                </Link>

                <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
                  <div>
                    <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                      Kind
                    </dt>
                    <dd className="text-[15px]">
                      {featured.category?.trim() || formatNodeTypeLabel(featured.nodeType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                      Progress
                    </dt>
                    <dd className="text-[15px] tabular-nums">{featured.progressPercent ?? 0}%</dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">
                      Direct cost
                    </dt>
                    <dd className="text-[15px] tabular-nums">
                      {formatCents(featured.directCostCents ?? 0)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {featuredStatus && (
                    <span
                      className={`rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur-glass-chip ${
                        featuredTone === "done"
                          ? "bg-on-glass-chip-done-bg text-on-glass-chip-done-fg"
                          : featuredTone === "active"
                            ? "bg-on-glass-chip-active-bg text-on-glass-chip-active-fg"
                            : featuredTone === "warn"
                              ? "bg-on-glass-chip-warn-bg text-on-glass-chip-warn-fg"
                              : "bg-on-glass-chip-neutral-bg text-on-glass-chip-neutral-fg"
                      }`}
                    >
                      {featuredStatus}
                    </span>
                  )}
                  <span className="max-w-[420px] truncate text-[13px] text-media-fg-70">
                    {(featured as { notes?: string | null }).notes?.split("\n")[0] ??
                      `${featured.childCount ?? 0} part${(featured.childCount ?? 0) === 1 ? "" : "s"} linked`}
                  </span>
                </div>
              </>
            ) : (
              <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] sm:text-[56px] lg:text-[72px]">
                Elements
              </h1>
            )}
          </div>

          {/* The closet panel, anchored right (image #3) */}
          <section className="flex min-h-0 flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass lg:h-full lg:overflow-hidden">
            <div className="flex shrink-0 items-baseline gap-x-6 gap-y-2 overflow-x-auto border-b border-glass-divider-strong px-5 py-4">
              <ElementsUnderlineTab
                active={nodeType === ""}
                label={`All · ${filtered.length}`}
                onClick={() => setNodeType("")}
              />
              {COSPLAY_NODE_TYPES.map((value) => (
                <ElementsUnderlineTab
                  key={value}
                  active={nodeType === value}
                  label={`${formatNodeTypeLabel(value)}s`}
                  onClick={() => setNodeType(value)}
                />
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowSearch((v) => !v)}
                aria-pressed={showSearch}
                aria-label="Search elements"
                className={`material-symbols-outlined self-center text-lg transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                  showSearch || search ? "text-kyar-media-fg" : "text-media-fg-55"
                }`}
              >
                search
              </button>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-pressed={showFilters}
                aria-label="Filters and sorting"
                className={`material-symbols-outlined self-center text-lg transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                  showFilters ? "text-kyar-media-fg" : "text-media-fg-55"
                }`}
              >
                tune
              </button>
            </div>

            {showSearch && (
              <div className="shrink-0 border-b border-glass-divider px-5 py-3">
                <input
                  type="search"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search elements, materials, tags, or notes…"
                  aria-label="Search elements and materials"
                  className="glass-field min-h-[44px] w-full px-4 py-2 text-[13px]"
                />
              </div>
            )}

            {showFilters && (
              <div className="shrink-0 space-y-4 border-b border-glass-divider px-5 py-4">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                  <ElementsFilterField label="View">
                    <div
                      role="group"
                      aria-label="List or grouped view"
                      className="flex min-h-[38px] gap-1 rounded-full bg-glass-active p-1"
                    >
                      {(
                        [
                          ["all", "All"],
                          ["tree", "Grouped"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setViewMode(value)}
                          aria-pressed={viewMode === value}
                          className={`flex-1 rounded-full px-2 text-[9px] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                            viewMode === value
                              ? "bg-glass-solid text-glass-ink"
                              : "text-media-fg-55 hover:text-kyar-media-fg"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </ElementsFilterField>

                  <ElementsFilterField label="Category">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={FILTER_SELECT_CLASS}
                      aria-label="Filter by category"
                    >
                      <option value="">All</option>
                      {COSPLAY_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </ElementsFilterField>

                  <ElementsFilterField label="Stage">
                    <select
                      value={bucket}
                      onChange={(e) => setBucket(e.target.value)}
                      className={FILTER_SELECT_CLASS}
                      aria-label="Filter by progress stage"
                    >
                      <option value="">All</option>
                      {COSPLAY_OVERALL_BUCKETS.map((value) => (
                        <option key={value} value={value}>
                          {formatOverallBucket(value)}
                        </option>
                      ))}
                    </select>
                  </ElementsFilterField>

                  <ElementsFilterField label="State">
                    <select
                      value={substate}
                      onChange={(e) => setSubstate(e.target.value)}
                      className={FILTER_SELECT_CLASS}
                      aria-label="Filter by substate"
                    >
                      {SUBSTATE_OPTIONS.map((option) => (
                        <option key={option.value || "all"} value={option.value}>
                          {option.value ? option.label : "All"}
                        </option>
                      ))}
                    </select>
                  </ElementsFilterField>

                  <ElementsFilterField label="Grouping">
                    <select
                      value={hierarchyMode}
                      onChange={(e) => setHierarchyMode(e.target.value as typeof hierarchyMode)}
                      className={FILTER_SELECT_CLASS}
                      aria-label="Filter by hierarchy state"
                    >
                      <option value="all">All</option>
                      <option value="hasChildren">Has sub-elements</option>
                      <option value="hasIncomplete">Unfinished sub-elements</option>
                    </select>
                  </ElementsFilterField>

                  <ElementsFilterField label="Sort">
                    <div className="flex gap-2">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className={`${FILTER_SELECT_CLASS} flex-1`}
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
                        aria-label={`Sort ${order === "asc" ? "ascending" : "descending"} — toggle`}
                        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>
                          {order === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      </button>
                    </div>
                  </ElementsFilterField>
                </div>

                {filtered.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(filtered.map((node) => node._id)))}
                      className="border-b border-glass-border-strong pb-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      Select all visible
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-5">
                  <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    surface="glass"
                    icon="checkroom"
                    message="No elements match this view yet."
                    secondary="Create elements and materials, then group them in a way that matches your build."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-glass-divider">
                  {filtered.map((item) => {
                    const status = formatNodeStatus(item);
                    const tone = STATUS_CHIP_TONES[status] ?? "neutral";
                    const cost = item.totalCostCents ?? item.directCostCents ?? 0;
                    return (
                      <li key={item._id} className="group relative flex items-center">
                        <span className="flex shrink-0 items-center justify-center pl-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item._id)}
                            onChange={() => toggleSelected(item._id)}
                            className={`h-5 w-5 rounded-full border border-glass-border-strong bg-scrim-dim shadow-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
                              selectedIds.size > 0 ? "opacity-100" : "opacity-0"
                            }`}
                            aria-label={`Select ${item.name}`}
                          />
                        </span>
                        <Link
                          href={`/elements/${item._id}`}
                          className="flex min-h-[64px] min-w-0 flex-1 items-center gap-4 py-3 pl-3 pr-5 transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                        >
                          <span className="h-[60px] w-[48px] shrink-0 overflow-hidden rounded-[8px] border border-glass-border bg-glass-active">
                            {item.imageStorageId || item.imageUrl ? (
                              <ResolvedImage
                                imageStorageId={
                                  (item.imageStorageId as Id<"_storage"> | null) ?? undefined
                                }
                                imageUrl={item.imageUrl ?? undefined}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-media-fg-45">
                                <span className="material-symbols-outlined text-lg" aria-hidden>
                                  {item.nodeType === "material" ? "science" : "checkroom"}
                                </span>
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">
                              {(item.category?.trim() || formatNodeTypeLabel(item.nodeType)).toUpperCase()}
                            </span>
                            <span className="block truncate font-serif text-[17px] italic">
                              {item.name}
                            </span>
                          </span>
                          {cost > 0 && (
                            <span className="shrink-0 text-[13px] tabular-nums text-media-fg-70">
                              {formatCents(cost)}
                            </span>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur-glass-chip ${
                              tone === "done"
                                ? "bg-on-glass-chip-done-bg text-on-glass-chip-done-fg"
                                : tone === "active"
                                  ? "bg-on-glass-chip-active-bg text-on-glass-chip-active-fg"
                                  : tone === "warn"
                                    ? "bg-on-glass-chip-warn-bg text-on-glass-chip-warn-fg"
                                    : "bg-on-glass-chip-neutral-bg text-on-glass-chip-neutral-fg"
                            }`}
                          >
                            {status}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-glass-divider px-5 py-3.5">
              <span className="font-explorer-mono text-[11px] text-media-fg-55">
                {filtered.length} piece{filtered.length === 1 ? "" : "s"} ·{" "}
                {formatCents(investedCents)} invested
              </span>
              <button
                type="button"
                onClick={() => open("newCloset")}
                className="min-h-[40px] rounded-full bg-glass-solid px-5 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90"
              >
                + New element
              </button>
            </div>
          </section>
        </main>

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

function ElementsFilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
        {label}
      </p>
      {children}
    </div>
  );
}
