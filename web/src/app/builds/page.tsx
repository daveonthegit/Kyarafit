"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  buildListArgs,
  getTabFilterOptions,
  type TabFilter,
  type SortBy,
  type SortOrder,
} from "@/lib/buildsListArgs";
import type { BuildStatus } from "@kyarafit/design-system/types";
import type { Doc, Id } from "convex/_generated/dataModel";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

const STATUS_OPTIONS: { value: BuildStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "wip", label: "WIP" },
  { value: "ready", label: "Ready" },
  { value: "archived", label: "Archive" },
];

export default function BuildsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
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
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const removeMany = useMutation(api.builds.removeMany);
  const createBuild = useMutation(api.builds.create);
  const updateStatusMany = useMutation(api.builds.updateStatusMany);

  const listArgs = buildListArgs({
    userId: userId ?? null,
    activeTab,
    search,
    sortBy,
    order,
  });
  const builds = useQuery(api.builds.list, listArgs) ?? [];
  const sharedBuilds = useQuery(api.builds.listSharedWithUser, userId ? { userId } : "skip") ?? [];
  const isLoading = builds === undefined;
  const hasSearch = search.trim().length > 0;

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
        subtitle="Portfolio"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search builds...",
          "aria-label": "Search builds by name or character",
        }}
        trailing={
          <div className="flex items-center gap-2">
            {sharedBuilds.length > 0 && (
              <a
                href="#shared-with-me"
                className="flex items-center justify-center rounded-full border border-kyar-borderSubtle px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Shared ({sharedBuilds.length})
              </a>
            )}
            <Link
              href="/closet"
              className="flex items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface shadow-sm px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text hover:bg-black hover:text-white hover:border-black transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              aria-label="Open closet"
            >
              Closet
            </Link>
          </div>
        }
      >
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto no-scrollbar pb-1 -mx-1 sm:overflow-visible sm:mx-0">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0 mr-2">
            Status
          </span>
          {getTabFilterOptions().map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActiveTab(opt.value as TabFilter)}
              className={`shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                activeTab === opt.value
                  ? "border-black bg-black text-white shadow-md"
                  : "border-kyar-borderSubtle bg-kyar-surface text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
              }`}
              aria-pressed={activeTab === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <label
            htmlFor="build-sort"
            className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0"
          >
            Sort by
          </label>
          <select
            id="build-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[11px] uppercase tracking-wider border-b border-kyar-border py-1.5 bg-transparent focus:outline-none focus:border-kyar-text transition-colors"
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
            className="inline-flex items-center text-kyar-meta hover:text-black transition-colors focus:outline-none"
            aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
            title={order === "asc" ? "Ascending" : "Descending"}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              {order === "asc" ? "arrow_upward" : "arrow_downward"}
            </span>
          </button>
        </div>
      </PageHeader>

      <main className="flex-1 mt-6">
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && builds.length === 0 && !hasSearch && (
          <EmptyState
            icon="construction"
            message="No builds yet."
            secondary="Create one to link closet items and use them in convention packing."
            action={
              <button
                type="button"
                onClick={() => openCreationModal("newBuild")}
                className="min-h-[44px] inline-flex items-center text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2.5 rounded hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
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
          <div className="flex items-center gap-3 mb-4">
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
        <ResponsiveGrid>
          {!isLoading &&
            builds.length > 0 &&
            builds.map((b, index) => {
              const projectNumber = String(index + 1).padStart(3, "0");
              const progress =
                b.tasksTotal > 0 ? Math.round((b.tasksChecked / b.tasksTotal) * 100) : 0;
              const isSelected = selectedIds.has(b._id);

              return (
                <div key={b._id} className="relative">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(b._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 z-20 w-6 h-6 rounded-full border border-white/50 bg-black/20 checked:bg-black checked:border-black focus:ring-2 focus:ring-white focus:ring-offset-0 transition-all active:scale-90 shadow-sm backdrop-blur-sm cursor-pointer"
                    aria-label={`Select ${b.name}`}
                  />
                  <Link
                    href={`/build-detail?id=${b._id}`}
                    className={`block relative aspect-[3/4] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded-2xl border shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group ${isSelected ? "ring-2 ring-black border-black" : "border-kyar-borderSubtle bg-kyar-muted"}`}
                    aria-label={`View details for ${b.name}`}
                  >
                    {b.imageStorageId || b.imageUrl ? (
                      <ResolvedImage
                        imageStorageId={b.imageStorageId}
                        imageUrl={b.imageUrl}
                        alt={b.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover:scale-105">
                        <span className="material-symbols-outlined text-6xl">image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-colors duration-300" />

                    <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                      <div className="flex justify-between items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase block mb-1">
                            Project {projectNumber}
                          </span>
                          <h2 className="font-serif text-2xl lg:text-3xl font-normal italic tracking-tight leading-none group-hover:text-kyar-accent transition-colors truncate">
                            {b.name}
                          </h2>
                        </div>

                        {/* Circular Progress SVG */}
                        <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                          <svg
                            className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-md"
                            viewBox="0 0 36 36"
                          >
                            <circle
                              cx="18"
                              cy="18"
                              r="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-white/20"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-white"
                              strokeLinecap="round"
                              strokeDasharray={`${(progress / 100) * 100} 100`}
                            />
                          </svg>
                          <span className="text-[9px] font-bold drop-shadow-md">{progress}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm">
                          {b.status}
                        </span>
                        {b.character && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/50" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm truncate">
                              {b.character}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
        </ResponsiveGrid>

        {sharedBuilds.length > 0 && (
          <section
            id="shared-with-me"
            className="mt-12 pt-8 border-t border-kyar-borderSubtle scroll-mt-24"
          >
            <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-4">
              Shared with you ({sharedBuilds.length})
            </h2>
            <ResponsiveGrid>
              {sharedBuilds.map((b) => {
                const progress =
                  b.tasksTotal > 0 ? Math.round((b.tasksChecked / b.tasksTotal) * 100) : 0;
                return (
                  <Link
                    key={b._id}
                    href={`/build-detail?id=${b._id}`}
                    className="block relative aspect-[3/4] w-full rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 text-white group"
                  >
                    {b.imageStorageId || b.imageUrl ? (
                      <ResolvedImage
                        imageStorageId={b.imageStorageId}
                        imageUrl={b.imageUrl}
                        alt={b.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover:scale-105">
                        <span className="material-symbols-outlined text-6xl">image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-colors duration-300" />

                    <div className="absolute inset-0 p-5 flex flex-col justify-end text-white">
                      <h2 className="font-serif text-2xl font-bold italic tracking-tight drop-shadow-sm truncate">
                        {b.name}
                      </h2>
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm mt-1">
                        <span>{b.status}</span>
                        {b.myRole && <span className="text-kyar-accent">{b.myRole}</span>}
                      </div>
                      <div className="space-y-2 mt-3">
                        <div className="flex justify-between items-end text-[9px] font-bold uppercase tracking-[0.2em] opacity-90 drop-shadow-sm">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-[2px] bg-white/30 w-full rounded-full overflow-hidden drop-shadow-sm">
                          <div
                            className="h-full bg-white transition-all rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </ResponsiveGrid>
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
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-black rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionPending}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-kyar-danger border border-kyar-danger rounded-full hover:bg-kyar-danger hover:text-white transition-colors disabled:opacity-50"
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
            This cannot be undone. Tasks and build links will be removed.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 border border-black text-sm font-bold uppercase tracking-wider rounded-full hover:bg-black hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={actionPending}
              className="flex-1 py-3 bg-kyar-danger text-white text-sm font-bold uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
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
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-current rounded-full hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {actionPending ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}
    </WebAppShell>
  );
}
