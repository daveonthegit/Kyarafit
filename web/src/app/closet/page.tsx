"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { api } from "convex/_generated/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { CLOSET_CATEGORIES } from "@kyarafit/design-system/types";
import type { Id } from "convex/_generated/dataModel";

type SortBy = "name" | "category" | "cost" | "status";
type SortOrder = "asc" | "desc";
type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;
type ClosetViewItem = {
  _id: ClosetEntityId;
  _creationTime?: number;
  name: string;
  userId?: string;
  category?: string;
  tags: string[];
  notes?: string;
  imageUrl?: string;
  imageStorageId?: Id<"_storage">;
  itemLink?: string;
  costCents?: number;
  status?: string;
  completionTaskId?: Id<"buildTasks"> | null;
};
type ClosetUndoPayload = Omit<ClosetViewItem, "_id" | "_creationTime">;

function statusLabel(s: string | undefined): string {
  if (s === "in_progress") return "In progress";
  if (s === "complete") return "Complete";
  return "Planned";
}

const CATEGORY_OPTIONS = [
  { value: "", label: "All items" },
  ...CLOSET_CATEGORIES.map((c) => ({
    value: c,
    label: c.charAt(0).toUpperCase() + c.slice(1),
  })),
];

export default function ClosetPage() {
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<ClosetEntityId>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignToBuildPanel, setShowAssignToBuildPanel] = useState(false);
  const [showUnassignFromBuildPanel, setShowUnassignFromBuildPanel] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: ClosetUndoPayload[];
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeMany = useMutation(api.closetItems.removeMany);
  const createItem = useMutation(api.closetItems.create);
  const addItemsToBuild = useMutation(api.builds.addItemsToBuild);
  const removeItemsFromBuild = useMutation(api.builds.removeItemsFromBuild);
  const allBuilds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const listArgs = userId
    ? {
        userId,
        category: category.trim() || undefined,
        search: search.trim() || undefined,
        sortBy,
        order,
      }
    : "skip";
  const items = (useQuery(api.closetItems.list, listArgs) ?? []) as ClosetViewItem[];
  const isLoading = items === undefined;
  const hasSearch = search.trim().length > 0;

  const toggleSelect = useCallback((id: ClosetEntityId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.length === 0) return prev;
      if (prev.size === items.length) return new Set();
      return new Set(items.map((i) => i._id));
    });
  }, [items]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const UNDO_WINDOW_MS = 8000;

  const handleDeleteSelected = async () => {
    if (!userId || selectedIds.size === 0) return;
    const toDelete = items.filter((i) => selectedIds.has(i._id));
    const payloads = toDelete.map((item) => {
      const { _id, _creationTime, completionTaskId: _completionTaskId, ...rest } = item;
      return rest;
    });
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
        await createItem({
          userId,
          name: p.name,
          category: p.category ?? "other",
          tags: p.tags,
          notes: p.notes,
          imageUrl: p.imageUrl,
          imageStorageId: p.imageStorageId,
          itemLink: p.itemLink ?? undefined,
          costCents: p.costCents,
          status: p.status,
        });
      }
      setDeletedForUndo(null);
    } finally {
      setActionPending(false);
    }
  }, [userId, deletedForUndo, createItem]);

  const handleAssignToBuild = async (buildId: Id<"builds">) => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await addItemsToBuild({
        userId,
        buildId,
        closetItemIds: Array.from(selectedIds),
      });
      setShowAssignToBuildPanel(false);
      clearSelection();
    } finally {
      setActionPending(false);
    }
  };

  const handleUnassignFromBuild = async (buildId: Id<"builds">) => {
    if (!userId || selectedIds.size === 0) return;
    setActionPending(true);
    try {
      await removeItemsFromBuild({
        userId,
        buildId,
        closetItemIds: Array.from(selectedIds),
      });
      setShowUnassignFromBuildPanel(false);
      clearSelection();
    } finally {
      setActionPending(false);
    }
  };

  return (
    <WebAppShell>
      <PageHeader
        title="Cosplay Elements"
        subtitle={items.length > 0 ? `${items.length} elements curated in the atelier` : undefined}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search elements...",
          "aria-label": "Search cosplay elements by name, notes, or tags",
        }}
      >
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto no-scrollbar pb-1 -mx-1 sm:overflow-visible sm:mx-0">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0 mr-2">
            Category
          </span>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setCategory(opt.value)}
              className={`shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                category === opt.value
                  ? "border-black bg-black text-white shadow-md"
                  : "border-kyar-borderSubtle bg-kyar-surface text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
              }`}
              aria-pressed={category === opt.value}
              aria-label={`Filter by ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <label
            htmlFor="closet-sort"
            className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0"
          >
            Sort by
          </label>
          <select
            id="closet-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[11px] uppercase tracking-wider border-b border-kyar-border py-1.5 bg-transparent focus:outline-none focus:border-kyar-text transition-colors"
            aria-label="Sort cosplay elements by"
          >
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="cost">Cost</option>
            <option value="status">Status</option>
          </select>
          <button
            type="button"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center text-kyar-meta hover:text-black transition-colors focus:outline-none"
            aria-label={order === "asc" ? "Sort ascending" : "Sort descending"}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              {order === "asc" ? "arrow_upward" : "arrow_downward"}
            </span>
          </button>
        </div>
      </PageHeader>

      <main className="flex-1 py-6">
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && items.length === 0 && !hasSearch && (
          <EmptyState
            icon="checkroom"
            message="No items yet."
            secondary="Add pieces to your cosplay library."
            action={
              <button
                type="button"
                onClick={() => openCreationModal("newCloset")}
                className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-black px-6 py-2.5 rounded-full hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              >
                Add element
              </button>
            }
          />
        )}
        {!isLoading && items.length === 0 && hasSearch && (
          <EmptyState icon="search_off" message="No items match your search." />
        )}
        {!isLoading && items.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest opacity-50">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </p>
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] uppercase tracking-widest font-medium underline"
              >
                {selectedIds.size === items.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <ResponsiveGrid className="gap-3">
              {items.map((item) => {
                const isSelected = selectedIds.has(item._id);
                return (
                  <div key={item._id} className="relative group">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full border border-white/50 bg-black/20 checked:bg-black checked:border-black focus:ring-2 focus:ring-white focus:ring-offset-0 transition-all active:scale-90 shadow-sm backdrop-blur-sm cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100"
                      aria-label={`Select ${item.name}`}
                    />
                    <Link
                      href={`/closet/${item._id}`}
                      className={`block relative aspect-square w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded-2xl border shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all ${
                        isSelected
                          ? "ring-2 ring-black border-black"
                          : "border-kyar-borderSubtle bg-kyar-muted"
                      }`}
                      aria-label={`View ${item.name}`}
                    >
                      {item.imageStorageId || item.imageUrl ? (
                        <ResolvedImage
                          imageStorageId={item.imageStorageId}
                          imageUrl={item.imageUrl}
                          alt={item.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover:scale-105">
                          <span className="material-symbols-outlined text-4xl" aria-hidden>
                            checkroom
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

                      <span
                        className="absolute top-3 left-3 px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 shadow-sm"
                        aria-hidden
                      >
                        {statusLabel(item.status)}
                      </span>

                      <div className="absolute inset-0 p-4 flex flex-col justify-end text-white">
                        <div className="flex justify-between items-end gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase block mb-1">
                              {item.category}
                            </span>
                            <h3 className="font-serif text-2xl lg:text-3xl font-normal italic tracking-tight leading-none group-hover:text-kyar-accent transition-colors truncate drop-shadow-sm">
                              {item.name}
                            </h3>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </ResponsiveGrid>
          </>
        )}
      </main>

      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-6 py-4 bg-kyar-surface border border-kyar-borderSubtle shadow-lg flex items-center justify-between gap-6 flex-wrap rounded-full w-[90%] max-w-3xl"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAssignToBuildPanel(true)}
              disabled={actionPending}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-black rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
            >
              Assign to build
            </button>
            <button
              type="button"
              onClick={() => setShowUnassignFromBuildPanel(true)}
              disabled={actionPending}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border border-kyar-borderSubtle rounded-full hover:border-black transition-colors disabled:opacity-50"
            >
              Unassign from build
            </button>
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
        aria-labelledby="closet-delete-dialog-title"
      >
        <div className="p-6">
          <h2 id="closet-delete-dialog-title" className="font-serif text-lg font-bold mb-2">
            Delete {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""}?
          </h2>
          <p className="text-sm text-kyar-meta mb-6">This cannot be undone.</p>
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

      <ResponsivePanel
        open={showAssignToBuildPanel}
        onClose={() => setShowAssignToBuildPanel(false)}
        title="Assign to build"
      >
        <p className="text-sm text-kyar-textTertiary mb-4">
          Add {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""} to a build.
        </p>
        <div className="space-y-2">
          {allBuilds.length === 0 ? (
            <p className="text-sm text-kyar-textTertiary">No builds yet. Create a build first.</p>
          ) : (
            allBuilds.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => handleAssignToBuild(b._id)}
                disabled={actionPending}
                className="w-full flex items-center justify-between gap-3 p-3 border border-kyar-border hover:border-black transition text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium truncate">{b.name}</span>
                <span className="text-[10px] uppercase tracking-wider shrink-0">Add</span>
              </button>
            ))
          )}
        </div>
      </ResponsivePanel>

      <ResponsivePanel
        open={showUnassignFromBuildPanel}
        onClose={() => setShowUnassignFromBuildPanel(false)}
        title="Unassign from build"
      >
        <p className="text-sm text-kyar-textTertiary mb-4">
          Remove {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""} from a build.
        </p>
        <div className="space-y-2">
          {allBuilds.length === 0 ? (
            <p className="text-sm text-kyar-textTertiary">No builds yet.</p>
          ) : (
            allBuilds.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => handleUnassignFromBuild(b._id)}
                disabled={actionPending}
                className="w-full flex items-center justify-between gap-3 p-3 border border-kyar-border hover:border-black transition text-left disabled:opacity-50"
              >
                <span className="text-sm font-medium truncate">{b.name}</span>
                <span className="text-[10px] uppercase tracking-wider shrink-0">Remove</span>
              </button>
            ))
          )}
        </div>
      </ResponsivePanel>

      {deletedForUndo && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-kyar-text text-kyar-bg rounded-full border border-kyar-border shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-medium">
            {deletedForUndo.count} item{deletedForUndo.count !== 1 ? "s" : ""} deleted
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
