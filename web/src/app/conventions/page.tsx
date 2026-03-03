"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

export default function ConventionsPage() {
  const { userId } = useCurrentUser();
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip") ?? [];
  const isLoading = conventions === undefined;

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle">
        <p className="meta-label mb-1">Circuit</p>
        <h1 className="font-serif text-3xl font-bold tracking-tight italic">Conventions</h1>
      </header>

      <main className="flex-1 px-6 py-6">
        <Link
          href="/conventions/new"
          className="block w-full bg-black text-white text-center py-3.5 text-[11px] font-bold uppercase tracking-wider mb-8"
        >
          NEW CONVENTION
        </Link>

        {isLoading && <p className="meta-label">Loading...</p>}
        {!isLoading && conventions.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No conventions yet. Create one to plan days and generate packing lists.
          </p>
        )}
        <ul className="space-y-0">
          {conventions.map((c) => (
            <li key={c._id}>
              <Link
                href={`/conventions/${c._id}`}
                className="flex items-center gap-3 py-5 border-b border-kyar-borderSubtle hover:opacity-80"
              >
                <span className="flex-1 font-serif text-xl font-bold italic">{c.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                  {c.startDate} – {c.endDate}
                  {c.location ? ` · ${c.location}` : ""}
                </span>
                <span className="material-symbols-outlined text-lg text-kyar-textTertiary">
                  chevron_right
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <BottomNav active="plan" />
    </div>
  );
}
