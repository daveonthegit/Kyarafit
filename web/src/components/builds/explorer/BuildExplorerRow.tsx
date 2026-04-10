"use client";

import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type {
  CosplayNodeId,
  DragState,
  DropZone,
  ExplorerLinkedNode,
  NodeSelectionMeta,
  PathSegment,
} from "./types";
import { formatCents, statusChipInfo } from "./types";
import { useLongPressDrag } from "./useLongPressDrag";

const STATUS_TONE_CLASSES = {
  neutral: "bg-kyar-muted text-kyar-textSecondary",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
} as const;

function NodeThumbnail({
  node,
  size = "md",
}: {
  node: ExplorerLinkedNode;
  size?: "sm" | "md";
}) {
  const px = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const hasImage = Boolean(node.imageStorageId || node.imageUrl);
  return (
    <div
      className={`${px} shrink-0 overflow-hidden rounded-lg border border-kyar-borderSubtle bg-kyar-muted`}
    >
      {hasImage ? (
        <ResolvedImage
          imageStorageId={node.imageStorageId ?? null}
          imageUrl={node.imageUrl ?? null}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="material-symbols-outlined text-sm text-kyar-textTertiary">
            {node.nodeType === "material" ? "inventory_2" : "checkroom"}
          </span>
        </div>
      )}
    </div>
  );
}

function StatusChip({ node }: { node: ExplorerLinkedNode }) {
  const { label, tone } = statusChipInfo(node);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight tracking-wide ${STATUS_TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

export type BuildExplorerRowProps = {
  node: ExplorerLinkedNode;
  selectionMeta: NodeSelectionMeta;
  isSelected: boolean;
  isDragging: boolean;
  activeDropZone: DropZone | null;
  hasChildren: boolean;
  expanded?: boolean;
  showExpandToggle?: boolean;
  showDragHandle?: boolean;
  showDrillChevron?: boolean;
  onTap: () => void;
  onToggleExpand?: () => void;
  onDragStart?: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
};

export function BuildExplorerRow({
  node,
  selectionMeta,
  isSelected,
  isDragging,
  activeDropZone,
  hasChildren,
  expanded,
  showExpandToggle = false,
  showDragHandle = true,
  showDrillChevron = false,
  onTap,
  onToggleExpand,
  onDragStart,
  onOverflowMenu,
}: BuildExplorerRowProps) {
  const cost =
    node.totalCostCents != null && node.totalCostCents > 0
      ? formatCents(node.totalCostCents)
      : null;

  const longPress = useLongPressDrag({
    meta: selectionMeta,
    onDragStart: onDragStart ?? (() => {}),
    enabled: showDragHandle && !!onDragStart,
  });

  return (
    <div
      data-node-drop-id={node._id}
      data-node-drop-meta={JSON.stringify(selectionMeta)}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      className={[
        "group relative flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors",
        isSelected
          ? "bg-kyar-bg ring-1 ring-kyar-text/10"
          : "hover:bg-kyar-text/[0.03]",
        activeDropZone === "before"
          ? "before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:rounded-full before:bg-kyar-text"
          : activeDropZone === "after"
            ? "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-kyar-text"
            : activeDropZone === "into"
              ? "ring-1 ring-kyar-text/40 bg-kyar-text/[0.04]"
              : "",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      {showDragHandle && onDragStart ? (
        <div
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onDragStart(selectionMeta, e.clientX, e.clientY);
          }}
          className="flex h-9 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded text-kyar-textTertiary transition-opacity md:opacity-0 md:group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag ${node.name}`}
        >
          <span className="material-symbols-outlined pointer-events-none text-base" aria-hidden>
            drag_indicator
          </span>
        </div>
      ) : (
        <div className="w-0 md:w-6" />
      )}

      {/* Expand toggle (tree mode only) */}
      {showExpandToggle ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-kyar-textTertiary transition-colors hover:text-kyar-textSecondary"
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={hasChildren ? (expanded ? "Collapse" : "Expand") : "Leaf node"}
        >
          <span className="material-symbols-outlined text-[18px]">
            {hasChildren
              ? expanded
                ? "expand_more"
                : "chevron_right"
              : ""}
          </span>
        </button>
      ) : null}

      {/* Tappable content area */}
      <button
        type="button"
        onClick={onTap}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <NodeThumbnail node={node} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug text-kyar-text">
            {node.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <StatusChip node={node} />
            {cost ? (
              <span className="text-[11px] tabular-nums text-kyar-textTertiary">{cost}</span>
            ) : null}
          </div>
        </div>
      </button>

      {/* Drill-down chevron (mobile) */}
      {showDrillChevron && hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTap();
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-kyar-textTertiary transition-colors hover:bg-kyar-muted"
          aria-label={`Open ${node.name}`}
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      ) : null}

      {/* Overflow menu trigger */}
      {onOverflowMenu ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOverflowMenu(selectionMeta);
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-kyar-textTertiary opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          aria-label="More actions"
        >
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
      ) : null}
    </div>
  );
}

export function DragPreviewRow({
  node,
  label,
}: {
  node: ExplorerLinkedNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-kyar-borderSubtle bg-kyar-surface/95 px-3 py-2 shadow-card backdrop-blur-[2px]">
      <span className="material-symbols-outlined text-base text-kyar-textTertiary" aria-hidden>
        drag_indicator
      </span>
      <NodeThumbnail node={node} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-kyar-text">{node.name}</p>
        <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">{label}</p>
      </div>
    </div>
  );
}
