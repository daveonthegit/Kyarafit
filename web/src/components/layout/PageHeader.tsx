"use client";

import { Search } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Optional breadcrumb items; last item is current page (no href). */
  breadcrumb?: BreadcrumbItem[];
  /** Main page title (serif, italic). */
  title: string;
  /** Optional subtitle or meta line. */
  subtitle?: string;
  /** Optional trailing slot (e.g. settings icon link). */
  trailing?: React.ReactNode;
  /** Optional search input to show in the header */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    "aria-label"?: string;
  };
  /** Optional children (like filters) to show below the header */
  children?: React.ReactNode;
  /** Extra class for the header wrapper. */
  className?: string;
  /** If true, header is sticky with background. */
  sticky?: boolean;
}

export function PageHeader({
  breadcrumb: _breadcrumb,
  title,
  subtitle,
  trailing,
  search,
  children,
  className = "",
  sticky = true,
}: PageHeaderProps) {
  const wrapperClass = [
    "pt-12 sm:pt-16 pb-6",
    sticky ? "sticky top-0 z-30 bg-kyar-bg/95 backdrop-blur-md" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={wrapperClass}>
      <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif-elegant text-[30px] sm:text-[38px] font-normal italic tracking-tight text-kyar-text leading-[1.12]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-[11px] text-kyar-textSecondary">{subtitle}</p>}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 sm:w-auto sm:min-w-[min(100%,20rem)] sm:max-w-md sm:items-end">
          {search && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-kyar-textTertiary pointer-events-none" />
              <input
                type="search"
                placeholder={search.placeholder ?? "Search archive..."}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                className="w-full min-h-[44px] pl-7 pr-3 py-2.5 text-sm border-b border-kyar-border bg-transparent text-kyar-text placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-text transition-colors"
                aria-label={search["aria-label"] ?? "Search"}
              />
            </div>
          )}
          {trailing && <div className="flex items-center justify-end gap-2">{trailing}</div>}
        </div>
      </div>
      {children && <div className="mt-6 flex flex-wrap gap-4 items-center">{children}</div>}
    </header>
  );
}
