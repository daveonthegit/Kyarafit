"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { formatEventDateRange } from "@kyarafit/design-system/domain";

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
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: Array<{
      userId: string;
      name: string;
      location?: string;
      imageUrl?: string;
      imageStorageId?: Doc<"conventions">["imageStorageId"];
      startDate: string;
      endDate: string;
    }>;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { userId, isLoading: authLoading } = useCurrentUser();
  const conventionsQuery = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const conventions = conventionsQuery ?? [];
  const archiveMany = useMutation(api.conventions.archiveMany);
  const removeMany = useMutation(api.conventions.removeMany);
  const createConvention = useMutation(api.conventions.create);
  const isLoading = authLoading || (userId !== null && conventionsQuery === undefined);
  const activeFilterLabel = FILTER_OPTIONS.find((opt) => opt.value === filter)?.label ?? "All";
  const activeSortLabel = SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label ?? "Start date";
  const controlsSummary = `${activeFilterLabel} · ${activeSortLabel} · ${order === "asc" ? "Ascending" : "Descending"}`;

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

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const UNDO_WINDOW_MS = 8000;

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
    const toDelete = conventions.filter((c) => selectedIds.has(c._id));
    const payloads = toDelete.map((c) => ({
      userId: c.userId,
      name: c.name,
      location: c.location,
      imageUrl: c.imageUrl,
      imageStorageId: c.imageStorageId,
      startDate: c.startDate,
      endDate: c.endDate,
    }));
    setActionPending(true);
    try {
      await removeMany({ ids: Array.from(selectedIds), userId });
      setShowDeleteConfirm(false);
      clearSelection();
      setShowSelectModal(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedForUndo({ count: payloads.length, payloads });
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, UNDO_WINDOW_MS);
    } finally {
      setActionPending(false);
    }
  }, [userId, selectedIds, conventions, removeMany, clearSelection]);

  const handleUndoDelete = useCallback(async () => {
    if (!userId || !deletedForUndo) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setActionPending(true);
    try {
      for (const p of deletedForUndo.payloads) {
        await createConvention({
          userId,
          name: p.name,
          location: p.location,
          imageUrl: p.imageUrl,
          imageStorageId: p.imageStorageId,
          startDate: p.startDate,
          endDate: p.endDate,
        });
      }
      setDeletedForUndo(null);
    } finally {
      setActionPending(false);
    }
  }, [userId, deletedForUndo, createConvention]);

  return (
    <WebAppShell>
      <PageHeader
        title="Events"
        subtitle="Circuit"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search events...",
          "aria-label": "Search events by name or location",
        }}
        mobileControlsLabel="Refine circuit"
        mobileControlsSummary={controlsSummary}
      >
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0 mr-2">
            Status
          </span>
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value as ConventionFilter)}
              className={`shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                filter === opt.value
                  ? "border-kyar-text bg-kyar-text text-kyar-bg shadow-md"
                  : "border-kyar-borderSubtle bg-kyar-surface text-kyar-textSecondary hover:border-kyar-text hover:bg-kyar-muted"
              }`}
              aria-pressed={filter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:justify-end">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0">
            Sort by
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ConventionSortBy)}
            className="min-h-[44px] min-w-[11rem] flex-1 border-b border-kyar-border bg-transparent py-1.5 text-[11px] uppercase tracking-wider text-kyar-text focus:border-kyar-text focus:outline-none transition-colors sm:min-w-0 sm:flex-none"
            aria-label="Sort events by"
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
            className="inline-flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-kyar-textSecondary transition-colors hover:border-kyar-text hover:text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
          >
            {order === "asc" ? "Asc" : "Desc"}
          </button>
        </div>
      </PageHeader>

      <main className="flex-1 pt-3 pb-24 sm:py-6">
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && conventions.length === 0 && (
          <EmptyState
            icon="event"
            message="No events yet."
            secondary="Create your first event to map builds onto specific days and generate a packing plan."
            action={
              <Link
                href="/conventions/new"
                className="min-h-[44px] inline-flex items-center rounded border border-kyar-text px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-kyar-text hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                New event
              </Link>
            }
          />
        )}
        {!isLoading && conventions.length > 0 && filteredAndSorted.length === 0 && (
          <EmptyState icon="search_off" message="No events match your search or filter." />
        )}
        {!isLoading && filteredAndSorted.length > 0 && (
          <>
            <div className="mb-3 sm:mb-4 flex items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                {filteredAndSorted.length} event{filteredAndSorted.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={() => setShowSelectModal(true)}
                className="px-4 py-2 border border-kyar-borderSubtle rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
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
                    className="block relative aspect-video w-full rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                    aria-label={`Open ${c.name}`}
                  >
                    {hasImage ? (
                      <ResolvedImage
                        imageStorageId={c.imageStorageId ?? undefined}
                        imageUrl={c.imageUrl ?? undefined}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                        aria-hidden
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover:scale-105 pointer-events-none">
                        <span className="material-symbols-outlined text-6xl" aria-hidden>
                          calendar_today
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-kyar-media-scrim transition-colors duration-300 pointer-events-none" />

                    <div className="absolute inset-0 p-5 flex flex-col justify-end text-kyar-media-fg pointer-events-none">
                      <div className="flex justify-between items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold tracking-[0.2em] uppercase block mb-1 drop-shadow-sm">
                            {formatEventDateRange(c.startDate, c.endDate)}
                          </span>
                          <h3 className="font-serif text-2xl lg:text-3xl font-normal italic tracking-tight leading-none truncate text-kyar-media-fg drop-shadow-md transition-opacity group-hover:opacity-90">
                            {c.name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm truncate">
                          {c.location || "No location"}
                        </span>
                        {days !== null && days >= 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-kyar-media-ring" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-kyar-media-fg drop-shadow-sm">
                              {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                            </span>
                          </>
                        )}
                      </div>
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
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-kyar-text rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors"
            >
              {selectedIds.size === filteredAndSorted.length ? "Deselect all" : "Select all"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100 transition-opacity"
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
                      className="w-5 h-5 rounded-sm border-2 border-kyar-text bg-kyar-surface accent-kyar-accent focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
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
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-kyar-text rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors disabled:opacity-50"
                >
                  Archive
                </button>
              )}
              {filter === "archived" && (
                <button
                  type="button"
                  onClick={() => handleArchiveSelected(false)}
                  disabled={actionPending}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-kyar-text rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors disabled:opacity-50"
                >
                  Unarchive
                </button>
              )}
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
                Clear selection
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSelectModal(false)}
            className="mt-4 w-full py-3 bg-kyar-text text-kyar-bg text-sm font-bold uppercase tracking-wider rounded-full hover:opacity-90 transition-opacity"
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
            {deletedForUndo.count} convention{deletedForUndo.count !== 1 ? "s" : ""} deleted
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
