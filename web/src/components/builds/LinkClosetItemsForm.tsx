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
import type { CSSProperties, DragEvent } from "react";
import { useOfflineMutation } from "@/lib/offline";
import { Plus, Search } from "lucide-react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { LinkClosetQuickCreateModal } from "@/components/builds/LinkClosetQuickCreateModal";
import { formatNodeStatus, formatNodeTypeLabel } from "@kyarafit/design-system/domain";
import {
  filterAndSortClosetItems,
  closetCategories,
} from "@kyarafit/design-system/domain/closetItems";
import { setNativeDragLabelPreview } from "@/lib/nativeDragPreview";
import { PhotoPill } from "@/components/ui/PhotoPill";

type ClosetEntityId = Id<"cosplayNodes">;

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

/** Native HTML5 DnD payload (avoid relying on @dnd-kit sensors in scrollable lists). */
const LINK_CLOSET_DRAG_TYPE = "application/x-kyarafit-link-closet";

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
    const linkNodesMut = useOfflineMutation(api.builds.linkNodes);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const prevActive = useRef(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [sortMode, setSortMode] = useState<SortMode>("name");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [quickCreateOpen, setQuickCreateOpen] = useState(false);
    const [dropZoneActive, setDropZoneActive] = useState(false);

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

    const categories = useMemo(() => closetCategories(closetItems), [closetItems]);

    const filtered = useMemo(
      () =>
        filterAndSortClosetItems(closetItems, { categoryFilter, search, sortMode, selectedIds }),
      [closetItems, categoryFilter, search, sortMode, selectedIds]
    );

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
      <div className="sticky top-0 z-[1] -mx-1 mb-3 space-y-3 border-b border-glass-divider bg-[rgb(20_19_32/0.86)] px-1 pb-3 pt-1 backdrop-blur-glass-chip">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-media-fg-55" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, category, or tag…"
            className="glass-field min-h-[44px] w-full py-2.5 pl-10 pr-3 text-[13px]"
            aria-label="Search elements"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[220px]">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="glass-field min-h-[44px] min-w-0 flex-1 px-3 py-2 text-[13px] [color-scheme:dark]"
            >
              <option value="all">All ({closetItems.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[240px]">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Sort
            </span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="glass-field min-h-[44px] min-w-0 flex-1 px-3 py-2 text-[13px] [color-scheme:dark]"
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
            className="min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-25"
          >
            Select all matching ({filtered.length})
          </button>
          <button
            type="button"
            onClick={clearMatching}
            disabled={filtered.length === 0}
            className="min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-25"
          >
            Clear matching
          </button>
          <span className="text-[11px] tabular-nums text-media-fg-55">
            Showing {visibleRows.length} of {filtered.length} · {selectedIds.size} selected
          </span>
        </div>
      </div>
    );

    const list = (
      <>
        {toolbar}
        <ul className="max-h-[min(58vh,520px)] divide-y divide-glass-divider overflow-y-auto border-y border-glass-divider">
          {visibleRows.length === 0 && (
            <li className="p-6 text-center text-[13px] text-media-fg-55">
              {closetItems.length === 0
                ? allowCreate
                  ? "No elements or materials yet. Create one above."
                  : "No elements or materials yet."
                : "No elements match your filters. Try another search or category."}
            </li>
          )}
          {visibleRows.map((item) => (
            <DraggableClosetRow
              key={item._id}
              item={item}
              isSelected={selectedIds.has(item._id)}
              onToggle={() => toggle(item._id)}
              dragHandle={enableDragDrop}
              dragMimeType={LINK_CLOSET_DRAG_TYPE}
              onDragEndRow={enableDragDrop ? () => setDropZoneActive(false) : undefined}
            />
          ))}
        </ul>
        {visibleCount < filtered.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            className="mt-3 min-h-[44px] w-full rounded-full border border-glass-border-strong bg-glass-bar py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            Show more ({filtered.length - visibleCount} left)
          </button>
        )}
      </>
    );

    const inner = (
      <div>
        <p className="text-sm leading-relaxed text-media-fg-70">
          Select elements and materials for this build. Use search and filters when you have many
          elements. Changes apply when you save.
        </p>
        {allowCreate && (
          <PhotoPill
            type="button"
            variant="outline"
            onClick={() => setQuickCreateOpen(true)}
            className="mt-3"
          >
            <Plus className="size-4" aria-hidden />
            New element or material
          </PhotoPill>
        )}
        {enableDragDrop && (
          <DroppableBuildZone
            className="mt-4"
            active={dropZoneActive}
            onDragEnterZone={() => setDropZoneActive(true)}
            onDragLeaveZone={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropZoneActive(false);
              }
            }}
            onDragOverZone={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDropOnZone={(e) => {
              e.preventDefault();
              setDropZoneActive(false);
              // #region agent log
              console.log("[DBG-c17634] Drop received on zone", {
                types: Array.from(e.dataTransfer.types),
                textData: e.dataTransfer.getData("text/plain"),
              });
              // #endregion
              const id =
                e.dataTransfer.getData("text/plain") ||
                e.dataTransfer.getData(LINK_CLOSET_DRAG_TYPE);
              if (!id) return;
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              });
            }}
          >
            <div className="flex items-center justify-center gap-2 text-center">
              <span className="material-symbols-outlined text-2xl text-media-fg-70">move_down</span>
              <div>
                <p className="text-[13px] font-medium text-kyar-media-fg">
                  Drop elements here to add
                </p>
                <p className="text-xs tabular-nums text-media-fg-55">{selectedIds.size} selected</p>
              </div>
            </div>
          </DroppableBuildZone>
        )}
        {!enableDragDrop && (
          <p className="mt-3 text-xs tabular-nums text-media-fg-55">
            {selectedIds.size} element{selectedIds.size !== 1 ? "s" : ""} selected
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

    return inner;
  }
);

LinkClosetItemsForm.displayName = "LinkClosetItemsForm";

function DraggableClosetRow({
  item,
  isSelected,
  onToggle,
  dragHandle,
  dragMimeType,
  onDragEndRow,
}: {
  item: LinkClosetRow;
  isSelected: boolean;
  onToggle: () => void;
  dragHandle: boolean;
  dragMimeType: string;
  onDragEndRow?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <li
      className={`flex min-h-[52px] items-center gap-2 px-1 transition-colors hover:bg-[rgb(255_253_248/0.06)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {dragHandle ? (
        <div
          draggable
          onDragStart={(e) => {
            // #region agent log
            console.log("[DBG-c17634] LinkCloset onDragStart", {
              itemId: item._id,
              itemName: item.name,
            });
            // #endregion
            const id = item._id as string;
            e.dataTransfer.setData("text/plain", id);
            e.dataTransfer.setData(dragMimeType, id);
            e.dataTransfer.effectAllowed = "copy";
            setNativeDragLabelPreview(e, item.name);
            setIsDragging(true);
          }}
          onDragEnd={() => {
            // #region agent log
            console.log("[DBG-c17634] LinkCloset onDragEnd", { itemId: item._id });
            // #endregion
            setIsDragging(false);
            onDragEndRow?.();
          }}
          className="flex h-11 min-w-[28px] shrink-0 cursor-grab touch-none select-none items-center justify-center text-media-fg-45 active:cursor-grabbing"
          style={{ WebkitUserDrag: "element" } as CSSProperties}
          aria-label={`Drag to add ${item.name} to build`}
          title="Drag into drop zone above"
        >
          <span className="material-symbols-outlined pointer-events-none text-[15px]" aria-hidden>
            drag_indicator
          </span>
        </div>
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-[10px] py-2 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
      >
        <span
          className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors ${
            isSelected ? "border-glass-solid bg-glass-solid" : "border-media-fg-45"
          }`}
        >
          {isSelected && (
            <span className="material-symbols-outlined text-[14px] font-bold text-glass-ink">
              check
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-kyar-media-fg">
            {item.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] uppercase tracking-[0.14em] text-media-fg-55">
            <span>
              {item.nodeType ? formatNodeTypeLabel(item.nodeType) : item.category || "Element"}
            </span>
            {item.nodeType && <span>{formatNodeStatus(item)}</span>}
            {typeof item.progressPercent === "number" && (
              <span>{item.progressPercent}% progress</span>
            )}
            {typeof item.childCount === "number" && item.childCount > 0 && (
              <span>
                {item.childCount} sub-element{item.childCount === 1 ? "" : "s"}
              </span>
            )}
            {item.hasIncompleteDescendants && <span>has unfinished sub-elements</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function DroppableBuildZone({
  children,
  className = "",
  active,
  onDragEnterZone,
  onDragLeaveZone,
  onDragOverZone,
  onDropOnZone,
}: {
  children: React.ReactNode;
  className?: string;
  active: boolean;
  onDragEnterZone: () => void;
  onDragLeaveZone: (e: DragEvent<HTMLDivElement>) => void;
  onDragOverZone: (e: DragEvent<HTMLDivElement>) => void;
  onDropOnZone: (e: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnterZone();
      }}
      onDragLeave={onDragLeaveZone}
      onDragOver={onDragOverZone}
      onDrop={onDropOnZone}
      className={`rounded-[10px] border-[1.5px] border-dashed p-5 transition-colors ${className} ${
        active
          ? "border-kyar-media-fg bg-glass-active"
          : "border-[rgb(255_253_248/0.35)] bg-[rgb(255_253_248/0.03)]"
      }`}
    >
      {children}
    </div>
  );
}
