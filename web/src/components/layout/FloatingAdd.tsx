'use client';

import Link from 'next/link';

export function FloatingAdd() {
  return (
    <Link
      href="/add-item"
      className="fixed bottom-28 right-6 z-50 w-14 h-14 bg-black text-white flex items-center justify-center rounded-sm transition-transform hover:scale-95 active:scale-95 shadow-lg"
      aria-label="Add item"
    >
      <span className="material-symbols-outlined font-light text-2xl">add</span>
    </Link>
  );
}
