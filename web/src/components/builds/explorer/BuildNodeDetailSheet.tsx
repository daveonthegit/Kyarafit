"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { formatNodeTypeLabel } from "@kyarafit/design-system/domain";
import type {
  CosplayNodeId,
  DetailedLinkedNode,
  ElementCombinedStatus,
  NodeSelectionMeta,
} from "./types";
import {
  ELEMENT_COMBINED_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
  formatCents,
  statusChipInfo,
} from "./types";
import type { InspectorForm } from "./useNodeInspector";

type PersistStatus = "saved" | "dirty" | "saving" | "error";

type BuildNodeDetailSheetProps = {
  detail: DetailedLinkedNode | null | undefined;
  selected: NodeSelectionMeta | null;
  inspectorForm: InspectorForm;
  persistStatus: PersistStatus;
  onFormChange: (updater: (prev: InspectorForm) => InspectorForm) => void;
  onFlushSave: () => void;
  onCreateChild: (parentId: CosplayNodeId, nodeType: "element" | "material") => void;
  onUnlink: () => void;
  onClose: () => void;
  onMoveNode?: (meta: NodeSelectionMeta) => void;
  /** When true, renders as a static panel instead of a floating sheet. */
  inline?: boolean;
};

const STATUS_DOT = {
  neutral: "bg-on-glass-chip-neutral-fg",
  warning: "bg-on-glass-chip-warn-fg",
  active: "bg-on-glass-chip-active-fg",
  success: "bg-on-glass-chip-done-fg",
} as const;

export function BuildNodeDetailSheet({
  detail,
  selected,
  inspectorForm,
  persistStatus,
  onFormChange,
  onFlushSave,
  onCreateChild,
  onUnlink,
  onClose,
  onMoveNode,
  inline = false,
}: BuildNodeDetailSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState<"half" | "full">("full");

  const isOpen = detail != null && selected != null;

  // Trap focus when sheet is open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen || !detail) return null;

  const chip = statusChipInfo(detail);

  const sheetContent = (
    <>
      {/* Header bar with save status */}
      <div className={`flex items-center justify-between px-5 pb-2 ${inline ? "pt-4" : "pt-1"}`}>
        <span
          className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55"
          aria-live="polite"
        >
          {persistStatus === "saving" && "Saving…"}
          {persistStatus === "dirty" && "Unsaved"}
          {persistStatus === "saved" && "Saved"}
          {persistStatus === "error" && "Save failed"}
        </span>
        {!inline ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-media-fg-55 transition-colors hover:bg-glass-active"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        ) : null}
      </div>

      <div className="space-y-5 px-5 pb-8">
        {/* Header: thumbnail + editable name */}
        <div className="flex items-start gap-3">
          <div className="h-[190px] w-[150px] shrink-0 overflow-hidden rounded-xl border border-glass-border bg-glass-active">
            {detail.imageStorageId || detail.imageUrl ? (
              <ResolvedImage
                imageStorageId={detail.imageStorageId ?? null}
                imageUrl={detail.imageUrl ?? null}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="material-symbols-outlined text-lg text-media-fg-45">
                  {detail.nodeType === "material" ? "inventory_2" : "checkroom"}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={inspectorForm.name}
              onChange={(e) => onFormChange((prev) => ({ ...prev, name: e.target.value }))}
              onBlur={onFlushSave}
              aria-invalid={!inspectorForm.name.trim()}
              aria-label="Node name"
              className={[
                "w-full border-b border-glass-border bg-transparent font-serif italic text-xl text-kyar-media-fg",
                "focus:border-kyar-media-fg focus:outline-none",
                !inspectorForm.name.trim() ? "border-on-glass-danger text-on-glass-danger" : "",
              ].join(" ")}
            />
            {!inspectorForm.name.trim() && (
              <p className="mt-1 text-xs text-on-glass-danger">Name is required</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                {formatNodeTypeLabel(detail.nodeType)}
              </span>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[chip.tone]}`} />
              <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                {detail.progressPercent ?? 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Status selector (segmented control) */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-media-fg-55">Status</p>
          <div className="flex gap-1 rounded-full bg-glass-bar p-1">
            {(detail.nodeType === "element"
              ? ELEMENT_COMBINED_OPTIONS
              : MATERIAL_STATUS_OPTIONS
            ).map((opt) => {
              const isActive =
                detail.nodeType === "element"
                  ? inspectorForm.elementCombinedStatus === opt.value
                  : inspectorForm.materialStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (detail.nodeType === "element") {
                      onFormChange((prev) => ({
                        ...prev,
                        elementCombinedStatus: opt.value as ElementCombinedStatus,
                      }));
                    } else {
                      onFormChange((prev) => ({
                        ...prev,
                        materialStatus: opt.value,
                      }));
                    }
                  }}
                  className={[
                    "flex-1 rounded-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                    isActive
                      ? "bg-glass-solid text-glass-ink"
                      : "text-media-fg-55 hover:text-kyar-media-fg",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cost inputs */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
              Direct cost
            </span>
            <input
              value={inspectorForm.directCostDollars}
              onChange={(e) =>
                onFormChange((prev) => ({
                  ...prev,
                  directCostDollars: e.target.value,
                }))
              }
              placeholder="0.00"
              inputMode="decimal"
              className="glass-field w-full px-3 py-2.5 text-sm tabular-nums focus:ring-1 focus:ring-kyar-accent"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
              Rollup cost
            </span>
            <div className="flex items-center rounded-[10px] border border-glass-border px-3 py-2.5">
              <span className="text-sm font-medium tabular-nums text-kyar-media-fg">
                {detail.totalCostCents != null ? formatCents(detail.totalCostCents) : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <label className="block space-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">Notes</span>
          <textarea
            value={inspectorForm.notes}
            onChange={(e) => onFormChange((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="glass-field w-full px-3 py-2.5 text-sm focus:ring-1 focus:ring-kyar-accent"
          />
        </label>

        {/* Actions */}
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              onCreateChild(detail._id, detail.nodeType === "material" ? "material" : "element")
            }
            className="rounded-full bg-glass-solid px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90"
          >
            New child
          </button>
          <button
            type="button"
            onClick={onUnlink}
            className="rounded-full border border-on-glass-danger/60 px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger transition-colors hover:bg-on-glass-danger/10"
          >
            {selected?.isRoot ? "Unlink root" : "Unlink child"}
          </button>
          {onMoveNode && selected ? (
            <button
              type="button"
              onClick={() => onMoveNode(selected)}
              className="rounded-full border border-glass-border-strong bg-glass-bar px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active"
            >
              Move
            </button>
          ) : null}
        </div>

        {/* Open full page link */}
        <Link
          href={`/elements/${detail._id}`}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 transition-colors hover:text-kyar-media-fg"
        >
          <span className="material-symbols-outlined text-base">open_in_new</span>
          Open full page
        </Link>
      </div>
    </>
  );

  if (inline) {
    return (
      <div role="region" aria-label={`Edit ${detail.name}`} className="text-kyar-media-fg">
        {sheetContent}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-40 bg-scrim-dim backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Floating bottom sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={`Edit ${detail.name}`}
        className={[
          "fixed inset-x-0 bottom-0 z-50 overflow-y-auto rounded-t-glass-sheet bg-glass-overlay-on-wall backdrop-blur-glass-overlay border-t border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg",
          sheetHeight === "full" ? "top-4" : "top-[40%]",
          "transition-[top] duration-300 ease-out",
        ].join(" ")}
      >
        {/* Drag indicator */}
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setSheetHeight((h) => (h === "half" ? "full" : "half"))}
            className="h-1 w-10 rounded-full bg-media-fg-45"
            aria-label={sheetHeight === "half" ? "Expand sheet" : "Collapse sheet"}
          />
        </div>
        {sheetContent}
      </div>
    </>
  );
}
