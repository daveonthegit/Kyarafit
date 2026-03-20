"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

export interface ClosetCarouselItem {
  _id: Id<"closetItems">;
  name: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  category?: string;
  status?: string;
  costCents?: number | null;
}

interface ClosetItemsCarouselProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
}

function ClosetItemsCarouselInner<T>({
  items,
  renderItem,
  keyExtractor,
  className,
}: ClosetItemsCarouselProps<T>) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScrollability = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScrollability();
      container.addEventListener("scroll", checkScrollability);
    }
    return () => container?.removeEventListener("scroll", checkScrollability);
  }, [items.length, checkScrollability]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          type="button"
          onClick={() => scroll("left")}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
          className={cn(
            "p-2 rounded-full border border-kyar-border bg-white text-kyar-text transition-opacity duration-300",
            "hover:bg-kyar-muted hover:border-black disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className={cn(
            "p-2 rounded-full border border-kyar-border bg-white text-kyar-text transition-opacity duration-300",
            "hover:bg-kyar-muted hover:border-black disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto overflow-y-hidden scroll-smooth snap-x snap-mandatory gap-4 pb-2"
      >
        {items.map((item) => (
          <div key={keyExtractor(item)} className="flex-shrink-0 w-[220px] sm:w-[260px] snap-start">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ClosetItemsCarousel = React.memo(
  ClosetItemsCarouselInner
) as typeof ClosetItemsCarouselInner;

/** Card content for one closet item (use inside DroppableClosetItem on build detail). */
export function ClosetCarouselCardContent({
  item,
  formatCents,
}: {
  item: ClosetCarouselItem;
  formatCents: (cents: number) => string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-transparent bg-kyar-mutedWarm overflow-hidden shadow-sm transition-all hover:shadow-md group w-full relative">
      {item.imageStorageId || item.imageUrl ? (
        <ResolvedImage
          imageStorageId={item.imageStorageId ?? undefined}
          imageUrl={item.imageUrl ?? undefined}
          alt={item.name}
          className="w-full h-auto object-cover min-h-[160px]"
        />
      ) : (
        <div className="flex w-full aspect-square items-center justify-center text-kyar-textTertiary">
          <span className="material-symbols-outlined text-4xl">checkroom</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none flex flex-col gap-0.5">
        <p className="text-white text-xs font-medium truncate">{item.name}</p>
        <div className="flex items-center justify-between text-white/80 text-[10px]">
          <span>{item.category || "Item"}</span>
          {item.costCents != null && <span>{formatCents(item.costCents)}</span>}
        </div>
      </div>
    </div>
  );
}
