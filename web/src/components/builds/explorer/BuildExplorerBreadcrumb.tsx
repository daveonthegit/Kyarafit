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
      className="flex items-center gap-1 border-b border-kyar-borderSubtle px-4 py-2"
    >
      {/* Back button for drill-down on mobile */}
      {onDrillBack && path.length > 0 ? (
        <button
          type="button"
          onClick={onDrillBack}
          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-kyar-textSecondary transition-colors hover:bg-kyar-muted md:hidden"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onNavigateToRoot}
        className="max-w-[40%] shrink-0 truncate rounded px-1.5 py-0.5 text-[12px] text-kyar-textSecondary transition-colors hover:bg-kyar-muted/50 hover:text-kyar-text"
        title={buildName}
      >
        {buildName}
      </button>

      {path.map((seg, index) => (
        <span key={`${seg.meta.nodeId}-${index}`} className="flex min-w-0 items-center gap-1">
          <span className="text-[11px] text-kyar-textTertiary" aria-hidden>
            /
          </span>
          <button
            type="button"
            onClick={() => onNavigateToSegment(index)}
            className={[
              "max-w-[min(100%,10rem)] truncate rounded px-1.5 py-0.5 text-[12px] transition-colors hover:bg-kyar-muted/50",
              index === path.length - 1
                ? "font-medium text-kyar-text"
                : "text-kyar-textSecondary hover:text-kyar-text",
            ].join(" ")}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
