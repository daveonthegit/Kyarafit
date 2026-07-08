"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { BuildPortfolioCardWeb } from "@/components/builds/BuildPortfolioCardWeb";
import { ControlPill } from "@/components/ui/ControlPill";
import { PhotoPill } from "@/components/ui/PhotoPill";
import {
  PORTFOLIO_LAYOUT_LABELS,
  cyclePortfolioLayout,
  type PortfolioLayoutMode,
} from "@/lib/portfolioLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BUILD_TABS,
  type BuildTab,
  type BuildSortBy,
  type SortOrder,
} from "@kyarafit/design-system/domain/buildsList";
import { useBuildsList } from "@/lib/builds/useBuildsList";
import type { BuildStatus } from "@kyarafit/design-system/types";
import type { Doc, Id } from "convex/_generated/dataModel";

const STATUS_OPTIONS: { value: BuildStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "wip", label: "In progress" },
  { value: "ready", label: "Ready" },
  { value: "archived", label: "Archive" },
];

const SORT_LABELS: Record<BuildSortBy, string> = {
  name: "Name",
  progress: "Progress",
  targetDate: "Target date",
  budget: "Budget",
};

const BUILD_SORT_CYCLE: BuildSortBy[] = ["name", "targetDate", "progress", "budget"];

const BUILD_TAB_LABELS: Record<BuildTab, string> = {
  all: "All",
  current: "In progress",
  planning: "Planning",
  completed: "Completed",
  archived: "Archived",
};

function portfolioGridClass(layout: PortfolioLayoutMode): string {
  switch (layout) {
    case "comfortable":
      return "flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1";
    case "compact":
      return "grid w-full max-w-3xl grid-cols-1 gap-3";
    case "grid":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
    default:
      return "flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1";
  }
}

export default function BuildsPage() {
  const [activeTab, setActiveTab] = useState<BuildTab>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<BuildSortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [layout, setLayout] = useState<PortfolioLayoutMode>("comfortable");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"builds">>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: Array<{
      userId: string;
      name: string;
      character?: string;
      status: string;
      notes?: string;
      imageUrl?: string;
      imageStorageId?: Doc<"builds">["imageStorageId"];
      budgetCents?: number;
      targetDate?: string;
    }>;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { userId, isLoading: authLoading } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const tabOptions = BUILD_TABS.map((value) => ({ value, label: BUILD_TAB_LABELS[value] }));

  // Builds list is the Wave 3 local-first slice: data + writes flow through the offline bridge,
  // and filtering/sorting happen locally (see `useBuildsList`). Other screens stay on convex/react.
  const {
    builds,
    isLoading: buildsLoading,
    createBuild,
    removeMany,
    updateStatusMany,
  } = useBuildsList({
    userId: userId ?? null,
    view: { tab: activeTab, search, sortBy, order },
  });
  // "Shared with me" is collaboration data (online-only, paid) — intentionally direct convex/react.
  const sharedBuilds = useQuery(api.builds.listSharedWithUser, userId ? { userId } : "skip") ?? [];
  const isLoading = authLoading || buildsLoading;
  const hasSearch = search.trim().length > 0;
  const layoutLabel = PORTFOLIO_LAYOUT_LABELS[layout];

  const featured = useMemo(() => builds.find((b) => b.status === "wip") ?? builds[0], [builds]);
  const featuredIndex = featured ? builds.indexOf(featured) : -1;
  const featuredProgress =
    featured && featured.tasksTotal > 0
      ? Math.round((100 * featured.tasksChecked) / featured.tasksTotal)
      : 0;

  const cycleSort = useCallback(() => {
    setSortBy((prev) => {
      const i = BUILD_SORT_CYCLE.indexOf(prev);
      return BUILD_SORT_CYCLE[(i + 1) % BUILD_SORT_CYCLE.length]!;
    });
  }, []);

  const cycleLayout = useCallback(() => {
    setLayout((prev) => cyclePortfolioLayout(prev));
  }, []);

  const toggleSelect = useCallback((id: Id<"builds">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (builds.length === 0) return prev;
      if (prev.size === builds.length) return new Set();
      return new Set(builds.map((b) => b._id));
    });
  }, [builds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const UNDO_WINDOW_MS = 8000;

  const handleSetStatusSelected = async (status: BuildStatus) => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await updateStatusMany({
        ids: Array.from(selectedIds),
        userId,
        status,
      });
      clearSelection();
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!userId || selectedIds.size === 0) return;
    const toDelete = builds.filter((b) => selectedIds.has(b._id));
    const payloads = toDelete.map((b) => ({
      userId: b.userId,
      name: b.name,
      character: b.character,
      status: b.status,
      notes: b.notes,
      imageUrl: b.imageUrl,
      imageStorageId: b.imageStorageId,
      budgetCents: b.budgetCents,
      targetDate: b.targetDate,
    }));
    setActionPending(true);
    try {
      await removeMany({ ids: Array.from(selectedIds), userId });
      setShowDeleteConfirm(false);
      clearSelection();
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedForUndo({ count: payloads.length, payloads });
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, UNDO_WINDOW_MS);
    } finally {
      setActionPending(false);
    }
  };

  const handleUndoDelete = useCallback(async () => {
    if (!userId || !deletedForUndo) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setActionPending(true);
    try {
      for (const p of deletedForUndo.payloads) {
        await createBuild({
          userId,
          name: p.name,
          character: p.character,
          status: p.status,
          notes: p.notes,
          imageUrl: p.imageUrl,
          imageStorageId: p.imageStorageId,
          budgetCents: p.budgetCents,
          targetDate: p.targetDate,
        });
      }
      setDeletedForUndo(null);
    } finally {
      setActionPending(false);
    }
  }, [userId, deletedForUndo, createBuild]);

  const renderBuildTile = (b: (typeof builds)[number], index: number) => {
    const isSelected = selectedIds.has(b._id);
    const isFeatured = featured?._id === b._id;
    return (
      <div
        key={b._id}
        className={`group relative ${layout === "comfortable" ? "snap-start shrink-0 w-[200px]" : ""}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelect(b._id)}
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-20 h-6 w-6 cursor-pointer rounded-full border border-glass-border-strong bg-scrim-dim shadow-sm backdrop-blur-glass-chip transition-all checked:border-kyar-media-fg checked:bg-glass-solid focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0 active:scale-90 focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
            selectedIds.size > 0 ? "opacity-100" : "opacity-0"
          } right-3 top-3`}
          aria-label={`Select ${b.name}`}
        />
        <Link
          href={`/build-detail/${b._id}`}
          className={`group block w-full cursor-pointer overflow-hidden rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent transition-transform hover:-translate-y-0.5 ${
            isSelected ? "ring-2 ring-kyar-media-fg" : ""
          } ${isFeatured ? "outline outline-[1.5px] -outline-offset-[1.5px] outline-glass-border-strong" : ""}`}
          aria-label={`View details for ${b.name}`}
        >
          <BuildPortfolioCardWeb
            variant={layout === "comfortable" ? "grid" : layout}
            projectIndex={index + 1}
            item={{
              name: b.name,
              character: b.character,
              status: b.status,
              imageStorageId: b.imageStorageId,
              imageUrl: b.imageUrl,
              tasksTotal: b.tasksTotal,
              tasksChecked: b.tasksChecked,
            }}
          />
        </Link>
      </div>
    );
  };

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop imageStorageId={featured?.imageStorageId} imageUrl={featured?.imageUrl} />

        <div className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-12 pb-6 min-h-0">
          {/* Featured headline (1b) */}
          <section className="flex-1 min-w-0 max-w-[680px] lg:mt-4">
            {featured ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  Featured · Project {String(featuredIndex + 1).padStart(2, "0")} ·{" "}
                  {featured.status}
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[88px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  {featured.name}
                </h1>
                <div className="mt-5 flex items-center gap-4">
                  <div
                    className="h-[2px] w-[180px] sm:w-[260px] bg-glass-border rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={featured.tasksChecked}
                    aria-valuemin={0}
                    aria-valuemax={featured.tasksTotal}
                  >
                    <div
                      className="h-full bg-kyar-media-fg rounded-full"
                      style={{ width: `${featuredProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums">
                    {featuredProgress}%
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55">
                    {featured.tasksChecked} / {featured.tasksTotal} tasks
                  </span>
                </div>
                <Link
                  href={`/build-detail/${featured._id}`}
                  className="mt-5 inline-block text-[10px] font-bold uppercase tracking-[0.16em] border-b border-kyar-media-fg pb-0.5 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Open build ▸
                </Link>
              </>
            ) : null}
          </section>

          {/* The archive — bottom glass shelf (1b) */}
          <section className="mt-8 bg-glass backdrop-blur-glass border border-glass-border rounded-glass px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                The archive · {builds.length}
              </span>
              {tabOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActiveTab(opt.value as BuildTab)}
                  className={`text-[9px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                    activeTab === opt.value
                      ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                      : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                  }`}
                  aria-pressed={activeTab === opt.value}
                >
                  {opt.label}
                </button>
              ))}
              <div className="flex-1" />
              {sharedBuilds.length > 0 && (
                <a
                  href="#shared-with-me"
                  className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Shared ({sharedBuilds.length})
                </a>
              )}
              <Link
                href="/elements"
                className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Open elements"
              >
                Elements ▸
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search builds..."
                aria-label="Search builds by name or character"
                className="glass-field px-3 py-2 text-[13px] w-full sm:w-[220px]"
              />
              <ControlPill
                surface="glass"
                label={SORT_LABELS[sortBy]}
                onClick={cycleSort}
                aria-label="Change sort field"
              />
              <ControlPill
                surface="glass"
                label={order === "asc" ? "Asc" : "Desc"}
                onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
                aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
              />
              <ControlPill
                surface="glass"
                label={layoutLabel}
                onClick={cycleLayout}
                aria-label="Change card layout"
              />
              {builds.length > 0 && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="ml-auto text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  {selectedIds.size === builds.length ? "Deselect all" : "Select all"}
                </button>
              )}
            </div>

            {isLoading && <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />}
            {!isLoading && builds.length === 0 && !hasSearch && (
              <EmptyState
                surface="glass"
                icon="construction"
                message="No builds yet."
                secondary="Create one to link elements and materials and use them in convention packing."
                action={
                  <PhotoPill onClick={() => openCreationModal("newBuild")} icon="add">
                    New build
                  </PhotoPill>
                }
              />
            )}
            {!isLoading && builds.length === 0 && hasSearch && (
              <EmptyState
                surface="glass"
                icon="search_off"
                message="No builds match your search."
              />
            )}
            {!isLoading && builds.length > 0 && (
              <div className={portfolioGridClass(layout)}>{builds.map(renderBuildTile)}</div>
            )}

            {sharedBuilds.length > 0 && (
              <div
                id="shared-with-me"
                className="mt-8 pt-5 border-t border-glass-divider scroll-mt-24"
              >
                <h2 className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85 mb-4">
                  Shared with you · {sharedBuilds.length}
                </h2>
                <div className={portfolioGridClass(layout)}>
                  {sharedBuilds.map((b, index) => (
                    <Link
                      key={b._id}
                      href={`/build-detail/${b._id}`}
                      className={`group block overflow-hidden rounded-[10px] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        layout === "comfortable" ? "snap-start shrink-0 w-[200px]" : "w-full"
                      }`}
                    >
                      <BuildPortfolioCardWeb
                        variant={layout === "comfortable" ? "grid" : layout}
                        projectIndex={index + 1}
                        item={{
                          name: b.name,
                          character: b.character ?? (b.myRole ? String(b.myRole) : null),
                          status: b.status,
                          imageStorageId: b.imageStorageId,
                          imageUrl: b.imageUrl,
                          tasksTotal: b.tasksTotal,
                          tasksChecked: b.tasksChecked,
                        }}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {selectedIds.size > 0 && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-6 py-4 bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg flex items-center justify-between gap-6 flex-wrap rounded-full w-[90%] max-w-2xl"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <span className="text-sm font-bold">{selectedIds.size} selected</span>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSetStatusSelected(value)}
                  disabled={actionPending}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={actionPending}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger border border-on-glass-danger rounded-full hover:bg-on-glass-danger/10 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] opacity-70 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <AdaptiveModal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          aria-labelledby="builds-delete-dialog-title"
        >
          <div className="p-6">
            <h2 id="builds-delete-dialog-title" className="font-serif italic text-lg mb-2">
              Delete {selectedIds.size} build{selectedIds.size !== 1 ? "s" : ""}?
            </h2>
            <p className="text-sm text-media-fg-70 mb-6">
              This cannot be undone. Tasks and element links will be removed.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 min-h-[44px] py-3 border border-glass-border-strong bg-glass-bar text-[10px] font-bold uppercase tracking-[0.16em] rounded-full hover:bg-glass-active transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={actionPending}
                className="flex-1 min-h-[44px] py-3 border border-on-glass-danger text-on-glass-danger text-[10px] font-bold uppercase tracking-[0.16em] rounded-full hover:bg-on-glass-danger/10 transition-colors disabled:opacity-50"
              >
                {actionPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </AdaptiveModal>

        {deletedForUndo && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-glass-solid text-glass-ink rounded-full shadow-fab"
            role="status"
            aria-live="polite"
          >
            <span className="text-sm font-medium">
              {deletedForUndo.count} build{deletedForUndo.count !== 1 ? "s" : ""} deleted
            </span>
            <button
              type="button"
              onClick={handleUndoDelete}
              disabled={actionPending}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] border border-current rounded-full hover:bg-glass-ink/10 disabled:opacity-50 transition-colors"
            >
              {actionPending ? "Undoing…" : "Undo"}
            </button>
          </div>
        )}
      </div>
    </WebAppShell>
  );
}
