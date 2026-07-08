"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
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
  // conventions are sync-backed (`...syncMetaFields` in convex/schema.ts) — read/write through the
  // offline bridge so the list paints from cache and edits queue while offline.
  const conventionsQuery = useOfflineQuery(api.conventions.list, userId ? { userId } : "skip");
  const conventions = conventionsQuery ?? [];
  const upcomingWithCounts = useOfflineQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 1 } : "skip"
  );
  const archiveMany = useOfflineMutation(api.conventions.archiveMany);
  const removeMany = useOfflineMutation(api.conventions.removeMany);
  const createConvention = useOfflineMutation(api.conventions.create);
  const isLoading = authLoading || (userId !== null && conventionsQuery === undefined);

  /** Next upcoming convention (backs the page photo + featured block, 6e). */
  const nextEntry = upcomingWithCounts?.[0];
  const nextEvent = nextEntry?.convention;
  const nextDays = nextEvent ? daysUntil(nextEvent.startDate) : null;

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
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={nextEvent?.imageStorageId}
          imageUrl={nextEvent?.imageUrl}
          scrimRight="strong"
        />

        <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-12 pb-6 min-h-0">
          {/* Featured next event (6e) */}
          <section className="flex-1 min-w-0 max-w-[640px] lg:self-start lg:mt-6">
            {nextEvent ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  Next · {formatEventDateRange(nextEvent.startDate, nextEvent.endDate)}
                  {nextEvent.location ? ` · ${nextEvent.location}` : ""}
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[84px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  {nextEvent.name}
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {nextDays !== null && nextDays >= 0 && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                      Countdown ·{" "}
                      {nextDays === 0 ? "Today" : nextDays === 1 ? "Tomorrow" : `${nextDays} days`}
                    </span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                    Builds · {nextEntry?.outfitCount ?? 0} planned
                  </span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/conventions/${nextEvent._id}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Day plans
                  </Link>
                  <Link
                    href={`/conventions/${nextEvent._id}/packing`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border-strong bg-glass-bar px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    Packing list
                  </Link>
                </div>
              </>
            ) : !isLoading ? (
              <>
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  The season
                </span>
                <h1 className="font-serif italic font-normal text-[40px] lg:text-[64px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                  No events on the calendar.
                </h1>
              </>
            ) : null}
          </section>

          {/* The season — right glass panel (6e) */}
          <section
            className="w-full lg:w-[480px] shrink-0 flex flex-col self-start bg-glass backdrop-blur-glass border border-glass-border rounded-glass min-h-0 lg:max-h-[calc(100dvh-140px)]"
            aria-label="All events"
          >
            <div className="px-5 py-4 border-b border-glass-divider-strong">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                  The season · {new Date().getFullYear()}
                </span>
                <div className="flex-1" />
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilter(opt.value as ConventionFilter)}
                    className={`text-[9px] uppercase tracking-[0.16em] pb-0.5 border-b transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                      filter === opt.value
                        ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                        : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                    }`}
                    aria-pressed={filter === opt.value}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events..."
                  aria-label="Search events by name or location"
                  className="glass-field flex-1 min-w-[140px] px-3 py-2 text-[13px]"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ConventionSortBy)}
                  className="glass-field min-h-[40px] px-3 py-2 text-[10px] uppercase tracking-[0.14em]"
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
                  className="inline-flex min-h-[40px] items-center rounded-full border border-glass-border-strong px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg opacity-60 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
                >
                  {order === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
            </div>

            <main className="flex-1 min-h-0 overflow-y-auto">
              {isLoading && (
                <EmptyState surface="glass" icon="hourglass_empty" message="Loading…" />
              )}
              {!isLoading && conventions.length === 0 && (
                <EmptyState
                  surface="glass"
                  icon="festival"
                  message="No events yet."
                  secondary="Create your first event to map builds onto specific days and generate a packing plan."
                />
              )}
              {!isLoading && conventions.length > 0 && filteredAndSorted.length === 0 && (
                <EmptyState
                  surface="glass"
                  icon="search_off"
                  message="No events match your search or filter."
                />
              )}
              {!isLoading &&
                filteredAndSorted.map((c) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const upcoming = c.endDate >= today;
                  const days = upcoming ? daysUntil(c.startDate) : null;
                  const isNext = nextEvent?._id === c._id;
                  const hasImage = c.imageStorageId != null || c.imageUrl != null;
                  return (
                    <Link
                      key={c._id}
                      href={`/conventions/${c._id}`}
                      className={`flex items-center gap-4 px-5 py-3.5 border-b border-glass-divider transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        upcoming ? "" : "opacity-60"
                      }`}
                      aria-label={`Open ${c.name}`}
                    >
                      <div className="h-[52px] w-[42px] shrink-0 overflow-hidden rounded-lg border border-glass-border bg-glass-active">
                        {hasImage ? (
                          <ResolvedImage
                            imageStorageId={c.imageStorageId ?? undefined}
                            imageUrl={c.imageUrl ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                            aria-hidden
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-media-fg-45">
                            <span className="material-symbols-outlined text-lg" aria-hidden>
                              festival
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-serif italic text-[17px] leading-tight truncate">
                          {c.name}
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 truncate">
                          {formatEventDateRange(c.startDate, c.endDate)}
                          {c.location ? ` · ${c.location}` : ""}
                        </p>
                      </div>
                      {isNext && days !== null && days >= 0 ? (
                        <span className="shrink-0 rounded-full bg-on-glass-chip-active-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-active-fg">
                          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                        </span>
                      ) : days !== null && days >= 0 ? (
                        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
                          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                        </span>
                      ) : null}
                      <span
                        className="material-symbols-outlined shrink-0 text-[16px] opacity-50"
                        aria-hidden
                      >
                        chevron_right
                      </span>
                    </Link>
                  );
                })}
            </main>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 border-t border-glass-divider-strong">
              <Link
                href="/conventions/new"
                className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                <span className="border-b border-glass-border-strong pb-0.5">Add an event ▸</span>
              </Link>
              <div className="flex-1" />
              {filteredAndSorted.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSelectModal(true)}
                  className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Select for actions
                </button>
              )}
            </div>
          </section>
        </div>

        <AdaptiveModal
          open={showSelectModal}
          onClose={() => setShowSelectModal(false)}
          aria-labelledby="conventions-select-dialog-title"
        >
          <div className="p-6">
            <h2 id="conventions-select-dialog-title" className="font-serif italic text-lg mb-2">
              Select conventions
            </h2>
            <p className="text-sm text-media-fg-70 mb-4">
              Choose conventions to archive, unarchive, or delete. Same list as current filter.
            </p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={selectAll}
                className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors"
              >
                {selectedIds.size === filteredAndSorted.length ? "Deselect all" : "Select all"}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] opacity-70 hover:opacity-100 transition-opacity"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto border border-glass-border rounded-[10px] divide-y divide-glass-divider">
              {filteredAndSorted.map((c) => {
                const isSelected = selectedIds.has(c._id);
                return (
                  <li key={c._id}>
                    <label className="flex items-center gap-3 py-3 px-3 cursor-pointer hover:bg-glass-active">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c._id)}
                        className="w-5 h-5 rounded-sm border-2 border-media-fg-45 bg-transparent accent-kyar-accent focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
                        aria-label={`Select ${c.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-serif italic text-kyar-media-fg block truncate">
                          {c.name}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                          {c.startDate} – {c.endDate}
                          {c.location ? ` · ${c.location}` : ""}
                        </span>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-media-fg-70 mt-3">{selectedIds.size} selected</p>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-glass-divider">
                {filter !== "archived" && (
                  <button
                    type="button"
                    onClick={() => handleArchiveSelected(true)}
                    disabled={actionPending}
                    className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors disabled:opacity-50"
                  >
                    Archive
                  </button>
                )}
                {filter === "archived" && (
                  <button
                    type="button"
                    onClick={() => handleArchiveSelected(false)}
                    disabled={actionPending}
                    className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors disabled:opacity-50"
                  >
                    Unarchive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={actionPending}
                  className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger border border-on-glass-danger rounded-full hover:bg-on-glass-danger/10 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-4 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-[0.16em] opacity-70 hover:opacity-100 transition-opacity"
                >
                  Clear selection
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSelectModal(false)}
              className="mt-4 w-full min-h-[44px] py-3 bg-glass-solid text-glass-ink text-[10px] font-bold uppercase tracking-[0.16em] rounded-full hover:opacity-90 transition-opacity"
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
            <h2 id="conventions-delete-dialog-title" className="font-serif italic text-lg mb-2">
              Delete {selectedIds.size} convention{selectedIds.size !== 1 ? "s" : ""}?
            </h2>
            <p className="text-sm text-media-fg-70 mb-6">
              Day plans and packing lists for these conventions will be removed. This cannot be
              undone.
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
              {deletedForUndo.count} convention{deletedForUndo.count !== 1 ? "s" : ""} deleted
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
