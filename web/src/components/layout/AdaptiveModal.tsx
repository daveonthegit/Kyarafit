"use client";

/**
 * Web-only heavier-glass dialog (ref 13d): bottom sheet on mobile, centered
 * modal with max-width on desktop (lg+). Same content; only size/position
 * change by viewport. Content renders light-on-glass — use .glass-field for
 * inputs and PhotoPill for actions.
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim-dim backdrop-blur-[6px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      onClick={onClose}
    >
      <div
        className="bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg w-full max-h-[90vh] overflow-auto min-h-[200px] rounded-t-glass-sheet sm:rounded-glass-overlay sm:max-w-md lg:max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
