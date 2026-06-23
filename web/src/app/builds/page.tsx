"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { BuildPortfolioCardWeb } from "@/components/builds/BuildPortfolioCardWeb";
import { ControlPill } from "@/components/ui/ControlPill";
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
  all: "All builds",
  current: "Current (in progress)",
  planning: "Planning / idea",
  completed: "Completed",
  archived: "Archived",
};

function portfolioGridClass(layout: PortfolioLayoutMode): string {
  switch (layout) {
    case "comfortable":
      return "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    case "compact":
      return "grid w-full max-w-3xl grid-cols-1 gap-3 mx-auto";
    case "grid":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
    default:
      return "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
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
  const activeTabLabel = tabOptions.find((opt) => opt.value === activeTab)?.label ?? "All builds";
  const layoutLabel = PORTFOLIO_LAYOUT_LABELS[layout];
  const controlsSummary = `${activeTabLabel} · ${SORT_LABELS[sortBy]} · ${order === "asc" ? "Ascending" : "Descending"} · ${layoutLabel}`;

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

  return (
    <WebAppShell>
      <PageHeader
        title="My Builds"
        subtitle="Build library"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search builds...",
          "aria-label": "Search builds by name or character",
        }}
        mobileControlsLabel="Refine builds"
        mobileControlsSummary={controlsSummary}
        trailing={
          <>
            {sharedBuilds.length > 0 && (
              <a
                href="#shared-with-me"
                className="hidden sm:flex min-h-[44px] items-center justify-center rounded-full border border-kyar-borderSubtle px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Shared ({sharedBuilds.length})
              </a>
            )}
            <Link
              href="/elements"
              className="hidden sm:flex min-h-[44px] items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface shadow-sm px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text hover:bg-kyar-muted hover:border-kyar-text transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              aria-label="Open elements"
            >
              Elements
            </Link>
          </>
        }
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0 mr-2">
            Status
          </span>
          {tabOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveTab(opt.value as BuildTab)}
              className={`shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                activeTab === opt.value
                  ? "border-kyar-text bg-kyar-text text-kyar-bg shadow-md"
                  : "border-kyar-borderSubtle bg-kyar-surface text-kyar-textSecondary hover:border-kyar-text hover:bg-kyar-muted"
              }`}
              aria-pressed={activeTab === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-5 sm:hidden">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta">
            Sort &amp; view
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <ControlPill
              label={SORT_LABELS[sortBy]}
              onClick={cycleSort}
              aria-label="Change sort field"
            />
            <ControlPill
              label={order === "asc" ? "Ascending" : "Descending"}
              onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
              aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
            />
            <ControlPill
              label={layoutLabel}
              onClick={cycleLayout}
              aria-label="Change card layout"
            />
          </div>
        </div>
        <div className="hidden w-full flex-wrap items-center gap-3 sm:ml-auto sm:flex sm:w-auto sm:justify-end">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0">
            Sort by
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as BuildSortBy)}
            className="min-h-[44px] min-w-[11rem] flex-1 border-b border-kyar-border bg-transparent py-1.5 text-[11px] uppercase tracking-wider text-kyar-text focus:border-kyar-text focus:outline-none transition-colors sm:min-w-0 sm:flex-none"
            aria-label="Sort builds by"
          >
            <option value="name">Name</option>
            <option value="progress">Progress</option>
            <option value="targetDate">Target date</option>
            <option value="budget">Budget</option>
          </select>
          <button
            type="button"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="inline-flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-kyar-textSecondary transition-colors hover:border-kyar-text hover:text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
            title={order === "asc" ? "Ascending" : "Descending"}
          >
            {order === "asc" ? "Asc" : "Desc"}
          </button>
          <ControlPill label={layoutLabel} onClick={cycleLayout} aria-label="Change card layout" />
        </div>
      </PageHeader>

      <main className="flex-1 mt-3 sm:mt-6">
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && builds.length === 0 && !hasSearch && (
          <EmptyState
            icon="construction"
            message="No builds yet."
            secondary="Create one to link elements and materials and use them in convention packing."
            action={
              <button
                type="button"
                onClick={() => openCreationModal("newBuild")}
                className="min-h-[44px] inline-flex items-center text-[10px] font-semibold uppercase tracking-widest border border-kyar-text px-4 py-2.5 rounded hover:bg-kyar-text hover:text-kyar-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              >
                New build
              </button>
            }
          />
        )}
        {!isLoading && builds.length === 0 && hasSearch && (
          <EmptyState icon="search_off" message="No builds match your search." />
        )}
        {!isLoading && builds.length > 0 && (
          <div className="mb-3 sm:mb-4 flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              {builds.length} build{builds.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] uppercase tracking-widest font-medium underline"
            >
              {selectedIds.size === builds.length ? "Deselect all" : "Select all"}
            </button>
          </div>
        )}
        <div className={portfolioGridClass(layout)}>
          {!isLoading &&
            builds.length > 0 &&
            builds.map((b, index) => {
              const isSelected = selectedIds.has(b._id);

              return (
                <div key={b._id} className="group relative">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(b._id)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-20 h-6 w-6 cursor-pointer rounded-full border border-kyar-borderSubtle bg-kyar-text/25 shadow-sm backdrop-blur-sm transition-all checked:border-kyar-text checked:bg-kyar-text focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0 active:scale-90 focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 ${
                      selectedIds.size > 0 ? "opacity-100" : "opacity-0"
                    } ${layout === "compact" ? "right-3 top-3" : "right-4 top-4"}`}
                    aria-label={`Select ${b.name}`}
                  />
                  <Link
                    href={`/build-detail/${b._id}`}
                    className={`group block w-full cursor-pointer overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 transition-all hover:-translate-y-1 hover:shadow-lg ${
                      isSelected ? "ring-2 ring-kyar-text" : ""
                    }`}
                    aria-label={`View details for ${b.name}`}
                  >
                    <BuildPortfolioCardWeb
                      variant={layout}
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
            })}
        </div>

        {sharedBuilds.length > 0 && (
          <section
            id="shared-with-me"
            className="mt-12 pt-8 border-t border-kyar-borderSubtle scroll-mt-24"
          >
            <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-4">
              Shared with you ({sharedBuilds.length})
            </h2>
            <div className={portfolioGridClass(layout)}>
              {sharedBuilds.map((b, index) => (
                <Link
                  key={b._id}
                  href={`/build-detail/${b._id}`}
                  className="group block w-full overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                >
                  <BuildPortfolioCardWeb
                    variant={layout}
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
          </section>
        )}
      </main>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-6 py-4 bg-kyar-surface border border-kyar-borderSubtle shadow-lg flex items-center justify-between gap-6 flex-wrap rounded-full w-[90%] max-w-2xl"
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
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-kyar-text rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionPending}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-kyar-danger border border-kyar-danger rounded-full hover:bg-kyar-danger hover:text-kyar-bg transition-colors disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity"
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
          <h2 id="builds-delete-dialog-title" className="font-serif text-lg font-bold mb-2">
            Delete {selectedIds.size} build{selectedIds.size !== 1 ? "s" : ""}?
          </h2>
          <p className="text-sm text-kyar-meta mb-6">
            This cannot be undone. Tasks and element links will be removed.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 border border-kyar-text text-sm font-bold uppercase tracking-wider rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={actionPending}
              className="flex-1 py-3 bg-kyar-danger text-kyar-bg text-sm font-bold uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </AdaptiveModal>

      {deletedForUndo && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-kyar-text text-kyar-bg rounded-full border border-kyar-border shadow-2xl"
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
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-current rounded-full hover:bg-kyar-bg/10 disabled:opacity-50 transition-colors"
          >
            {actionPending ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}
    </WebAppShell>
  );
}
