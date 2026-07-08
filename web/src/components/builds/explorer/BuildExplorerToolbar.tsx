"use client";

type BuildExplorerToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateRoot: () => void;
  onOpenLinkNodes: () => void;
  rootCount: number;
  matchCount?: number;
};

export function BuildExplorerToolbar({
  search,
  onSearchChange,
  onCreateRoot,
  onOpenLinkNodes,
  rootCount,
  matchCount,
}: BuildExplorerToolbarProps) {
  const isFiltered = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 border-b border-glass-divider-strong px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex min-w-0 flex-1 items-center">
        <span className="material-symbols-outlined absolute left-2.5 text-media-fg-45" aria-hidden>
          search
        </span>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search linked elements…"
          className="glass-field w-full py-2 pl-9 pr-3 text-[13px] focus:ring-1 focus:ring-kyar-accent"
          aria-label="Search linked elements"
        />
        {isFiltered ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-media-fg-55 hover:text-kyar-media-fg"
            aria-label="Clear filter"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onCreateRoot}
          className="inline-flex items-center gap-1.5 rounded-full border border-glass-border-strong bg-glass-bar px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors hover:bg-glass-active"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New main element
        </button>
        <button
          type="button"
          onClick={onOpenLinkNodes}
          className="inline-flex items-center gap-1.5 rounded-full border border-glass-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg"
        >
          <span className="material-symbols-outlined text-base">link</span>
          Link
        </button>
      </div>

      {/* Status bar */}
      {rootCount > 0 ? (
        <div className="text-[10px] tabular-nums text-media-fg-55 sm:hidden">
          {isFiltered
            ? `${matchCount ?? rootCount} match${(matchCount ?? rootCount) === 1 ? "" : "es"}`
            : `${rootCount} main element${rootCount === 1 ? "" : "s"}`}
        </div>
      ) : null}
    </div>
  );
}
