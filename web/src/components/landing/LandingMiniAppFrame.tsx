"use client";

import type { ReactNode } from "react";

/** Sidebar keys for landing mini previews — order: Builds → Elements → Conventions → Tasks */
export type NavKey = "builds" | "elements" | "conventions" | "tasks";

const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: "builds", label: "Builds", href: "#product-demo" },
  { key: "elements", label: "Elements", href: "#product-demo" },
  { key: "conventions", label: "Conventions", href: "#product-demo" },
  { key: "tasks", label: "Tasks", href: "#product-demo" },
];

/**
 * Compact “in-app” chrome for landing previews. Sidebar links scroll to matching page sections.
 * When {@link onNavSelect} is set (e.g. landing product scrolly), it handles navigation so each item
 * can scroll to the correct step; otherwise {@link NAV} `href` values are used as-is.
 */
export function LandingMiniAppFrame({
  activeNav,
  children,
  mainClassName,
  onNavSelect,
  /** When true, layout ignores viewport breakpoints (Remotion / fixed canvas — not browser width). */
  remotion = false,
}: {
  activeNav: NavKey;
  children: ReactNode;
  /** Applied to the main content column (e.g. min-height for landing scrolly carousel). */
  mainClassName?: string;
  /** If provided, sidebar links call this instead of only following `href` (same-origin scrolly). */
  onNavSelect?: (key: NavKey) => void;
  remotion?: boolean;
}) {
  const shellRow = remotion
    ? "flex min-h-[260px] flex-row"
    : "flex min-h-[280px] flex-col sm:min-h-[320px] sm:flex-row";
  const aside = remotion
    ? "flex w-[9.25rem] shrink-0 flex-col gap-0.5 border-r border-kyar-borderSubtle bg-white p-2"
    : "flex shrink-0 flex-col gap-0.5 border-kyar-borderSubtle bg-white p-2 sm:w-[10.25rem] sm:border-r";
  const brand = remotion
    ? "mb-1.5 block px-2 font-serif-elegant text-sm font-bold italic"
    : "mb-1.5 hidden px-2 font-serif-elegant text-sm font-bold italic sm:block";
  const navText = remotion ? "text-[10px]" : "text-[9px] sm:text-[10px]";

  return (
    <div className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-bgWarm shadow-[0_24px_60px_rgba(0,0,0,0.06)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-kyar-borderSubtle bg-white px-3">
        <span className="h-2 w-2 rounded-full bg-[#FF5F56]" />
        <span className="h-2 w-2 rounded-full bg-[#FFBD2E]" />
        <span className="h-2 w-2 rounded-full bg-[#27C93F]" />
        <span className="ml-2 font-mono text-[9px] font-medium uppercase tracking-wider text-kyar-textTertiary">
          kyarafit.app
        </span>
      </div>
      <div className={shellRow}>
        <aside className={aside}>
          <div className={brand}>Kyarafit</div>
          {NAV.map((n) => (
            <a
              key={n.key}
              href={n.href}
              className={`rounded-md px-2 py-1.5 font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-1 ${navText} ${
                activeNav === n.key
                  ? "bg-kyar-muted text-kyar-accent"
                  : "text-kyar-textSecondary hover:bg-kyar-bgWarm"
              }`}
              aria-current={activeNav === n.key ? "page" : undefined}
              onClick={
                onNavSelect
                  ? (e) => {
                      e.preventDefault();
                      onNavSelect(n.key);
                    }
                  : undefined
              }
            >
              {n.label}
            </a>
          ))}
        </aside>
        <div className={`min-w-0 flex-1 ${remotion ? "p-3" : "p-3 sm:p-4"} ${mainClassName ?? ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
