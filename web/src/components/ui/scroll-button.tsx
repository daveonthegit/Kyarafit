"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export type ScrollButtonProps = {
  /** Ref to the scrollable container (used for scroll position and scrollTo). */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Optional ref to scroll target (e.g. bottom sentinel); unused if scrolling to bottom. */
  scrollRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Pixels from bottom at which the button hides (default 100). */
  threshold?: number;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

function ScrollButton({
  containerRef,
  scrollRef: _scrollRef,
  className,
  threshold = 100,
  ...props
}: ScrollButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        setIsVisible(scrollTop + clientHeight < scrollHeight - threshold);
      }
    };

    const container = containerRef.current;

    if (container) {
      container.addEventListener("scroll", handleScroll);
      handleScroll();
    }

    return () => {
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, threshold]);

  const handleScroll = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-kyar-border bg-white text-kyar-text shadow-soft transition-all duration-150 ease-out hover:border-black hover:bg-kyar-muted focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isVisible
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
        className
      )}
      onClick={handleScroll}
      aria-label="Scroll to bottom"
      {...props}
    >
      <ChevronDown className="h-4 min-h-4 w-4 min-w-4" />
    </button>
  );
}

export { ScrollButton };
