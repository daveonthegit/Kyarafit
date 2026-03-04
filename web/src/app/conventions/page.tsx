"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CardAccordion, type CardAccordionItem } from "@/components/ui/card-accordion";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
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

function toAccordionItem(c: Doc<"conventions">): CardAccordionItem {
  return {
    id: c._id,
    title: c.name,
    subtitle: [c.startDate, c.endDate].join(" – ") + (c.location ? ` · ${c.location}` : ""),
    imageUrl: c.imageUrl ?? null,
    imageStorageId: c.imageStorageId ?? null,
  };
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
    else if (sortBy === "location")
      cmp = (a.location ?? "").localeCompare(b.location ?? "");
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
  const accordionItems = useMemo(
    () => filteredAndSorted.map(toAccordionItem),
    [filteredAndSorted]
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
        <p className="meta-label mb-1">Circuit</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight italic">Conventions</h1>
      </header>

      <nav className="sticky top-[88px] z-30 bg-white/95 backdrop-blur-sm pt-2 pb-4 space-y-4 border-b border-kyar-borderSubtle">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
          <label htmlFor="convention-filter" className="sr-only">
            Filter conventions
          </label>
          <select
            id="convention-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ConventionFilter)}
            className="w-full sm:w-auto min-w-[140px] text-sm border border-kyar-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 uppercase tracking-widest"
            aria-label="Filter conventions"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label htmlFor="convention-search" className="sr-only">
            Search conventions by name or location
          </label>
          <input
            id="convention-search"
            type="search"
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-kyar-border rounded-md focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Search conventions by name or location"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="convention-sort" className="text-[10px] uppercase tracking-widest text-kyar-meta">
              Sort by
            </label>
            <select
              id="convention-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ConventionSortBy)}
              className="text-sm border border-kyar-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20"
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
              className="text-sm border border-kyar-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20 flex items-center gap-1"
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

      <main className="flex-1 py-6">
        <Link
          href="/conventions/new"
          className="block w-full bg-black text-white text-center py-3.5 text-[11px] font-bold uppercase tracking-wider mb-8"
        >
          NEW CONVENTION
        </Link>

        {isLoading && <p className="meta-label">Loading...</p>}
        {!isLoading && conventions.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No conventions yet. Create one to plan days and generate packing lists.
          </p>
        )}
        {!isLoading && conventions.length > 0 && accordionItems.length === 0 && (
          <p className="text-sm text-kyar-textTertiary">
            No conventions match your search or filter.
          </p>
        )}
        {!isLoading && accordionItems.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                {accordionItems.length} convention{accordionItems.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setShowSelectModal(true)}
                className="text-[10px] uppercase tracking-widest font-medium underline"
              >
                Select for actions
              </button>
            </div>
            <CardAccordion
              items={accordionItems}
              getHref={(item) => `/conventions/${item.id}`}
              defaultActiveIndex={Math.min(1, Math.floor(accordionItems.length / 2))}
              panelHeight={380}
              expandedWidth={320}
              collapsedWidth={56}
            />
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
          <ul className="max-h-[50vh] overflow-y-auto border border-kyar-borderSubtle rounded-md divide-y divide-kyar-borderSubtle">
            {filteredAndSorted.map((c) => {
              const isSelected = selectedIds.has(c._id);
              return (
                <li key={c._id}>
                  <label className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-kyar-muted/50">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(c._id)}
                      className="w-5 h-5 rounded border-2 border-black bg-white focus:ring-2 focus:ring-black/30"
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
          <p className="text-xs text-kyar-meta mt-3">
            {selectedIds.size} selected
          </p>
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
