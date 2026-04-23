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
  typeBadge,
  statusBadge,
  compact,
}: {
  typeBadge: string;
  statusBadge: string;
  compact?: boolean;
}) {
  const wrap = compact ? "flex-col gap-1" : "gap-2";
  const pill = compact
    ? "rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-kyar-media-fg backdrop-blur"
    : "rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-kyar-media-fg backdrop-blur";
  return (
    <div className={`absolute left-3 top-3 z-10 flex ${wrap}`}>
      <span className={pill}>{typeBadge}</span>
      {!compact && <span className={pill}>{statusBadge}</span>}
    </div>
  );
}

function PosterBody({
  item,
  progress,
  progressLabel,
  childrenLabel,
  variant,
}: {
  item: ElementPortfolioCardWebModel;
  progress: number;
  progressLabel: string;
  childrenLabel: string;
  variant: "comfortable" | "grid";
}) {
  const isGrid = variant === "grid";
  const titleClass = isGrid
    ? "font-serif text-xl italic leading-tight"
    : "font-serif text-3xl italic leading-none";
  const pad = isGrid ? "p-3 pt-9" : "p-4 pt-12";
  const ringSize = isGrid ? "h-7 w-7" : "h-9 w-9";
  const categoryUpper = (item.category?.trim() || "uncategorized").toUpperCase();

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
        <div className="flex h-full items-center justify-center bg-kyar-mutedWarm text-kyar-textTertiary">
          <span className="material-symbols-outlined text-5xl">
            {item.nodeType === "material" ? "science" : "checkroom"}
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-kyar-media-scrim-heavy" />
      <Badges typeBadge={item.typeBadge} statusBadge={item.statusBadge} />
      <div className={`absolute bottom-0 left-0 right-0 text-kyar-media-fg ${pad}`}>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`mb-1 font-bold uppercase tracking-[0.2em] opacity-80 ${isGrid ? "text-[8px]" : "text-[9px]"}`}
            >
              {categoryUpper}
            </p>
            <h3 className={`line-clamp-2 ${titleClass}`}>{item.name}</h3>
          </div>
          <ProgressRing
            progress={progress}
            sizeClass={ringSize}
            textClass="text-kyar-media-fg drop-shadow-md"
            trackClass="text-kyar-media-fg/25"
          />
        </div>
        <div
          className={`flex items-center justify-between font-bold uppercase tracking-wider text-kyar-media-fg-muted ${isGrid ? "mt-2 text-[9px]" : "mt-3 text-[10px]"}`}
        >
          <span>{progressLabel}</span>
          <span className="truncate pl-2">{childrenLabel}</span>
        </div>
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
      <div className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-mutedWarm shadow-soft">
        <div className="flex h-[148px] flex-row">
          <div className="relative h-full w-28 shrink-0 overflow-hidden bg-kyar-mutedWarm">
            {item.imageStorageId || item.imageUrl ? (
              <ResolvedImage
                imageStorageId={item.imageStorageId ?? undefined}
                imageUrl={item.imageUrl ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-kyar-textTertiary">
                <span className="material-symbols-outlined text-4xl">
                  {item.nodeType === "material" ? "science" : "checkroom"}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-kyar-media-scrim-faint" />
            <div className="absolute left-2 top-2">
              <span className="rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-kyar-media-fg backdrop-blur">
                {item.typeBadge}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between bg-kyar-surface py-3 pl-3 pr-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-kyar-textSecondary">
                {(item.category?.trim() || "uncategorized").toUpperCase()}
              </p>
              <h3 className="mt-1 line-clamp-2 font-serif text-[20px] italic leading-snug text-kyar-text">
                {item.name}
              </h3>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-kyar-textSecondary">
                {item.typeBadge} · {item.statusBadge}
              </p>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wider text-kyar-textSecondary">
                {progressLabel}
                <br />
                {childrenLabel}
              </p>
              <ProgressRing
                progress={pct}
                sizeClass="h-8 w-8"
                textClass="text-kyar-text"
                trackClass="text-kyar-text/15"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const posterVariant = variant === "grid" ? "grid" : "comfortable";
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft">
      <PosterBody
        item={item}
        progress={pct}
        progressLabel={progressLabel}
        childrenLabel={childrenLabel}
        variant={posterVariant}
      />
    </div>
  );
}
