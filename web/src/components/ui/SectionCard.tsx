"use client";

import Link from "next/link";

export interface SectionCardProps {
  /** Optional section title. */
  title?: string;
  /** Optional action link (e.g. "View all") shown next to title. */
  action?: {
    label: string;
    href: string;
  };
  /** Card content. */
  children: React.ReactNode;
  /** Extra class for the card wrapper. */
  className?: string;
}

export function SectionCard({ title, action, children, className = "" }: SectionCardProps) {
  return (
    <section
      className={`rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm shadow-card overflow-hidden ${className}`.trim()}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-kyar-cardBorder">
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
