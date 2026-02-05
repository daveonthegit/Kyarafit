'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { fetchConventions } from '@/lib/api/conventions';

export default function PackingListPage() {
  const { data: conventions = [], isLoading } = useQuery({
    queryKey: ['conventions'],
    queryFn: fetchConventions,
  });

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label opacity-50 mb-1">Logistics</p>
          <h1 className="font-serif text-3xl font-bold italic">Packing List</h1>
        </div>
      </header>

      <main className="px-6 space-y-4">
        <p className="text-sm text-kyar-meta">
          Select a convention to view or edit its packing list.
        </p>
        {isLoading && <p className="meta-label">Loading…</p>}
        <ul className="space-y-0">
          {conventions.map((c) => (
            <li key={c.id}>
              <Link
                href={`/conventions/${c.id}/packing`}
                className="flex items-center gap-3 py-5 border-b border-kyar-borderSubtle hover:opacity-80"
              >
                <span className="flex-1 font-serif text-xl font-bold italic">{c.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
                  {c.startDate} – {c.endDate}
                </span>
                <span className="material-symbols-outlined text-lg text-kyar-textTertiary">chevron_right</span>
              </Link>
            </li>
          ))}
        </ul>
        {!isLoading && conventions.length === 0 && (
          <p className="text-sm text-kyar-meta pt-4">
            No conventions yet. Create one from the Plan tab and generate a packing list.
          </p>
        )}
      </main>

      <BottomNav active="packing" />
    </div>
  );
}
