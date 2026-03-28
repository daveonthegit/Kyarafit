"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { Plus, Search } from "lucide-react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { LinkClosetQuickCreateModal } from "@/components/builds/LinkClosetQuickCreateModal";
import { formatNodeStatus, formatNodeTypeLabel } from "@/lib/cosplayUi";

type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;

export type LinkClosetItemsFormHandle = {
  save: () => Promise<void>;
};

export type LinkClosetRow = {
  _id: ClosetEntityId;
  name: string;
  category: string;
  tags?: string[];
  _creationTime?: number;
  nodeType?: "element" | "material";
  overallBucket?: "incomplete" | "in_progress" | "complete";
  progressPercent?: number;
  childCount?: number;
  hasIncompleteDescendants?: boolean;
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  totalCostCents?: number | null;
};

type SortMode = "name" | "recent" | "selectedFirst";

const PAGE_SIZE = 100;

type LinkClosetItemsFormProps = {
  buildId: Id<"builds">;
  userId: string;
  closetItems: LinkClosetRow[];
  linkedIds: ClosetEntityId[];
  /** When this toggles to true, selection resets from linkedIds (e.g. modal opened) */
  isActive: boolean;
  /** Drag + drop zone (use on standalone link-items page only) */
  enableDragDrop: boolean;
  /** Show “New item” + quick-create modal (build link flow). */
  allowCreate?: boolean;
  onAfterSave?: () => void;
  onError?: (message: string) => void;
};

export const LinkClosetItemsForm = forwardRef<LinkClosetItemsFormHandle, LinkClosetItemsFormProps>(
  function LinkClosetItemsForm(
    {
      buildId,
      userId,
      closetItems,
      linkedIds,
      isActive,
      enableDragDrop,
      allowCreate = false,
      onAfterSave,
      onError,
    },
    ref
  ) {
    const linkNodesMut = useMutation(api.builds.linkNodes);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const prevActive = useRef(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [sortMode, setSortMode] = useState<SortMode>("name");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [quickCreateOpen, setQuickCreateOpen] = useState(false);

    useEffect(() => {
      if (isActive && !prevActive.current) {
        setSelectedIds(new Set(linkedIds.map((x) => x as string)));
        setSearch("");
        setCategoryFilter("all");
        setSortMode("name");
        setVisibleCount(PAGE_SIZE);
      }
      prevActive.current = isActive;
    }, [isActive, linkedIds]);

    useEffect(() => {
      setVisibleCount(PAGE_SIZE);
    }, [search, categoryFilter, sortMode, closetItems.length]);

    const categories = useMemo(() => {
      const s = new Set<string>();
      closetItems.forEach((c) => {
        if (c.category?.trim()) s.add(c.category.trim());
      });
      return Array.from(s).sort((a, b) => a.localeCompare(b));
    }, [closetItems]);

    const filtered = useMemo(() => {
      let rows = [...closetItems];
      if (categoryFilter !== "all") {
        rows = rows.filter((r) => (r.category ?? "").trim() === categoryFilter);
      }
      const q = search.trim().toLowerCase();
      if (q) {
        rows = rows.filter((r) => {
          if (r.name.toLowerCase().includes(q)) return true;
          if ((r.category ?? "").toLowerCase().includes(q)) return true;
          if (r.tags?.some((t) => t.toLowerCase().includes(q))) return true;
          return false;
        });
      }
      if (sortMode === "name") {
        rows.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortMode === "recent") {
        rows.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
      } else {
        rows.sort((a, b) => {
          const sa = selectedIds.has(a._id) ? 1 : 0;
          const sb = selectedIds.has(b._id) ? 1 : 0;
          if (sa !== sb) return sb - sa;
          return a.name.localeCompare(b.name);
        });
      }
      return rows;
    }, [closetItems, categoryFilter, search, sortMode, selectedIds]);

    const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

    const toggle = useCallback((itemId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
    }, []);

    const selectAllMatching = useCallback(() => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r._id));
        return next;
      });
    }, [filtered]);

    const clearMatching = useCallback(() => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r._id));
        return next;
      });
    }, [filtered]);

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && over.id === "build-drop-zone") {
        const itemId = active.id as string;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(itemId);
          return next;
        });
      }
    };

    const save = useCallback(async () => {
      try {
        await linkNodesMut({
          userId,
          buildId,
          cosplayNodeIds: Array.from(selectedIds) as Id<"cosplayNodes">[],
        });
        onAfterSave?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to save";
        onError?.(msg);
        throw e;
      }
    }, [linkNodesMut, userId, buildId, selectedIds, onAfterSave, onError]);

    useImperativeHandle(ref, () => ({ save }), [save]);

    const toolbar = (
      <div className="sticky top-0 z-[1] -mx-1 mb-3 space-y-3 border-b border-kyar-borderSubtle bg-white pb-3 px-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-kyar-textTertiary" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, category, or tag…"
            className="w-full rounded-lg border border-kyar-border bg-kyar-muted/20 py-2.5 pl-10 pr-3 text-sm placeholder:text-kyar-textTertiary focus:border-kyar-accent focus:outline-none focus:ring-2 focus:ring-kyar-accent/20"
            aria-label="Search cosplay nodes"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-kyar-textTertiary sm:max-w-[200px]">
            <span className="shrink-0 uppercase tracking-wider">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-kyar-border bg-white px-2 py-2 text-sm text-kyar-text"
            >
              <option value="all">All ({closetItems.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-kyar-textTertiary sm:max-w-[220px]">
            <span className="shrink-0 uppercase tracking-wider">Sort</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-w-0 flex-1 rounded-md border border-kyar-border bg-white px-2 py-2 text-sm text-kyar-text"
            >
              <option value="name">Name (A–Z)</option>
              <option value="recent">Newest first</option>
              <option value="selectedFirst">Selected first</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAllMatching}
            disabled={filtered.length === 0}
            className="rounded-md border border-kyar-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-kyar-text hover:border-kyar-text disabled:opacity-40"
          >
            Select all matching ({filtered.length})
          </button>
          <button
            type="button"
            onClick={clearMatching}
            disabled={filtered.length === 0}
            className="rounded-md border border-kyar-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-kyar-text hover:border-kyar-text disabled:opacity-40"
          >
            Clear matching
          </button>
          <span className="text-[11px] text-kyar-textTertiary">
            Showing {visibleRows.length} of {filtered.length} · {selectedIds.size} selected
          </span>
        </div>
      </div>
    );

    const list = (
      <>
        {toolbar}
        <ul className="max-h-[min(58vh,520px)] space-y-0 overflow-y-auto rounded-lg border border-kyar-borderSubtle divide-y divide-kyar-borderSubtle">
          {visibleRows.length === 0 && (
            <li className="p-6 text-center text-sm text-kyar-textTertiary">
              {closetItems.length === 0
                ? allowCreate
                  ? "No elements or materials yet. Create one above."
                  : "No elements or materials yet."
                : "No nodes match your filters. Try another search or category."}
            </li>
          )}
          {visibleRows.map((item) => (
            <DraggableClosetRow
              key={item._id}
              item={item}
              isSelected={selectedIds.has(item._id)}
              onToggle={() => toggle(item._id)}
              dragHandle={enableDragDrop}
            />
          ))}
        </ul>
        {visibleCount < filtered.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="mt-3 w-full rounded-lg border border-kyar-border py-2.5 text-xs font-semibold uppercase tracking-wider text-kyar-text hover:bg-kyar-muted/40"
          >
            Show more ({filtered.length - visibleCount} left)
          </button>
        )}
      </>
    );

    const inner = (
      <div>
        <p className="text-sm text-kyar-textSecondary leading-relaxed">
          Select elements and materials for this build. Use search and filters when you have many
          pieces. Changes apply when you save.
        </p>
        {allowCreate && (
          <button
            type="button"
            onClick={() => setQuickCreateOpen(true)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-kyar-border bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-kyar-text shadow-sm hover:border-kyar-text"
          >
            <Plus className="size-4" aria-hidden />
            New element or material
          </button>
        )}
        {enableDragDrop && (
          <DroppableBuildZone className="mt-4">
            <div className="flex items-center justify-center gap-2 text-center">
              <span className="material-symbols-outlined text-2xl text-kyar-textSecondary">
                move_down
              </span>
              <div>
                <p className="font-medium text-sm text-kyar-text">Drop nodes here to add</p>
                <p className="text-xs text-kyar-textTertiary">{selectedIds.size} selected</p>
              </div>
            </div>
          </DroppableBuildZone>
        )}
        {!enableDragDrop && (
          <p className="mt-3 text-xs text-kyar-textTertiary">
            {selectedIds.size} node{selectedIds.size !== 1 ? "s" : ""} selected
          </p>
        )}
        <div className="mt-3">{list}</div>

        {allowCreate && (
          <LinkClosetQuickCreateModal
            open={quickCreateOpen}
            onClose={() => setQuickCreateOpen(false)}
            onCreated={(id) => {
              setSelectedIds((prev) => new Set(prev).add(id as string));
            }}
          />
        )}
      </div>
    );

    return enableDragDrop ? <DndContext onDragEnd={handleDragEnd}>{inner}</DndContext> : inner;
  }
);

LinkClosetItemsForm.displayName = "LinkClosetItemsForm";

function DraggableClosetRow({
  item,
  isSelected,
  onToggle,
  dragHandle,
}: {
  item: LinkClosetRow;
  isSelected: boolean;
  onToggle: () => void;
  dragHandle: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item._id,
    disabled: !dragHandle,
    data: { type: "closetItem", item },
  });

  return (
    <li
      ref={setNodeRef}
      className={`flex items-center gap-3 py-3 px-2 ${isDragging ? "opacity-50" : ""}`}
      style={{ contentVisibility: "auto" }}
    >
      {dragHandle ? (
        <span
          className="material-symbols-outlined shrink-0 cursor-grab touch-none text-kyar-textTertiary"
          {...listeners}
          {...attributes}
          aria-hidden
        >
          drag_indicator
        </span>
          ) : (
            <span className="w-6 shrink-0" aria-hidden />
          )}
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
      >
        <span
          className={`flex size-4 shrink-0 items-center justify-center border ${
            isSelected ? "border-kyar-text bg-kyar-text" : "border-kyar-border"
          }`}
        >
          {isSelected && (
            <span className="material-symbols-outlined text-sm text-white">check</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-kyar-text">{item.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-kyar-textTertiary">
            <span>{item.nodeType ? formatNodeTypeLabel(item.nodeType) : item.category || "Node"}</span>
            {item.nodeType && <span>{formatNodeStatus(item)}</span>}
            {typeof item.progressPercent === "number" && <span>{item.progressPercent}% progress</span>}
            {typeof item.childCount === "number" && item.childCount > 0 && (
              <span>{item.childCount} child{item.childCount === 1 ? "" : "ren"}</span>
            )}
            {item.hasIncompleteDescendants && <span>has incomplete descendants</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function DroppableBuildZone({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "build-drop-zone",
    data: { type: "buildZone" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-5 transition-all ${className} ${
        isOver ? "border-kyar-accent bg-kyar-accent/10" : "border-kyar-border bg-kyar-muted/50"
      }`}
    >
      {children}
    </div>
  );
}
