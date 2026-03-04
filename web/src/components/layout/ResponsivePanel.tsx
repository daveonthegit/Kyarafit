"use client";

/**
 * Web-only: drawer on mobile (slide-over from right), side sheet on desktop (panel beside content).
 * Same content and actions; only layout differs by viewport.
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
        className="fixed inset-0 z-40 bg-black/40 lg:bg-transparent"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-xl flex flex-col lg:max-w-md lg:border-l lg:border-kyar-borderSubtle"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-kyar-borderSubtle px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-kyar-textSecondary hover:text-kyar-text"
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
