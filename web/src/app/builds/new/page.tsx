'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBuild } from '@/lib/api/builds';
import type { BuildStatus } from '@kyarafit/design-system/types';

const STATUSES: BuildStatus[] = ['idea', 'wip', 'ready'];

export default function NewBuildPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<BuildStatus>('idea');
  const [imageUrl, setImageUrl] = useState('');
  const [budgetCents, setBudgetCents] = useState<string>('');

  const create = useMutation({
    mutationFn: () =>
      createBuild({
        name: name.trim(),
        status,
        imageUrl: imageUrl.trim() || undefined,
        budgetCents: budgetCents.trim() ? Math.round(parseFloat(budgetCents) * 100) : undefined,
      }),
    onSuccess: (b) => {
      queryClient.invalidateQueries({ queryKey: ['builds'] });
      router.push(`/build-detail?id=${b.id}`);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/builds" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">New Build</p>
      </header>

      <main className="flex-1 px-6 py-8">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block meta-label mb-2">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arlecchino"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">IMAGE URL (OPTIONAL)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">BUDGET $ (OPTIONAL)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budgetCents}
              onChange={(e) => setBudgetCents(e.target.value)}
              placeholder="0.00"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">STATUS</label>
            <div className="flex gap-3 mt-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border ${
                    status === s
                      ? 'border-black bg-kyar-muted text-black'
                      : 'border-kyar-border text-kyar-textTertiary hover:border-black'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={create.isPending || !name.trim()}
            className="w-full bg-black text-white py-3.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            CREATE BUILD
          </button>
        </form>
      </main>
    </div>
  );
}
