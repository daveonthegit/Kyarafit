"use client";

/**
 * Web-only: full-screen on mobile, centered modal with max-width on desktop (lg+).
 * Same content; only size/position change by viewport.
 */
export function AdaptiveModal({
  open,
  onClose,
  "aria-labelledby": ariaLabelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  "aria-labelledby"?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-kyar-text/40 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={onClose}
    >
      <div
        className="bg-kyar-surface border border-kyar-borderSubtle rounded-sm shadow-soft w-full max-h-[90vh] overflow-auto min-h-[200px] max-w-sm sm:max-w-md lg:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
