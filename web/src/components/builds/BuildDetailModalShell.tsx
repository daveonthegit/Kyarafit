"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ModalSize = "md" | "lg" | "xl" | "2xl";

const sizeClass: Record<ModalSize, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-3xl",
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
 * Shared layout for build-detail overlays: dim scrim, overlay-weight glass dialog
 * (bg 0.14 / blur 30 / border 0.22 / radius 16 + shadow), header, scroll body, optional
 * footer. Bottom sheet on mobile, centered on sm+. Content renders light-on-glass — use
 * `.glass-field` for inputs and PhotoPill for actions.
 *
 * The dialog materializes (fade + scale .98→1, 260ms ease-out-strong); the global
 * reduced-motion rule collapses the transition so it appears instantly.
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
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${zOverlayClass} flex items-end justify-center bg-scrim-dim backdrop-blur-[6px] transition-opacity duration-[240ms] ease-[var(--ease-out-strong)] sm:items-center sm:p-6 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!closeDisabled) onClose();
      }}
    >
      <div
        className={`flex w-full ${sizeClass[size]} max-h-[90vh] flex-col overflow-hidden rounded-t-glass-sheet border border-glass-border-overlay bg-glass-overlay-on-wall text-kyar-media-fg shadow-glass-overlay backdrop-blur-glass-overlay transition-[opacity,transform] duration-[260ms] ease-[var(--ease-out-strong)] sm:rounded-glass-overlay ${
          entered ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-glass-divider-strong py-2 pl-5 pr-2 sm:pl-6">
          <h2
            id={titleId}
            className="pr-2 font-serif text-xl font-normal italic tracking-tight text-kyar-media-fg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer != null && (
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-glass-divider-strong px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
