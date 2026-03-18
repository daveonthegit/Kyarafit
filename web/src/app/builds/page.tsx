"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import type { Id } from "convex/_generated/dataModel";

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
    <WebAppShell>
      <PageHeader
        title="My Builds"
        subtitle="Portfolio"
        primaryAction={{ label: "New build", href: "/builds/new" }}
        trailing={
          <Link
            href="/closet"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm border border-kyar-border px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-kyar-text hover:bg-kyar-accent hover:text-white hover:border-kyar-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
            aria-label="Open closet"
          >
            <span className="material-symbols-outlined text-lg font-light" aria-hidden>
              inventory_2
            </span>
          </Link>
        }
      />

      <FilterToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by name or character…",
          "aria-label": "Search builds by name or character",
        }}
        filtersLabel="Filters"
      >
        <label htmlFor="build-status-filter" className="sr-only">
          Filter builds by status
        </label>
        <select
          id="build-status-filter"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as TabFilter)}
          className="w-full sm:w-auto min-w-[140px] min-h-[44px] text-sm border border-kyar-border rounded-sm px-3 py-2.5 bg-kyar-surfaceWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm uppercase tracking-widest"
          aria-label="Filter builds by status"
        >
          {getTabFilterOptions().map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label
          htmlFor="build-sort"
          className="text-[10px] uppercase tracking-widest text-kyar-meta sm:flex sm:items-center"
        >
          Sort by
        </label>
        <select
          id="build-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="min-h-[44px] text-sm border border-kyar-border rounded-sm px-3 py-2.5 bg-kyar-surfaceWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
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
          className="min-h-[44px] min-w-[44px] inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border border-kyar-border rounded-sm bg-kyar-surfaceWarm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
          aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
          title={order === "asc" ? "Ascending" : "Descending"}
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            {order === "asc" ? "arrow_upward" : "arrow_downward"}
          </span>
          <span className="text-[10px] uppercase">{order}</span>
        </button>
      </FilterToolbar>

      <main className="flex-1 mt-6">
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && builds.length === 0 && !hasSearch && (
          <EmptyState
            icon="construction"
            message="No builds yet."
            secondary="Create one to link closet items and use them in convention packing."
            action={
              <Link
                href="/builds/new"
                className="min-h-[44px] inline-flex items-center text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2.5 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              >
                New build
              </Link>
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
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-sm border-2 border-black bg-white/90 focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
                  aria-label={`Select ${b.name}`}
                />
                <Link
                  href={`/build-detail?id=${b._id}`}
                  className="block cursor-pointer hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm rounded-sm"
                  aria-label={`View details for ${b.name}`}
                >
                  <section
                    className={`rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm shadow-card overflow-hidden ${isSelected ? "ring-2 ring-black ring-offset-2" : ""}`}
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden bg-kyar-mutedWarm mb-4">
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
                        <div className="h-[1px] bg-kyar-border w-full">
                          <div
                            className="h-full bg-black transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {b.budgetCents != null && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
                            <span>Budget</span>
                            <span>
                              {formatCents(b.totalCostCents ?? 0)} / {formatCents(b.budgetCents)}
                            </span>
                          </div>
                          <div className="h-[1px] bg-kyar-border w-full">
                            <div
                              className="h-full bg-black transition-all"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((b.totalCostCents ?? 0) / (b.budgetCents || 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          {(b.totalCostCents ?? 0) > (b.budgetCents || 0) && (
                            <p className="text-[9px] text-kyar-danger">
                              Over by {formatCents((b.totalCostCents ?? 0) - (b.budgetCents || 0))}
                            </p>
                          )}
                        </div>
                      )}
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
        </ResponsiveGrid>
      </main>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-20 left-0 right-0 z-40 px-4 py-3 bg-kyar-bgWarm border-t border-kyar-cardBorder shadow-soft flex items-center justify-between gap-4 flex-wrap"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleSetStatusSelected(value)}
                disabled={actionPending}
                className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded disabled:opacity-50"
              >
                {label}
              </button>
            ))}
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
              className="flex-1 py-2 border border-black text-sm font-medium rounded-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={actionPending}
              className="flex-1 py-2 bg-kyar-danger text-white text-sm font-medium rounded-sm disabled:opacity-50"
            >
              {actionPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </AdaptiveModal>

      <FloatingAdd />
    </WebAppShell>
  );
}
