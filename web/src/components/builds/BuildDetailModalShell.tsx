"use client";

import { X } from "lucide-react";

type ModalSize = "md" | "lg" | "xl" | "2xl";

const sizeClass: Record<ModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
};

export type BuildDetailModalShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  /** e.g. disable close while saving */
  closeDisabled?: boolean;
  /** Backdrop + stacking (nested modals use a higher z-index). */
  zOverlayClass?: string;
};

/**
 * Shared layout for build-detail overlays: backdrop, panel, header, scroll body, optional footer.
 */
export function BuildDetailModalShell({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
  size = "lg",
  closeDisabled = false,
  zOverlayClass = "z-[10000]",
}: BuildDetailModalShellProps) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zOverlayClass} flex items-center justify-center p-4 bg-kyar-text/45 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        className={`bg-kyar-surface w-full ${sizeClass[size]} max-h-[90vh] flex flex-col rounded-lg border border-kyar-borderSubtle shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-kyar-border px-4 py-3 shrink-0">
          <h2
            id={titleId}
            className="font-serif text-lg font-semibold text-kyar-text tracking-tight pr-2"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="shrink-0 p-2 rounded-md hover:bg-kyar-muted text-kyar-textSecondary focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
        {footer != null && (
          <div className="shrink-0 border-t border-kyar-border px-4 py-3 flex flex-wrap gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
