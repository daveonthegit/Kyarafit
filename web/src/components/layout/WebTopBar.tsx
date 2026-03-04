"use client";

import Link from "next/link";

/**
 * Web-only: top bar for desktop/tablet. Logo, Add action, settings.
 */
export function WebTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-kyar-borderSubtle bg-white/95 px-4 backdrop-blur-sm lg:px-6">
      <Link href="/home" className="font-serif text-lg font-bold italic tracking-tight">
        Kyarafit
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/closet/new"
          className="flex items-center gap-1.5 rounded-sm border border-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-kyar-muted"
          aria-label="Add item"
        >
          <span className="material-symbols-outlined text-lg font-light">add</span>
          Add
        </Link>
        <Link
          href="/settings"
          className="rounded-sm p-2 text-kyar-textSecondary hover:bg-kyar-muted hover:text-kyar-text"
          aria-label="Settings"
        >
          <span className="material-symbols-outlined text-xl font-light">menu</span>
        </Link>
      </div>
    </header>
  );
}
