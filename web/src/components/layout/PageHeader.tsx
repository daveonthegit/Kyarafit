"use client";

import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";

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
  /** Optional mobile-only label used to collapse the controls into a compact toggle row */
  mobileControlsLabel?: string;
  /** Optional summary text shown alongside the mobile controls toggle */
  mobileControlsSummary?: string;
  /** Whether the mobile controls drawer should start open */
  defaultMobileControlsOpen?: boolean;
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
  mobileControlsLabel,
  mobileControlsSummary,
  defaultMobileControlsOpen = false,
  className = "",
  sticky = true,
}: PageHeaderProps) {
  const [mobileControlsOpen, setMobileControlsOpen] = useState(defaultMobileControlsOpen);
  const hasCollapsibleControls = Boolean(children && mobileControlsLabel);
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
          {trailing && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {trailing}
            </div>
          )}
        </div>
      </div>
      {hasCollapsibleControls && (
        <div className="mt-4 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileControlsOpen((open) => !open)}
            className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-2.5 text-left shadow-soft transition-colors hover:border-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            aria-expanded={mobileControlsOpen}
          >
            <span className="flex min-w-0 items-center gap-2">
              <SlidersHorizontal className="size-4 text-kyar-text" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-kyar-text">
                {mobileControlsLabel}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              {mobileControlsSummary && (
                <span className="truncate text-[11px] text-kyar-textSecondary">
                  {mobileControlsSummary}
                </span>
              )}
              <ChevronDown
                className={`size-4 shrink-0 text-kyar-text transition-transform ${mobileControlsOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>
        </div>
      )}
      {children && (
        <div
          className={
            hasCollapsibleControls
              ? mobileControlsOpen
                ? "mt-4 flex flex-col gap-3 rounded-[28px] border border-kyar-borderSubtle bg-kyar-surface p-4 shadow-soft sm:mt-6 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
                : "hidden sm:mt-6 sm:flex sm:flex-wrap sm:flex-row sm:items-center sm:gap-4"
              : "mt-6 flex flex-wrap items-center gap-4"
          }
        >
          {children}
        </div>
      )}
    </header>
  );
}
