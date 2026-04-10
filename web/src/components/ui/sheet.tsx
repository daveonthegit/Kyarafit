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
}: SheetProps) {
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
            className="fixed inset-0 z-[10000] bg-kyar-text/30 backdrop-blur-sm"
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
            className={`fixed inset-y-0 right-0 z-[10001] w-full ${sizeClass[size]} bg-kyar-surface shadow-soft flex flex-col border-l border-kyar-borderSubtle sm:rounded-l-3xl overflow-hidden`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="flex items-center justify-between gap-3 border-b border-kyar-border px-6 py-4 shrink-0">
              <h2
                id={titleId}
                className="font-serif-elegant text-xl font-semibold text-kyar-text tracking-tight pr-2"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={closeDisabled}
                className="shrink-0 p-2 -mr-2 rounded-md hover:bg-kyar-muted text-kyar-textSecondary focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-40 transition-colors"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6">{children}</div>
            {footer != null && (
              <div className="shrink-0 border-t border-kyar-border px-6 py-4 flex flex-wrap gap-3 bg-kyar-muted/50">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
