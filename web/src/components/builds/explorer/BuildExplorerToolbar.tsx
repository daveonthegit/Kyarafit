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
    <div className="flex flex-col gap-3 border-b border-kyar-borderSubtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative flex min-w-0 flex-1 items-center">
        <span
          className="material-symbols-outlined absolute left-2.5 text-kyar-textTertiary"
          aria-hidden
        >
          search
        </span>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search linked elements…"
          className="w-full rounded-lg border border-kyar-borderSubtle bg-transparent py-2 pl-9 pr-3 text-[13px] placeholder:text-kyar-textTertiary focus:outline-none focus:ring-1 focus:ring-kyar-text/20"
          aria-label="Search linked elements"
        />
        {isFiltered ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-kyar-textTertiary hover:text-kyar-text"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-kyar-text px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-kyar-bg transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New main element
        </button>
        <button
          type="button"
          onClick={onOpenLinkNodes}
          className="inline-flex items-center gap-1.5 rounded-lg border border-kyar-borderSubtle px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-kyar-text transition-colors hover:bg-kyar-text/5"
        >
          <span className="material-symbols-outlined text-base">link</span>
          Link
        </button>
      </div>

      {/* Status bar */}
      {rootCount > 0 ? (
        <div className="text-[10px] tabular-nums text-kyar-textTertiary sm:hidden">
          {isFiltered
            ? `${matchCount ?? rootCount} match${(matchCount ?? rootCount) === 1 ? "" : "es"}`
            : `${rootCount} main element${rootCount === 1 ? "" : "s"}`}
        </div>
      ) : null}
    </div>
  );
}
