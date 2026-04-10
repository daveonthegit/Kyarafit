"use client";

import Link from "next/link";

export interface SurfaceProps {
  /** Optional section title. */
  title?: string;
  /** Optional action link (e.g. "View all") shown next to title. */
  action?: {
    label: string;
    href: string;
  };
  /** Content. */
  children: React.ReactNode;
  /** Extra class for the wrapper. */
  className?: string;
}

/**
 * Default grouped container: light tint, subtle border, no shadow.
 * Use for related content without heavy visual weight.
 */
export function Surface({ title, action, children, className = "" }: SurfaceProps) {
  return (
    <section
      className={`rounded-lg border border-kyar-borderSubtle bg-kyar-surface/60 overflow-hidden ${className}`.trim()}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-kyar-borderSubtle">
          {title && (
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kyar-meta font-mono">
              {title}
            </h2>
          )}
          {action && (
            <Link
              href={action.href}
              className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm rounded"
            >
              {action.label}
            </Link>
          )}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
