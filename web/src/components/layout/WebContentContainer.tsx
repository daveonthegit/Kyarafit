"use client";

/**
 * Web-only layout primitive: constrains page content with max-width and responsive padding.
 * Use for all authenticated app page content so desktop/tablet don't stretch full width.
 */
export function WebContentContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
