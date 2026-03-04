"use client";

/**
 * Web-only: responsive grid — 1 col mobile, 2 tablet (sm), 3–4 desktop (lg/xl).
 * Use for builds list, closet grid, etc. Same data/actions; only layout changes.
 */
export function ResponsiveGrid({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
