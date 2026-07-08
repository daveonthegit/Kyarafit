"use client";

import type { PortfolioLayoutMode } from "@/lib/portfolioLayout";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { progressRingGeometry } from "@kyarafit/design-system/domain/progressRing";
import type { Id } from "convex/_generated/dataModel";

export type BuildPortfolioCardWebModel = {
  name: string;
  character?: string | null;
  status: string;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  tasksTotal: number;
  tasksChecked: number;
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
  const { dashArray, dashOffset } = progressRingGeometry(progress, 16);
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
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          className={textClass}
        />
      </svg>
      <span className={`relative text-[9px] font-bold ${textClass}`}>{progress}</span>
    </div>
  );
}

function PosterOverlay({
  item,
  projectNumber,
  progress,
  variant,
}: {
  item: BuildPortfolioCardWebModel;
  projectNumber: string;
  progress: number;
  variant: "comfortable" | "grid";
}) {
  const isGrid = variant === "grid";
  const titleClass = isGrid
    ? "font-serif text-xl italic leading-tight"
    : "font-serif text-2xl lg:text-3xl italic leading-none";
  const metaClass = isGrid ? "text-[9px]" : "text-[10px]";
  const ringSize = isGrid ? "h-7 w-7" : "h-10 w-10";

  return (
    <>
      {item.imageStorageId || item.imageUrl ? (
        <ResolvedImage
          imageStorageId={item.imageStorageId}
          imageUrl={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-media-fg-45 transition-transform duration-700 group-hover:scale-105">
          <span className="material-symbols-outlined text-6xl">image</span>
        </div>
      )}
      <div className="absolute inset-0 bg-kyar-media-scrim transition-colors duration-300" />
      <div
        className={`absolute inset-0 flex flex-col justify-end text-kyar-media-fg ${isGrid ? "p-3" : "p-5"}`}
      >
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">
              Project {projectNumber}
            </span>
            <h2 className={`truncate text-kyar-media-fg drop-shadow-md ${titleClass}`}>
              {item.name}
            </h2>
          </div>
          <ProgressRing
            progress={progress}
            sizeClass={ringSize}
            textClass="text-kyar-media-fg drop-shadow-md"
            trackClass="text-kyar-media-fg/25"
          />
        </div>
        <div className={`flex items-center gap-3 ${isGrid ? "pt-2" : "pt-3"}`}>
          <span
            className={`font-bold uppercase tracking-widest opacity-90 drop-shadow-sm ${metaClass}`}
          >
            {item.status}
          </span>
          {item.character ? (
            <>
              <span className="h-1 w-1 rounded-full bg-kyar-media-ring" />
              <span
                className={`truncate font-bold uppercase tracking-widest opacity-90 drop-shadow-sm ${metaClass}`}
              >
                {item.character}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function BuildPortfolioCardWeb({
  variant,
  projectIndex,
  item,
}: {
  variant: PortfolioLayoutMode;
  item: BuildPortfolioCardWebModel;
  /** 1-based index in the sorted list */
  projectIndex: number;
}) {
  const projectNumber = String(projectIndex).padStart(3, "0");
  const progress =
    item.tasksTotal > 0 ? Math.round((item.tasksChecked / item.tasksTotal) * 100) : 0;

  if (variant === "compact") {
    return (
      <div className="overflow-hidden rounded-[10px] border border-glass-border bg-glass text-kyar-media-fg">
        <div className="flex h-[148px] flex-row">
          <div className="relative h-full w-28 shrink-0 overflow-hidden bg-glass-active">
            {item.imageStorageId || item.imageUrl ? (
              <ResolvedImage
                imageStorageId={item.imageStorageId}
                imageUrl={item.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-media-fg-45">
                <span className="material-symbols-outlined text-4xl">image</span>
              </div>
            )}
            <div className="absolute inset-0 bg-kyar-media-scrim-soft" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-3 pl-3 pr-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
                Project {projectNumber}
              </p>
              <h3 className="mt-1 line-clamp-2 font-serif text-[22px] italic leading-tight">
                {item.name}
              </h3>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
                {item.status}
                {item.character ? ` · ${item.character}` : ""}
              </p>
              <ProgressRing
                progress={progress}
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
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] border border-glass-border bg-glass-active">
      <PosterOverlay
        item={item}
        projectNumber={projectNumber}
        progress={progress}
        variant={posterVariant}
      />
    </div>
  );
}
