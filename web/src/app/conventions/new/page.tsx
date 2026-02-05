'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createConvention } from '@/lib/api/conventions';

export default function NewConventionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createConvention({
        name: name.trim(),
        location: location.trim() || undefined,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
      }),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ['conventions'] });
      router.push(`/conventions/${c.id}`);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate.trim() || !endDate.trim()) return;
    create.mutate();
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/conventions" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">New Convention</p>
      </header>

      <main className="flex-1 px-6 py-8">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block meta-label mb-2">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anime Expo"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">LOCATION (OPTIONAL)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or venue"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">START DATE (YYYY-MM-DD)</label>
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="2025-07-04"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">END DATE (YYYY-MM-DD)</label>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="2025-07-06"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending || !name.trim() || !startDate.trim() || !endDate.trim()}
            className="w-full bg-black text-white py-3.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            CREATE CONVENTION
          </button>
        </form>
      </main>
    </div>
  );
}
