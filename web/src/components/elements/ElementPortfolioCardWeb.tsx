"use client";

import type { CosplayNodeType } from "@kyarafit/design-system/types";
import type { PortfolioLayoutMode } from "@/lib/portfolioLayout";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

export type ElementPortfolioCardWebModel = {
  name: string;
  category?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  nodeType: CosplayNodeType;
  progressPercent: number;
  childCount: number;
  typeBadge: string;
  statusBadge: string;
  statusTone?: ChipTone;
};

type ChipTone = "done" | "active" | "warn" | "neutral";

const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  done: "bg-on-glass-chip-done-bg text-on-glass-chip-done-fg",
  active: "bg-on-glass-chip-active-bg text-on-glass-chip-active-fg",
  warn: "bg-on-glass-chip-warn-bg text-on-glass-chip-warn-fg",
  neutral: "bg-on-glass-chip-neutral-bg text-on-glass-chip-neutral-fg",
};

function ProgressRing({
  progress,
  sizeClass,
  textClass,
  trackClass,
}: {
  progress: number;
  sizeClass: string;
  textClass: string;
  trackClass: string;
}) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${sizeClass}`}>
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={trackClass}
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(progress / 100) * 100} 100`}
          className={textClass}
        />
      </svg>
      <span className={`relative text-[9px] font-bold ${textClass}`}>{progress}</span>
    </div>
  );
}

function Badges({
  statusBadge,
  tone = "neutral",
  compact,
}: {
  statusBadge: string;
  tone?: ChipTone;
  compact?: boolean;
}) {
  const pill = `rounded-full ${CHIP_TONE_CLASSES[tone]} ${
    compact ? "px-2 py-0.5" : "px-3 py-1"
  } text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur-glass-chip`;
  return (
    <div className="absolute left-3 top-3 z-10 flex gap-2">
      <span className={pill}>{statusBadge}</span>
    </div>
  );
}

function PosterBody({
  item,
  variant,
}: {
  item: ElementPortfolioCardWebModel;
  variant: "comfortable" | "grid";
}) {
  const isGrid = variant === "grid";
  const metaUpper = (item.category?.trim() || item.typeBadge).toUpperCase();

  return (
    <>
      {item.imageStorageId || item.imageUrl ? (
        <ResolvedImage
          imageStorageId={item.imageStorageId ?? undefined}
          imageUrl={item.imageUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-studio-wall text-media-fg-45">
          <span className="material-symbols-outlined text-5xl">
            {item.nodeType === "material" ? "science" : "checkroom"}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-kyar-media-scrim-heavy" />
      <Badges statusBadge={item.statusBadge} tone={item.statusTone} compact={isGrid} />
      <div className="absolute bottom-0 left-0 right-0 p-3 pt-9 text-kyar-media-fg">
        <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.16em] opacity-70">
          {metaUpper}
        </p>
        <h3 className="line-clamp-2 font-serif text-[14px] italic leading-snug sm:text-[16px]">
          {item.name}
        </h3>
      </div>
    </>
  );
}

export function ElementPortfolioCardWeb({
  variant,
  item,
  progressLabel,
  childrenLabel,
}: {
  variant: PortfolioLayoutMode;
  item: ElementPortfolioCardWebModel;
  progressLabel: string;
  childrenLabel: string;
}) {
  const pct = Math.min(100, Math.max(0, item.progressPercent));

  if (variant === "compact") {
    return (
      <div className="overflow-hidden rounded-[10px] border border-glass-border bg-glass text-kyar-media-fg">
        <div className="flex h-[148px] flex-row">
          <div className="relative h-full w-28 shrink-0 overflow-hidden bg-glass-active">
            {item.imageStorageId || item.imageUrl ? (
              <ResolvedImage
                imageStorageId={item.imageStorageId ?? undefined}
                imageUrl={item.imageUrl ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-media-fg-45">
                <span className="material-symbols-outlined text-4xl">
                  {item.nodeType === "material" ? "science" : "checkroom"}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-kyar-media-scrim-faint" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pl-3 pr-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-media-fg-70">
                {(item.category?.trim() || "uncategorized").toUpperCase()}
              </p>
              <h3 className="mt-1 line-clamp-2 font-serif text-[20px] italic leading-snug">
                {item.name}
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-media-fg-70">
                {item.typeBadge} · {item.statusBadge}
              </p>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.14em] text-media-fg-70">
                {progressLabel}
                <br />
                {childrenLabel}
              </p>
              <ProgressRing
                progress={pct}
                sizeClass="h-8 w-8"
                textClass="text-kyar-media-fg"
                trackClass="text-kyar-media-fg/20"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const posterVariant = variant === "grid" ? "grid" : "comfortable";
  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-glass-border bg-glass-active">
      <PosterBody item={item} variant={posterVariant} />
    </div>
  );
}
