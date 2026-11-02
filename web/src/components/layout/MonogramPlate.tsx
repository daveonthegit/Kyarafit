"use client";

/**
 * No-imagery fallback (ref 13g): stands in for a missing cover photo. The studio wall behind it
 * stays visible; the plate carries the entity's first initial on a faint diagonal-stripe field, and
 * a dashed "add" pill (dashed = add affordance only, QA-6) opens the cover picker.
 */
export function MonogramPlate({
  name,
  addLabel,
  onAdd,
  className = "",
}: {
  name: string;
  addLabel: string;
  onAdd?: () => void;
  className?: string;
}) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
  return (
    <div
      data-testid="monogram-plate"
      className={`panel-enter relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-glass border border-glass-border bg-monogram-stripes text-media-fg-55 ${className}`.trim()}
    >
      <span
        aria-hidden
        className="select-none font-serif italic text-[72px] leading-none text-kyar-media-fg/25 lg:text-[88px]"
      >
        {initial}
      </span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-glass-border-strong px-4 text-media-fg-70 transition-colors hover:border-kyar-media-fg hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-media-ring"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            add_photo_alternate
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.16em]">{addLabel}</span>
        </button>
      )}
    </div>
  );
}
