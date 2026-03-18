"use client";

import Link from "next/link";

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
  /** Optional primary action (e.g. "New build", "New convention"). */
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    "aria-label"?: string;
  };
  /** Optional trailing slot (e.g. settings icon link). */
  trailing?: React.ReactNode;
  /** Extra class for the header wrapper. */
  className?: string;
  /** If true, header is sticky with background. */
  sticky?: boolean;
}

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  primaryAction,
  trailing,
  className = "",
  sticky = true,
}: PageHeaderProps) {
  const wrapperClass = [
    "pt-14 pb-4 sm:pb-6",
    sticky
      ? "sticky top-0 z-30 bg-kyar-bgWarm/95 backdrop-blur-md border-b border-kyar-cardBorder"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={wrapperClass}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-2">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-kyar-textSecondary">
                {breadcrumb.map((item, i) => {
                  const isLast = i === breadcrumb.length - 1;
                  return (
                    <li key={i} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span className="text-kyar-textMuted" aria-hidden>
                          /
                        </span>
                      )}
                      {isLast || !item.href ? (
                        <span className="font-medium text-kyar-text">{item.label}</span>
                      ) : (
                        <Link
                          href={item.href}
                          className="hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm rounded"
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}
          <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-normal italic tracking-tight text-kyar-text">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-kyar-textSecondary">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm font-medium uppercase tracking-wide border border-kyar-border text-kyar-text rounded-sm hover:bg-kyar-accent hover:text-white hover:border-kyar-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                aria-label={primaryAction["aria-label"] ?? primaryAction.label}
              >
                {primaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] px-4 py-2.5 text-sm font-medium uppercase tracking-wide border border-kyar-border text-kyar-text rounded-sm hover:bg-kyar-accent hover:text-white hover:border-kyar-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                aria-label={primaryAction["aria-label"] ?? primaryAction.label}
              >
                {primaryAction.label}
              </button>
            ))}
          {trailing}
        </div>
      </div>
    </header>
  );
}
