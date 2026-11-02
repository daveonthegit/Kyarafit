"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";
import { formatNodeStatus, formatNodeTypeLabel } from "@kyarafit/design-system/domain";

type ClosetEntityId = Id<"cosplayNodes">;

export interface ClosetCarouselItem {
  _id: ClosetEntityId;
  name: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  category?: string;
  status?: string;
  costCents?: number | null;
  nodeType?: "element" | "material";
  overallBucket?: "incomplete" | "in_progress" | "complete";
  progressPercent?: number;
  childCount?: number;
  hasIncompleteDescendants?: boolean;
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
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
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar text-kyar-media-fg backdrop-blur-glass-chip transition-colors",
            "hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:cursor-not-allowed disabled:opacity-25"
          )}
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className={cn(
            "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar text-kyar-media-fg backdrop-blur-glass-chip transition-colors",
            "hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:cursor-not-allowed disabled:opacity-25"
          )}
        >
          <ChevronRight className="h-[18px] w-[18px]" />
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

/** Card content for one linked node (use inside droppable build cards on build detail). */
export function ClosetCarouselCardContent({
  item,
  formatCents,
}: {
  item: ClosetCarouselItem;
  formatCents: (cents: number) => string;
}) {
  return (
    <div className="group relative flex w-full flex-col overflow-hidden rounded-[16px] border border-glass-border bg-glass-active transition-colors hover:border-glass-border-strong">
      {item.imageStorageId || item.imageUrl ? (
        <ResolvedImage
          imageStorageId={item.imageStorageId ?? undefined}
          imageUrl={item.imageUrl ?? undefined}
          alt={item.name}
          className="w-full h-auto object-cover min-h-[160px]"
        />
      ) : (
        <div className="flex w-full aspect-square items-center justify-center text-media-fg-45">
          <span className="material-symbols-outlined text-4xl font-extralight">checkroom</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-kyar-media-scrim-mid" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col gap-0.5 p-3">
        <p className="truncate text-[13px] font-medium text-kyar-media-fg">{item.name}</p>
        <div className="flex items-center justify-between text-[10px] text-media-fg-70">
          <span>
            {item.nodeType ? formatNodeTypeLabel(item.nodeType) : item.category || "Node"}
          </span>
          {item.costCents != null && <span>{formatCents(item.costCents)}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-media-fg-55">
          {item.nodeType && <span>{formatNodeStatus(item)}</span>}
          {typeof item.progressPercent === "number" && (
            <span>{item.progressPercent}% progress</span>
          )}
          {typeof item.childCount === "number" && item.childCount > 0 && (
            <span>
              {item.childCount} child{item.childCount === 1 ? "" : "ren"}
            </span>
          )}
          {item.hasIncompleteDescendants && <span>nested work remains</span>}
        </div>
      </div>
    </div>
  );
}
