"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

export interface CardAccordionItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
}

interface CardAccordionProps<T extends CardAccordionItem> {
  items: T[];
  /** Optional: wrap each panel in a link (e.g. getHref: (c) => `/conventions/${c.id}`) */
  getHref?: (item: T) => string;
  /** Optional: render a slot (e.g. checkbox) per panel; click does not navigate */
  renderAction?: (item: T) => React.ReactNode;
  /** Initial expanded index (default 0) */
  defaultActiveIndex?: number;
  className?: string;
  /** Height of each panel (default 450px) */
  panelHeight?: number;
  /** Width when expanded (default 400px) */
  expandedWidth?: number;
  /** Width when collapsed (default 60px) */
  collapsedWidth?: number;
}

function CardAccordionPanelInner<T extends CardAccordionItem>({
  item,
  isActive,
  onMouseEnter,
  href,
  renderAction,
  panelHeight,
  expandedWidth,
  collapsedWidth,
}: {
  item: T;
  isActive: boolean;
  onMouseEnter: () => void;
  href?: string;
  renderAction?: (item: T) => React.ReactNode;
  panelHeight: number;
  expandedWidth: number;
  collapsedWidth: number;
}) {
  const content = (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-end",
        "transition-all duration-700 ease-in-out"
      )}
      style={{
        height: panelHeight,
        width: isActive ? expandedWidth : collapsedWidth,
      }}
      onMouseEnter={onMouseEnter}
    >
      {/* Background image or placeholder */}
      <div className="absolute inset-0 bg-kyar-muted">
        {item.imageStorageId || item.imageUrl ? (
          <ResolvedImage
            imageStorageId={item.imageStorageId ?? undefined}
            imageUrl={item.imageUrl ?? undefined}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
            <span className="material-symbols-outlined text-5xl">event</span>
          </div>
        )}
      </div>
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/40" aria-hidden />

      {/* Caption: active = horizontal at bottom; inactive = vertical at bottom */}
      <span
        className={cn(
          "absolute z-10 text-white text-lg font-semibold whitespace-nowrap transition-all duration-300 ease-in-out",
          isActive
            ? "bottom-6 left-1/2 -translate-x-1/2 rotate-0"
            : "bottom-24 left-1/2 -translate-x-1/2 rotate-90 origin-center"
        )}
      >
        {item.title}
      </span>
      {isActive && item.subtitle && (
        <p className="absolute bottom-12 left-6 right-6 z-10 text-white/90 text-xs uppercase tracking-wide truncate">
          {item.subtitle}
        </p>
      )}
    </div>
  );

  const panel = href ? (
    <Link
      href={href}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 rounded-2xl"
      aria-label={item.title}
    >
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <div className="relative flex-shrink-0">
      {renderAction && (
        <div
          className="absolute top-2 right-2 z-20"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {renderAction(item)}
        </div>
      )}
      {panel}
    </div>
  );
}

export function CardAccordion<T extends CardAccordionItem>({
  items,
  getHref,
  renderAction,
  defaultActiveIndex = 0,
  className,
  panelHeight = 450,
  expandedWidth = 400,
  collapsedWidth = 60,
}: CardAccordionProps<T>) {
  const [activeIndex, setActiveIndex] = useState(defaultActiveIndex);

  if (items.length === 0) return null;

  const clampedActive = Math.min(activeIndex, items.length - 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-row items-stretch justify-center gap-2 overflow-x-auto p-4">
        {items.map((item, index) => (
          <CardAccordionPanelInner
            key={item.id}
            item={item}
            isActive={index === clampedActive}
            onMouseEnter={() => setActiveIndex(index)}
            href={getHref?.(item)}
            renderAction={renderAction}
            panelHeight={panelHeight}
            expandedWidth={expandedWidth}
            collapsedWidth={collapsedWidth}
          />
        ))}
      </div>
    </div>
  );
}
