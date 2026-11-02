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

/**
 * Tile-sized no-imagery fallback (13g) for posters and thumbnails: studio wall, stripe field and a
 * faint serif initial instead of a gray box with a generic image glyph.
 */
export function MonogramFill({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
  const text = size === "sm" ? "text-[22px]" : size === "lg" ? "text-[64px]" : "text-[44px]";
  return (
    <span
      aria-hidden
      data-testid="monogram-fill"
      className="absolute inset-0 flex items-center justify-center bg-studio-wall"
    >
      <span className="absolute inset-0 bg-monogram-stripes" />
      <span className={`relative font-serif italic leading-none text-kyar-media-fg/25 ${text}`}>
        {initial}
      </span>
    </span>
  );
}
