"use client";

/**
 * Web-only: drawer on mobile (slide-over from right), side sheet on desktop
 * (panel beside content). Same content and actions; only layout differs by
 * viewport. Speaks the glass drawer grammar (ref 13e).
 */
export function ResponsivePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-scrim-dim backdrop-blur-[5px] lg:bg-transparent lg:backdrop-blur-none"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-glass-overlay-on-wall backdrop-blur-glass-overlay border-l border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg flex flex-col lg:max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-glass-divider-strong px-4 py-3">
          <h2 className="font-serif italic text-lg font-normal">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-media-fg-70 hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </aside>
    </>
  );
}
