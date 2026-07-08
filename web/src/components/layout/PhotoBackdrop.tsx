"use client";

import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

interface PhotoBackdropProps {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  /** Backdrops are decorative; pass alt only when the photo carries meaning. */
  alt?: string;
  /**
   * Right-edge scrim for screens with a right work panel (surface rule 4).
   * QA-1: use "strong" whenever a right panel exists or the photo is
   * high-key (daylight, con-floor, bright/busy shots).
   */
  scrimRight?: "off" | "default" | "strong";
  /** Slow ≤1.03 zoom over 12s; disabled under prefers-reduced-motion. */
  kenBurns?: boolean;
  className?: string;
}

/**
 * Full-bleed photo backdrop for studio routes (surface rules 1–4). Renders
 * the studio-wall gradient underneath, so a missing or still-resolving image
 * falls back to it — never a gray box. Position inside a `relative` container;
 * layer screen content above it.
 */
export function PhotoBackdrop({
  imageStorageId,
  imageUrl,
  alt = "",
  scrimRight = "off",
  kenBurns = true,
  className = "",
}: PhotoBackdropProps) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden bg-studio-wall ${className}`.trim()}
      aria-hidden={alt === ""}
    >
      <div className={`absolute inset-0 ${kenBurns ? "animate-glass-ken-burns" : ""}`.trim()}>
        <ResolvedImage
          imageStorageId={imageStorageId}
          imageUrl={imageUrl}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-scrim-page-vertical-mobile md:hidden" />
      <div className="absolute inset-0 hidden bg-scrim-page-vertical md:block" />
      {scrimRight !== "off" && (
        <div
          className={`absolute inset-0 hidden md:block ${
            scrimRight === "strong" ? "bg-scrim-page-right-strong" : "bg-scrim-page-right"
          }`}
        />
      )}
    </div>
  );
}
