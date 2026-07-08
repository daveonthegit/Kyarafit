"use client";

import type { NodeSelectionMeta, PathSegment } from "./types";

type BuildExplorerBreadcrumbProps = {
  buildName: string;
  path: PathSegment[];
  onNavigateToRoot: () => void;
  onNavigateToSegment: (index: number) => void;
  onDrillBack?: () => void;
};

export function BuildExplorerBreadcrumb({
  buildName,
  path,
  onNavigateToRoot,
  onNavigateToSegment,
  onDrillBack,
}: BuildExplorerBreadcrumbProps) {
  return (
    <nav
      aria-label="Build path"
      className="font-explorer-mono flex items-center gap-1 border-b border-glass-divider px-4 py-2"
    >
      {/* Back button for drill-down on mobile */}
      {onDrillBack && path.length > 0 ? (
        <button
          type="button"
          onClick={onDrillBack}
          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-media-fg-70 transition-colors hover:bg-glass-active md:hidden"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onNavigateToRoot}
        className="max-w-[40%] shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] lowercase text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg"
        title={buildName}
      >
        {buildName}
      </button>

      {path.map((seg, index) => (
        <span key={`${seg.meta.nodeId}-${index}`} className="flex min-w-0 items-center gap-1">
          <span className="text-[10px] text-media-fg-45" aria-hidden>
            /
          </span>
          <button
            type="button"
            onClick={() => onNavigateToSegment(index)}
            className={[
              "max-w-[min(100%,10rem)] truncate rounded px-1.5 py-0.5 text-[10px] lowercase transition-colors hover:bg-glass-active",
              index === path.length - 1
                ? "font-medium text-kyar-media-fg"
                : "text-media-fg-70 hover:text-kyar-media-fg",
            ].join(" ")}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
