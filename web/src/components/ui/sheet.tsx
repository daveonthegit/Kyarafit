"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export type SheetSize = "sm" | "md" | "lg" | "xl" | "2xl";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
  size?: SheetSize;
  /** "glass" = v2 drawer: dim scrim + overlay-weight glass panel (ref 13e) */
  surface?: "default" | "glass";
};

const sizeClass: Record<SheetSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function Sheet({
  open,
  onClose,
  title,
  titleId = "sheet-title",
  children,
  footer,
  closeDisabled = false,
  size = "md",
  surface = "default",
}: SheetProps) {
  const glass = surface === "glass";
  // Prevent scrolling on body when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !closeDisabled) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeDisabled, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-[10000] ${
              glass ? "bg-scrim-dim backdrop-blur-[5px]" : "bg-kyar-text/30 backdrop-blur-sm"
            }`}
            aria-hidden="true"
            onClick={() => {
              if (!closeDisabled) onClose();
            }}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed inset-y-0 right-0 z-[10001] w-full ${sizeClass[size]} flex flex-col overflow-hidden ${
              glass
                ? "bg-glass-overlay-on-wall backdrop-blur-glass-overlay border-l border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg"
                : "bg-kyar-surface shadow-soft border-l border-kyar-borderSubtle sm:rounded-l-3xl"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div
              className={`flex items-center justify-between gap-3 border-b px-6 py-4 shrink-0 ${
                glass ? "border-glass-divider-strong" : "border-kyar-border"
              }`}
            >
              <h2
                id={titleId}
                className={`pr-2 tracking-tight ${
                  glass
                    ? "font-serif italic text-xl font-normal text-kyar-media-fg"
                    : "font-serif-elegant text-xl font-semibold text-kyar-text"
                }`}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                className={`shrink-0 p-2 -mr-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-40 transition-colors ${
                  glass
                    ? "hover:bg-glass-active text-media-fg-70"
                    : "hover:bg-kyar-muted text-kyar-textSecondary"
                }`}
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">{children}</div>
            {footer != null && (
              <div
                className={`shrink-0 border-t px-6 py-4 flex flex-wrap gap-3 ${
                  glass
                    ? "border-glass-divider bg-glass-active"
                    : "border-kyar-border bg-kyar-muted/50"
                }`}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
