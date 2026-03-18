"use client";

import { useState } from "react";

export interface FilterToolbarProps {
  /** Search value and change handler; search is always visible. */
  search: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    "aria-label"?: string;
  };
  /** Optional filters/sorts to show when expanded. */
  children?: React.ReactNode;
  /** Label for the "Show filters" toggle. */
  filtersLabel?: string;
  /** Optional class for the toolbar wrapper. */
  className?: string;
}

export function FilterToolbar({
  search,
  children,
  filtersLabel = "Filters",
  className = "",
}: FilterToolbarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      className={`sticky top-[var(--page-header-offset,120px)] z-20 bg-kyar-bgWarm/95 backdrop-blur-md border-b border-kyar-cardBorder py-3 ${className}`.trim()}
      aria-label="Filter and sort"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="filter-toolbar-search" className="sr-only">
            {search["aria-label"] ?? "Search"}
          </label>
          <input
            id="filter-toolbar-search"
            type="search"
            placeholder={search.placeholder ?? "Search…"}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="flex-1 min-w-[140px] min-h-[44px] px-3 py-2.5 text-sm border border-kyar-border rounded-sm bg-kyar-surfaceWarm text-kyar-text placeholder:text-kyar-textMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
            aria-label={search["aria-label"] ?? "Search"}
          />
          {children != null && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="min-h-[44px] min-w-[44px] inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border border-kyar-border text-kyar-text rounded-sm hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              aria-expanded={expanded}
              aria-label={expanded ? "Hide filters" : "Show filters"}
            >
              <span className="material-symbols-outlined text-lg">
                {expanded ? "expand_less" : "expand_more"}
              </span>
              <span className="hidden sm:inline">{filtersLabel}</span>
            </button>
          )}
        </div>
        {expanded && children && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 pt-1 border-t border-kyar-cardBorder">
            {children}
          </div>
        )}
      </div>
    </nav>
  );
}
