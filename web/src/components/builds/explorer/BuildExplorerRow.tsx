"use client";

import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { DropZone, ExplorerLinkedNode, NodeSelectionMeta } from "./types";
import { formatCents, statusChipInfo } from "./types";
import { useLongPressDrag } from "./useLongPressDrag";

// On-glass chip tones (01-foundations): translucent tone pairs on glass panels.
const STATUS_TONE_CLASSES = {
  neutral: "bg-on-glass-chip-neutral-bg text-on-glass-chip-neutral-fg",
  warning: "bg-on-glass-chip-warn-bg text-on-glass-chip-warn-fg",
  active: "bg-on-glass-chip-active-bg text-on-glass-chip-active-fg",
  success: "bg-on-glass-chip-done-bg text-on-glass-chip-done-fg",
} as const;

function NodeThumbnail({ node, size = "md" }: { node: ExplorerLinkedNode; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const hasImage = Boolean(node.imageStorageId || node.imageUrl);
  return (
    <div
      className={`${px} shrink-0 overflow-hidden rounded-lg border border-glass-border bg-glass-active`}
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
          <span className="material-symbols-outlined text-sm text-media-fg-45">
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight tracking-[0.14em] uppercase ${STATUS_TONE_CLASSES[tone]}`}
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
          ? "bg-glass-active ring-1 ring-inset ring-[rgb(255_253_248/0.2)]"
          : "hover:bg-glass-active",
        activeDropZone === "before"
          ? "before:absolute before:inset-x-2 before:top-0 before:h-[2.5px] before:rounded-[2px] before:bg-[var(--drop-line)] before:shadow-[0_0_12px_rgb(255_253_248/0.8)]"
          : activeDropZone === "after"
            ? "after:absolute after:inset-x-2 after:bottom-0 after:h-[2.5px] after:rounded-[2px] after:bg-[var(--drop-line)] after:shadow-[0_0_12px_rgb(255_253_248/0.8)]"
            : activeDropZone === "into"
              ? "ring-[1.5px] ring-inset ring-[var(--drop-into-ring)] bg-glass-active"
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
          className="flex h-9 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded text-media-fg-45 transition-opacity md:opacity-0 md:group-hover:opacity-100 active:cursor-grabbing"
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-media-fg-45 transition-colors hover:text-media-fg-70"
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={
            hasChildren ? (expanded ? "Collapse" : "Expand") : "Element with no sub-elements"
          }
        >
          <span className="material-symbols-outlined text-[18px]">
            {hasChildren ? (expanded ? "expand_more" : "chevron_right") : ""}
          </span>
        </button>
      ) : null}

      {/* Tappable content area */}
      <button
        type="button"
        onClick={onTap}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <NodeThumbnail node={node} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug text-kyar-media-fg">
            {node.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <StatusChip node={node} />
            {cost ? (
              <span className="text-[11px] tabular-nums text-media-fg-55">{cost}</span>
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-media-fg-55 transition-colors hover:bg-glass-active"
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-media-fg-55 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          aria-label="More actions"
        >
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
      ) : null}
    </div>
  );
}

export function DragPreviewRow({ node, label }: { node: ExplorerLinkedNode; label: string }) {
  return (
    <div className="flex rotate-[1.5deg] items-center gap-3 rounded-lg border border-glass-border-strong bg-glass-preview px-3 py-2 text-kyar-media-fg shadow-[0_24px_48px_-16px_rgb(12_11_20/0.6)] backdrop-blur-[20px]">
      <span className="material-symbols-outlined text-base text-media-fg-45" aria-hidden>
        drag_indicator
      </span>
      <NodeThumbnail node={node} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.name}</p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">{label}</p>
      </div>
    </div>
  );
}
