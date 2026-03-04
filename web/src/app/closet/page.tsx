"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
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
  const [actionPending, setActionPending] = useState(false);
  const removeMany = useMutation(api.closetItems.removeMany);

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

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/builds">
            <span className="material-symbols-outlined font-light">arrow_back</span>
          </Link>
          <p className="meta-label">Builds / Closet</p>
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight italic">The Closet</h1>
      </header>

      <nav className="sticky top-[108px] z-30 bg-white/95 backdrop-blur-sm pt-2 pb-4 space-y-4 border-b border-kyar-borderSubtle overflow-visible max-h-none">
        <div className="space-y-3">
          <label htmlFor="closet-search" className="sr-only">
            Search closet by name, notes, or tags
          </label>
          <input
            id="closet-search"
            type="search"
            placeholder="Search by name, notes, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black/20"
            aria-label="Search closet by name, notes, or tags"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="closet-category"
              className="text-[10px] uppercase tracking-widest opacity-70"
            >
              Category
            </label>
            <select
              id="closet-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20 min-w-[120px]"
              aria-label="Filter by category"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label
              htmlFor="closet-sort"
              className="text-[10px] uppercase tracking-widest opacity-70"
            >
              Sort by
            </label>
            <select
              id="closet-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-black/20"
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

      <main className="flex-1 py-6">
        {isLoading && <p className="text-[12px] opacity-50">Loading...</p>}
        {!isLoading && items.length === 0 && !hasSearch && (
          <p className="text-[12px] opacity-50">No items yet.</p>
        )}
        {!isLoading && items.length === 0 && hasSearch && (
          <p className="text-[12px] opacity-50">No items match your search.</p>
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
                      className="absolute top-1 right-1 z-10 w-4 h-4 rounded border-2 border-black bg-white/90 focus:ring-2 focus:ring-black/30"
                      aria-label={`Select ${item.name}`}
                    />
                    <Link
                      href={`/closet/${item._id}`}
                      className={`flex flex-col gap-2 block hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 rounded-sm ${
                        isSelected ? "ring-2 ring-black ring-offset-2" : ""
                      }`}
                      aria-label={`View ${item.name}`}
                    >
                      <div className="aspect-square bg-kyar-muted overflow-hidden">
                        {item.imageStorageId || item.imageUrl ? (
                          <ResolvedImage
                            imageStorageId={item.imageStorageId}
                            imageUrl={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                            <span className="material-symbols-outlined text-4xl">checkroom</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-start">
                          <h3 className="text-[10px] uppercase tracking-wider font-semibold">
                            {item.name}
                          </h3>
                          <span className="text-[9px] opacity-40">{item.category}</span>
                        </div>
                        <span
                          className={`text-[9px] uppercase tracking-wider font-medium w-fit ${
                            item.status === "complete"
                              ? "text-green-700"
                              : item.status === "in_progress"
                                ? "text-amber-700"
                                : "text-kyar-textTertiary"
                          }`}
                        >
                          {statusLabel(item.status)}
                        </span>
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
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4 py-3 bg-white border-t border-gray-200 shadow-lg flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
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

      <FloatingAdd href="/closet/new" />
    </WebAppShell>
  );
}
