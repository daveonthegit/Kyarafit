'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BottomNav } from '@/components/layout/BottomNav';
import { ChecklistRow } from '@/components/ui/ChecklistRow';
import {
  fetchBuild,
  fetchBuildItems,
  fetchBuildTasks,
  createBuildTask,
  updateBuildTask,
} from '@/lib/api/builds';
import { fetchClosetItems } from '@/lib/api/closet';

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export default function BuildDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const queryClient = useQueryClient();
  const [newTaskLabel, setNewTaskLabel] = useState('');

  const { data: build, isLoading } = useQuery({
    queryKey: ['build', id],
    queryFn: () => fetchBuild(id!),
    enabled: !!id,
  });
  const { data: closetItemIds = [] } = useQuery({
    queryKey: ['build-items', id],
    queryFn: () => fetchBuildItems(id!),
    enabled: !!id,
  });
  const { data: closetItems = [] } = useQuery({
    queryKey: ['closet', 'items'],
    queryFn: fetchClosetItems,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['build-tasks', id],
    queryFn: () => fetchBuildTasks(id!),
    enabled: !!id,
  });

  const linkedItems = closetItems.filter((c) => closetItemIds.includes(c.id));
  const totalCostCents = linkedItems.reduce((sum, i) => sum + (i.costCents ?? 0), 0);

  const createTask = useMutation({
    mutationFn: (label: string) => createBuildTask(id!, { label, sortOrder: tasks.length }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['build-tasks', id] });
      setNewTaskLabel('');
    },
  });
  const toggleTask = useMutation({
    mutationFn: ({ taskId, checked }: { taskId: string; checked: boolean }) =>
      updateBuildTask(id!, taskId, { checked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['build-tasks', id] }),
  });

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">Back to Builds</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Loading…</p>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Build not found.</p>
        <Link href="/builds" className="mt-4 text-sm underline">Back to Builds</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 flex justify-between items-center">
        <button type="button" onClick={() => router.back()}>
          <span className="material-symbols-outlined font-light text-2xl">arrow_back_ios</span>
        </button>
        <span className="meta-label">Build</span>
        <span className="w-8" />
      </header>

      <main className="mt-24 px-6 mb-12">
        {build.imageUrl && (
          <div className="mb-6 rounded overflow-hidden bg-kyar-muted aspect-[4/3] max-h-48">
            <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="meta-label mb-2">Portfolio</p>
            <h1 className="font-serif text-4xl font-normal italic">{build.name}</h1>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">{build.status}</p>
        </div>
        {build.character && (
          <p className="text-sm text-kyar-textTertiary mb-2">Character: {build.character}</p>
        )}
        {(build.budgetCents != null || totalCostCents > 0) && (
          <p className="text-sm text-kyar-textTertiary mb-6">
            {build.budgetCents != null && <span>Budget: {formatCents(build.budgetCents)}</span>}
            {build.budgetCents != null && totalCostCents > 0 && ' · '}
            {totalCostCents > 0 && <span>Linked total: {formatCents(totalCostCents)}</span>}
          </p>
        )}

        <section className="mb-10">
          <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">Tasks</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTaskLabel}
              onChange={(e) => setNewTaskLabel(e.target.value)}
              placeholder="Required item or step…"
              className="flex-1 border-0 border-b border-black bg-transparent py-2 text-sm placeholder:text-kyar-textTertiary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => newTaskLabel.trim() && createTask.mutate(newTaskLabel.trim())}
              disabled={!newTaskLabel.trim() || createTask.isPending}
              className="text-[10px] font-semibold uppercase tracking-widest border border-black px-3 py-2 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="space-y-1">
            {tasks.map((t) => (
              <ChecklistRow
                key={t.id}
                label={t.closetItemId ? `${t.label} (linked)` : t.label}
                checked={t.checked}
                onToggle={() => toggleTask.mutate({ taskId: t.id, checked: !t.checked })}
              />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-serif text-xl italic border-b border-black pb-2">Linked items ({linkedItems.length})</h2>
            <Link
              href={`/build-detail/link-items?id=${id}`}
              className="text-[10px] font-semibold uppercase tracking-widest border border-black px-3 py-2 hover:bg-kyar-muted"
            >
              Link items
            </Link>
          </div>
          {linkedItems.length === 0 && (
            <p className="text-sm text-kyar-meta">No closet items linked. Tap &quot;Link items&quot; to add pieces from your closet.</p>
          )}
          <ul className="space-y-4">
            {linkedItems.map((item) => (
              <li key={item.id} className="flex justify-between items-center pb-4 border-b border-kyar-borderSubtle">
                <span className="text-sm uppercase tracking-wide">{item.name}</span>
                <span className="text-[10px] text-kyar-textTertiary">
                  {item.category}
                  {item.costCents != null ? ` · ${formatCents(item.costCents)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <BottomNav active="builds" />
    </div>
  );
}
