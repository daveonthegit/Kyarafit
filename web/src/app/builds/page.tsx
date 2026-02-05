"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { fetchBuilds } from "@/lib/api/builds";

export default function BuildsPage() {
  const { data: builds = [], isLoading } = useQuery({
    queryKey: ["builds"],
    queryFn: fetchBuilds,
  });

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-6 pt-14 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex justify-between items-end">
          <div>
            <p className="meta-label mb-1 opacity-40">Portfolio</p>
            <h1 className="font-serif text-3xl font-bold tracking-tight italic">My Builds</h1>
          </div>
          <Link href="/closet" className="flex items-center gap-2 border border-black px-3 py-1">
            <span className="material-symbols-outlined font-light text-sm">inventory_2</span>
            <span className="text-[9px] uppercase tracking-widest font-bold">Closet</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-6 space-y-4 mt-6">
        {isLoading && <p className="meta-label">Loading…</p>}
        {!isLoading && builds.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No builds yet. Create one to link closet items and use them in convention packing.
          </p>
        )}
        <ul className="space-y-0">
          {builds.map((b) => (
            <li key={b.id}>
              <Link
                href={`/build-detail?id=${b.id}`}
                className="flex items-center gap-3 py-5 border-b border-kyar-borderSubtle hover:opacity-80"
              >
                <span className="flex-1 font-serif text-xl font-bold italic">{b.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                  {b.status}
                </span>
                <span className="material-symbols-outlined text-lg text-kyar-textTertiary">
                  chevron_right
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <FloatingAdd href="/builds/new" />
      <BottomNav active="builds" />
    </div>
  );
}
