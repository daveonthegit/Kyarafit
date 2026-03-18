"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { FilterToolbar } from "@/components/layout/FilterToolbar";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { ResponsivePanel } from "@/components/layout/ResponsivePanel";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { CLOSET_CATEGORIES } from "@kyarafit/design-system/types";
import type { Id } from "convex/_generated/dataModel";

type SortBy = "name" | "category" | "cost" | "status";
type SortOrder = "asc" | "desc";

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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"closetItems">>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignToBuildPanel, setShowAssignToBuildPanel] = useState(false);
  const [showUnassignFromBuildPanel, setShowUnassignFromBuildPanel] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const removeMany = useMutation(api.closetItems.removeMany);
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
  const items = useQuery(api.closetItems.list, listArgs) ?? [];
  const isLoading = items === undefined;
  const hasSearch = search.trim().length > 0;

  const toggleSelect = useCallback((id: Id<"closetItems">) => {
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
        breadcrumb={[{ label: "Builds", href: "/builds" }, { label: "Closet" }]}
        title="The Closet"
        primaryAction={{ label: "Add item", href: "/closet/new" }}
      />

      <FilterToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by name, notes, or tags…",
          "aria-label": "Search closet by name, notes, or tags",
        }}
        filtersLabel="Filters"
      >
        <div className="flex items-center gap-2 flex-wrap overflow-x-auto no-scrollbar pb-1 -mx-1 sm:overflow-visible sm:mx-0">
          <span className="text-[10px] uppercase tracking-widest text-kyar-meta shrink-0">
            Category
          </span>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setCategory(opt.value)}
              className={`shrink-0 min-h-[44px] px-3 py-2 text-[10px] font-medium uppercase tracking-wider rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
                category === opt.value
                  ? "border-black bg-black text-white"
                  : "border-kyar-border bg-kyar-surfaceWarm text-kyar-text hover:border-kyar-text"
              }`}
              aria-pressed={category === opt.value}
              aria-label={`Filter by ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label
          htmlFor="closet-sort"
          className="text-[10px] uppercase tracking-widest text-kyar-meta sm:flex sm:items-center shrink-0"
        >
          Sort by
        </label>
        <select
          id="closet-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="min-h-[44px] text-sm border border-kyar-border rounded-sm px-3 py-2.5 bg-kyar-surfaceWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
          aria-label="Sort closet items by"
        >
          <option value="name">Name</option>
          <option value="category">Category</option>
          <option value="cost">Cost</option>
          <option value="status">Completion status</option>
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
        {isLoading && <EmptyState icon="hourglass_empty" message="Loading…" />}
        {!isLoading && items.length === 0 && !hasSearch && (
          <EmptyState
            icon="checkroom"
            message="No items yet."
            secondary="Add pieces to your digital closet."
            action={
              <Link
                href="/closet/new"
                className="min-h-[44px] inline-flex items-center text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2.5 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              >
                Add item
              </Link>
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
                  <div key={item._id} className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1 right-1 z-10 w-4 h-4 rounded-sm border-2 border-black bg-white/90 focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
                      aria-label={`Select ${item.name}`}
                    />
                    <Link
                      href={`/closet/${item._id}`}
                      className={`flex flex-col gap-2 block rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm shadow-card overflow-hidden hover:border-kyar-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
                        isSelected ? "ring-2 ring-black ring-offset-2" : ""
                      }`}
                      aria-label={`View ${item.name}`}
                    >
                      <div className="aspect-square bg-kyar-mutedWarm overflow-hidden relative">
                        {item.imageStorageId || item.imageUrl ? (
                          <ResolvedImage
                            imageStorageId={item.imageStorageId}
                            imageUrl={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                            <span className="material-symbols-outlined text-4xl" aria-hidden>
                              checkroom
                            </span>
                          </div>
                        )}
                        <span
                          className="absolute top-2 right-2 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-sm bg-kyar-bgWarm/90 border border-kyar-cardBorder"
                          aria-hidden
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 p-3">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-[10px] uppercase tracking-wider font-semibold truncate min-w-0">
                            {item.name}
                          </h3>
                          <span className="text-[9px] text-kyar-meta shrink-0">
                            {item.category}
                          </span>
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
          className="fixed bottom-20 left-0 right-0 z-40 px-4 py-3 bg-kyar-bgWarm border-t border-kyar-cardBorder shadow-soft flex items-center justify-between gap-4 flex-wrap"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAssignToBuildPanel(true)}
              disabled={actionPending}
              className="px-3 py-1.5 text-xs font-medium uppercase border border-black rounded disabled:opacity-50"
            >
              Assign to build
            </button>
            <button
              type="button"
              onClick={() => setShowUnassignFromBuildPanel(true)}
              disabled={actionPending}
              className="px-3 py-1.5 text-xs font-medium uppercase border border-kyar-border rounded hover:border-black disabled:opacity-50"
            >
              Unassign from build
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

      <FloatingAdd />
    </WebAppShell>
  );
}
