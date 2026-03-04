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
          <div
            key={keyExtractor(item)}
            className="flex-shrink-0 w-[220px] sm:w-[260px] snap-start"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const ClosetItemsCarousel = React.memo(ClosetItemsCarouselInner) as typeof ClosetItemsCarouselInner;

/** Card content for one closet item (use inside DroppableClosetItem on build detail). */
export function ClosetCarouselCardContent({
  item,
  formatCents,
}: {
  item: ClosetCarouselItem;
  formatCents: (cents: number) => string;
}) {
  return (
    <div className="flex flex-col rounded-sm border border-kyar-border bg-white overflow-hidden shadow-soft transition-all duration-300 hover:shadow-fab hover:-translate-y-0.5">
      <div className="aspect-square w-full bg-kyar-muted overflow-hidden">
        {item.imageStorageId || item.imageUrl ? (
          <ResolvedImage
            imageStorageId={item.imageStorageId ?? undefined}
            imageUrl={item.imageUrl ?? undefined}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-kyar-textTertiary">
            <span className="material-symbols-outlined text-4xl">checkroom</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-kyar-text line-clamp-2">{item.name}</p>
        {item.category && (
          <p className="text-xs text-kyar-textTertiary mt-0.5">{item.category}</p>
        )}
        {item.costCents != null && (
          <p className="text-xs text-kyar-textTertiary mt-0.5">
            {formatCents(item.costCents)}
          </p>
        )}
        {item.status && (
          <span
            className={cn(
              "inline-block mt-1.5 text-[10px] uppercase tracking-wider font-medium",
              item.status === "complete"
                ? "text-green-700"
                : item.status === "in_progress"
                  ? "text-amber-700"
                  : "text-kyar-textTertiary"
            )}
          >
            {item.status === "complete"
              ? "Complete"
              : item.status === "in_progress"
                ? "In progress"
                : "Planned"}
          </span>
        )}
      </div>
    </div>
  );
}
