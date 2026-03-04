"use client";

import Link from "next/link";

/** Default: /closet/new (canonical add-item flow; parity with mobile /add-item). Hidden on lg+ (desktop uses WebTopBar Add). */
export function FloatingAdd({
  href = "/closet/new",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`fixed bottom-28 right-6 z-50 w-14 h-14 bg-black text-white flex items-center justify-center rounded-sm transition-transform hover:scale-95 active:scale-95 shadow-lg lg:hidden ${className}`.trim()}
      aria-label="Add item"
    >
      <span className="material-symbols-outlined font-light text-2xl">add</span>
    </Link>
  );
}
