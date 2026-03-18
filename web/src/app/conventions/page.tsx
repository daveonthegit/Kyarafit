"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";

type ConventionFilter = "all" | "upcoming" | "past" | "archived";
type ConventionSortBy = "name" | "startDate" | "location";
type SortOrder = "asc" | "desc";

const FILTER_OPTIONS: { value: ConventionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { value: ConventionSortBy; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "startDate", label: "Start date" },
  { value: "location", label: "Location" },
];

function daysUntil(startDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(startDate).toISOString().slice(0, 10);
  return Math.ceil((new Date(start).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
}

function filterAndSortConventions(
  conventions: Doc<"conventions">[],
  search: string,
  filter: ConventionFilter,
  sortBy: ConventionSortBy,
  order: SortOrder
): Doc<"conventions">[] {
  const today = new Date().toISOString().slice(0, 10);
  const q = search.trim().toLowerCase();
  const isArchived = (c: Doc<"conventions">) => c.archived === true;

  let list = conventions.filter((c) => {
    if (filter === "archived") {
      if (!isArchived(c)) return false;
    } else {
      if (isArchived(c)) return false;
      if (filter === "upcoming" && c.endDate < today) return false;
      if (filter === "past" && c.endDate >= today) return false;
    }
    if (q && !c.name.toLowerCase().includes(q) && !(c.location ?? "").toLowerCase().includes(q))
      return false;
    return true;
  });

  const mult = order === "asc" ? 1 : -1;
  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.name.localeCompare(b.name);
    else if (sortBy === "startDate") cmp = a.startDate.localeCompare(b.startDate);
    else if (sortBy === "location") cmp = (a.location ?? "").localeCompare(b.location ?? "");
    return mult * cmp;
  });

  return list;
}

export default function ConventionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConventionFilter>("all");
  const [sortBy, setSortBy] = useState<ConventionSortBy>("startDate");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"conventions">>>(new Set());
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const { userId } = useCurrentUser();
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip") ?? [];
  const archiveMany = useMutation(api.conventions.archiveMany);
  const removeMany = useMutation(api.conventions.removeMany);
  const isLoading = conventions === undefined;

  const filteredAndSorted = useMemo(
    () => filterAndSortConventions(conventions, search, filter, sortBy, order),
    [conventions, search, filter, sortBy, order]
  );

  const toggleSelect = useCallback((id: Id<"conventions">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (filteredAndSorted.length === 0) return prev;
      if (prev.size === filteredAndSorted.length) return new Set();
      return new Set(filteredAndSorted.map((c) => c._id));
    });
  }, [filteredAndSorted]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleArchiveSelected = useCallback(
    async (archived: boolean) => {
      if (!userId || selectedIds.size === 0) return;
      setActionPending(true);
      try {
        await archiveMany({ ids: Array.from(selectedIds), userId, archived });
        clearSelection();
        setShowSelectModal(false);
      } finally {
        setActionPending(false);
      }
    },
    [userId, selectedIds, archiveMany, clearSelection]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await removeMany({ ids: Array.from(selectedIds), userId });
      setShowDeleteConfirm(false);
      clearSelection();
      setShowSelectModal(false);
    } finally {
      setActionPending(false);
    }
  }, [userId, selectedIds, removeMany, clearSelection]);

  return (
    <WebAppShell>
      <PageHeader
        title="Conventions"
        subtitle="Circuit"
        primaryAction={{ label: "New Convention", href: "/conventions/new" }}
      />

      <FilterToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by name or location…",
          "aria-label": "Search conventions by name or location",
        }}
        filtersLabel="Filters"
      >
        <label htmlFor="convention-filter" className="sr-only">
          Filter conventions
        </label>
        <select
          id="convention-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ConventionFilter)}
          className="min-h-[44px] min-w-[140px] text-sm border border-kyar-border rounded-sm px-3 py-2.5 bg-kyar-surfaceWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm uppercase tracking-widest"
          aria-label="Filter conventions"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label
          htmlFor="convention-sort"
          className="text-[10px] uppercase tracking-widest text-kyar-meta sm:flex sm:items-center"
        >
          Sort by
        </label>
        <select
          id="convention-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ConventionSortBy)}
          className="min-h-[44px] text-sm border border-kyar-border rounded-sm px-3 py-2.5 bg-kyar-surfaceWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
          aria-label="Sort conventions by"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
          className="min-h-[44px] min-w-[44px] inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border border-kyar-border rounded-sm bg-kyar-surfaceWarm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
          aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            {order === "asc" ? "arrow_upward" : "arrow_downward"}
          </span>
          <span className="text-[10px] uppercase">{order}</span>
        </button>
      </FilterToolbar>

      <main className="flex-1 py-6">
        {isLoading && <p className="meta-label text-kyar-meta">Loading...</p>}
        {!isLoading && conventions.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No conventions yet. Create one to plan days and generate packing lists.
          </p>
        )}
        {!isLoading && conventions.length > 0 && filteredAndSorted.length === 0 && (
          <p className="text-sm text-kyar-textTertiary">
            No conventions match your search or filter.
          </p>
        )}
        {!isLoading && filteredAndSorted.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                {filteredAndSorted.length} convention{filteredAndSorted.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setShowSelectModal(true)}
                className="min-h-[44px] inline-flex items-center text-[10px] uppercase tracking-widest font-medium underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
              >
                Select for actions
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSorted.map((c) => {
                const days =
                  c.endDate >= new Date().toISOString().slice(0, 10)
                    ? daysUntil(c.startDate)
                    : null;
                const hasImage = c.imageStorageId != null || c.imageUrl != null;
                return (
                  <Link
                    key={c._id}
                    href={`/conventions/${c._id}`}
                    className="block rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm shadow-card overflow-hidden hover:border-kyar-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                  >
                    {hasImage ? (
                      <div className="aspect-[21/9] w-full bg-kyar-mutedWarm">
                        <ResolvedImage
                          imageStorageId={c.imageStorageId ?? undefined}
                          imageUrl={c.imageUrl ?? undefined}
                          alt={c.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="p-4">
                      <h2 className="font-serif text-lg italic font-normal text-kyar-text">
                        {c.name}
                      </h2>
                      <p className="text-xs text-kyar-meta mt-1">
                        {c.startDate === c.endDate ? c.startDate : `${c.startDate} – ${c.endDate}`}
                        {c.location ? ` · ${c.location}` : ""}
                      </p>
                      {days !== null && days >= 0 && (
                        <p className="text-[10px] uppercase tracking-wider text-kyar-textTertiary mt-1">
                          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </main>

      <AdaptiveModal
        open={showSelectModal}
        onClose={() => setShowSelectModal(false)}
        aria-labelledby="conventions-select-dialog-title"
      >
        <div className="p-6">
          <h2 id="conventions-select-dialog-title" className="font-serif text-lg font-bold mb-2">
            Select conventions
          </h2>
          <p className="text-sm text-kyar-meta mb-4">
            Choose conventions to archive, unarchive, or delete. Same list as current filter.
          </p>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded"
            >
              {selectedIds.size === filteredAndSorted.length ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium uppercase opacity-70"
            >
              Clear
            </button>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto border border-kyar-borderSubtle rounded-sm divide-y divide-kyar-borderSubtle">
            {filteredAndSorted.map((c) => {
              const isSelected = selectedIds.has(c._id);
              return (
                <li key={c._id}>
                  <label className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-kyar-muted/50">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(c._id)}
                      className="w-5 h-5 rounded-sm border-2 border-black bg-white focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
                      aria-label={`Select ${c.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-serif font-bold italic text-kyar-text block truncate">
                        {c.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                        {c.startDate} – {c.endDate}
                        {c.location ? ` · ${c.location}` : ""}
                      </span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-kyar-meta mt-3">{selectedIds.size} selected</p>
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-kyar-borderSubtle">
              {filter !== "archived" && (
                <button
                  type="button"
                  onClick={() => handleArchiveSelected(true)}
                  disabled={actionPending}
                  className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded disabled:opacity-50"
                >
                  Archive
                </button>
              )}
              {filter === "archived" && (
                <button
                  type="button"
                  onClick={() => handleArchiveSelected(false)}
                  disabled={actionPending}
                  className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded disabled:opacity-50"
                >
                  Unarchive
                </button>
              )}
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
                Clear selection
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSelectModal(false)}
            className="mt-4 w-full py-2.5 bg-black text-white text-sm font-medium uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      </AdaptiveModal>

      <AdaptiveModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        aria-labelledby="conventions-delete-dialog-title"
      >
        <div className="p-6">
          <h2 id="conventions-delete-dialog-title" className="font-serif text-lg font-bold mb-2">
            Delete {selectedIds.size} convention{selectedIds.size !== 1 ? "s" : ""}?
          </h2>
          <p className="text-sm text-kyar-meta mb-6">
            Day plans and packing lists for these conventions will be removed. This cannot be
            undone.
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
      </AdaptiveModal>
    </WebAppShell>
  );
}
