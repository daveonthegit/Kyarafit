"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import {
  buildListArgs,
  getTabFilterOptions,
  type TabFilter,
  type SortBy,
  type SortOrder,
} from "@/lib/buildsListArgs";
import type { Id } from "convex/_generated/dataModel";

export default function BuildsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"builds">>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const { userId } = useCurrentUser();
  const removeMany = useMutation(api.builds.removeMany);
  const updateStatusMany = useMutation(api.builds.updateStatusMany);

  const listArgs = buildListArgs({
    userId: userId ?? null,
    activeTab,
    search,
    sortBy,
    order,
  });
  const builds = useQuery(api.builds.list, listArgs) ?? [];
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

  const handleArchiveSelected = async () => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await updateStatusMany({
        ids: Array.from(selectedIds),
        userId,
        status: "archived",
      });
      clearSelection();
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await removeMany({ ids: Array.from(selectedIds), userId });
      setShowDeleteConfirm(false);
      clearSelection();
    } finally {
      setActionPending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-6 pt-14 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex justify-between items-end">
          <div>
            <p className="meta-label mb-1 opacity-40">Portfolio</p>
            <h1 className="font-serif text-3xl font-bold tracking-tight italic">My Builds</h1>
          </div>
          <Link href="/closet" className="flex items-center gap-2 border border-black px-3 py-1">
            <span className="material-symbols-outlined font-light text-sm">inventory_2</span>
            <span className="text-[9px] uppercase tracking-widest font-bold">Closet</span>
          </Link>
        </div>
      </header>

      <nav className="sticky top-[108px] z-30 bg-white/90 backdrop-blur-md pt-2 pb-4 space-y-4 overflow-visible max-h-none">
        <div className="px-6">
          <label htmlFor="build-status-filter" className="sr-only">
            Filter builds by status
          </label>
          <select
            id="build-status-filter"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as TabFilter)}
            className="w-full sm:w-auto min-w-[180px] text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 uppercase tracking-widest"
            aria-label="Filter builds by status"
          >
            {getTabFilterOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="px-6 flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="sr-only" htmlFor="build-search">
            Search builds by name or character
          </label>
          <input
            id="build-search"
            type="search"
            placeholder="Search by name or character..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Search builds by name or character"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor="build-sort"
              className="text-[10px] uppercase tracking-widest opacity-70"
            >
              Sort by
            </label>
            <select
              id="build-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20"
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
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20 flex items-center gap-1"
              aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
              title={order === "asc" ? "Ascending" : "Descending"}
            >
              <span className="material-symbols-outlined text-base">
                {order === "asc" ? "arrow_upward" : "arrow_downward"}
              </span>
              <span className="text-[10px] uppercase">{order}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 px-6 pb-32 mt-6">
        {isLoading && <p className="meta-label">Loading...</p>}
        {!isLoading && builds.length === 0 && !hasSearch && (
          <p className="text-sm text-kyar-meta">
            No builds yet. Create one to link closet items and use them in convention packing.
          </p>
        )}
        {!isLoading && builds.length === 0 && hasSearch && (
          <p className="text-sm text-kyar-textTertiary">No builds match your search.</p>
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
        <div className="space-y-16">
          {builds.map((b, index) => {
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
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded border-2 border-black bg-white/90 focus:ring-2 focus:ring-black/30"
                  aria-label={`Select ${b.name}`}
                />
                <Link
                  href={`/build-detail?id=${b._id}`}
                  className="block cursor-pointer hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 rounded-sm"
                  aria-label={`View details for ${b.name}`}
                >
                  <section className={isSelected ? "ring-2 ring-black ring-offset-2" : ""}>
                    <div className="aspect-[2/3] w-full overflow-hidden bg-gray-50 mb-6">
                      {b.imageStorageId || b.imageUrl ? (
                        <ResolvedImage
                          imageStorageId={b.imageStorageId}
                          imageUrl={b.imageUrl}
                          alt={b.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                          <span className="material-symbols-outlined text-6xl">image</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-baseline">
                        <h2 className="font-serif text-2xl font-bold italic tracking-tight">
                          {b.name}
                        </h2>
                        <span className="text-[10px] font-medium tracking-[0.2em] opacity-40 uppercase">
                          Project {projectNumber}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium">
                          <span>Construction Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-[1px] bg-gray-200 w-full">
                          <div
                            className="h-full bg-black transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex gap-4 pt-2">
                        <span className="text-[10px] uppercase tracking-widest opacity-60">
                          {b.status}
                        </span>
                        {b.character && (
                          <span className="text-[10px] uppercase tracking-widest opacity-60">
                            {b.character}
                          </span>
                        )}
                      </div>
                    </div>
                  </section>
                </Link>
              </div>
            );
          })}
        </div>
      </main>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4 py-3 bg-white border-t border-gray-200 shadow-lg flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleArchiveSelected}
              disabled={actionPending}
              className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionPending}
              className="px-3 py-1.5 text-xs font-medium text-kyar-danger border border-kyar-danger rounded disabled:opacity-50"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium uppercase opacity-70"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="builds-delete-dialog-title"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
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
                className="flex-1 py-2 border border-black text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={actionPending}
                className="flex-1 py-2 bg-kyar-danger text-white text-sm font-medium disabled:opacity-50"
              >
                {actionPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingAdd href="/builds/new" />
      <BottomNav active="builds" />
    </div>
  );
}
